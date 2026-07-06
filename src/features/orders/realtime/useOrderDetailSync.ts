"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";
import type { SiteVisitDetails } from "@/types";
import {
  mergeOrderDetailPatch,
  patchFromDesignRow,
  patchFromInstallationRow,
  patchFromMeasurementEvent,
  patchFromOrdersRow,
  patchFromProductionRow,
  patchFromQuotationRow,
  patchFromSiteVisitRow,
  type OrderDetailPatch,
} from "./orderDetailPatch";

export interface UseOrderDetailSyncOptions {
  orderId: string;
  businessOrderId?: string;
  siteVisitId?: string | null;
  enabled?: boolean;
  /** Current order snapshot — used to merge site-visit locations. */
  getOrderSnapshot: () => Record<string, unknown>;
  onPatch: (patch: OrderDetailPatch) => void;
  /** Optional: order_activity events for comms timeline in OrderWorksheetModal. */
  onActivityChange?: (payload: {
    eventType: string;
    new: Record<string, unknown> | null;
    old: Record<string, unknown> | null;
  }) => void;
  /** Toast when another user changes stage / lock state. */
  onExternalStageChange?: (message: string) => void;
}

export function useOrderDetailSync({
  orderId,
  businessOrderId,
  siteVisitId,
  enabled = true,
  getOrderSnapshot,
  onPatch,
  onActivityChange,
  onExternalStageChange,
}: UseOrderDetailSyncOptions) {
  const [resolvedSiteVisitId, setResolvedSiteVisitId] = useState<string | null>(
    siteVisitId ?? null
  );

  const snapshotRef = useRef(getOrderSnapshot);
  const onPatchRef = useRef(onPatch);
  const onActivityRef = useRef(onActivityChange);
  const onStageChangeRef = useRef(onExternalStageChange);

  snapshotRef.current = getOrderSnapshot;
  onPatchRef.current = onPatch;
  onActivityRef.current = onActivityChange;
  onStageChangeRef.current = onExternalStageChange;

  useEffect(() => {
    if (siteVisitId) {
      setResolvedSiteVisitId(siteVisitId);
      return;
    }
    if (!orderId) return;
    const supabase = createClient();
    let cancelled = false;
    supabase
      .from("site_visits")
      .select("id")
      .eq("order_id", orderId)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled && data?.id) setResolvedSiteVisitId(data.id);
      });
    return () => {
      cancelled = true;
    };
  }, [orderId, siteVisitId]);

  useEffect(() => {
    if (!enabled || !orderId) return;

    const supabase = createClient();
    const channelName = `order-detail-sync-${orderId}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const activityFilterId = businessOrderId || orderId;

    const emitPatch = (patch: OrderDetailPatch) => {
      onPatchRef.current(patch);
    };

    const handleOrdersUpdate = (payload: { new: Record<string, unknown> }) => {
      const patch = patchFromOrdersRow(payload.new);
      const prev = snapshotRef.current();
      if (
        onStageChangeRef.current &&
        (patch.stage !== undefined && patch.stage !== prev.stage ||
          patch.stageStatus !== undefined && patch.stageStatus !== (prev as { stageStatus?: string }).stageStatus)
      ) {
        onStageChangeRef.current("This order was updated by another user.");
      }
      emitPatch(patch);
    };

    const handleSiteVisit = (payload: {
      eventType: string;
      new: Record<string, unknown> | null;
      old: Record<string, unknown> | null;
    }) => {
      if (payload.eventType === "DELETE") {
        emitPatch({ siteVisitDetails: null });
        return;
      }
      if (payload.new) {
        const prevSv = (snapshotRef.current() as { siteVisitDetails?: SiteVisitDetails }).siteVisitDetails;
        emitPatch(patchFromSiteVisitRow(payload.new, prevSv?.locations || []));
      }
    };

    const handleMeasurement = (payload: {
      eventType: string;
      new: Record<string, unknown> | null;
      old: Record<string, unknown> | null;
    }) => {
      const prevSv = (snapshotRef.current() as { siteVisitDetails?: SiteVisitDetails }).siteVisitDetails;
      const patch = patchFromMeasurementEvent(
        payload.eventType,
        payload.new,
        payload.old,
        prevSv?.locations || []
      );
      if (patch) emitPatch(patch);
    };

    let channel: RealtimeChannel = supabase.channel(channelName);

    channel = channel.on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "orders", filter: `id=eq.${orderId}` },
      (payload) => handleOrdersUpdate(payload as { new: Record<string, unknown> })
    );

    channel = channel.on(
      "postgres_changes",
      { event: "*", schema: "public", table: "site_visits", filter: `order_id=eq.${orderId}` },
      (payload) =>
        handleSiteVisit(payload as {
          eventType: string;
          new: Record<string, unknown> | null;
          old: Record<string, unknown> | null;
        })
    );

    if (resolvedSiteVisitId) {
      channel = channel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "site_visit_measurements",
          filter: `site_visit_id=eq.${resolvedSiteVisitId}`,
        },
        (payload) =>
          handleMeasurement(payload as {
            eventType: string;
            new: Record<string, unknown> | null;
            old: Record<string, unknown> | null;
          })
      );
    }

    channel = channel
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "quotations", filter: `order_id=eq.${orderId}` },
        (payload) => {
          if (payload.new) emitPatch(patchFromQuotationRow(payload.new as Record<string, unknown>));
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "quotations", filter: `order_id=eq.${orderId}` },
        (payload) => {
          if (payload.new) emitPatch(patchFromQuotationRow(payload.new as Record<string, unknown>));
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "designs", filter: `order_id=eq.${orderId}` },
        (payload) => {
          const p = payload as {
            eventType: string;
            new: Record<string, unknown> | null;
          };
          emitPatch(patchFromDesignRow(p.eventType, p.new));
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "productions", filter: `order_id=eq.${orderId}` },
        (payload) => {
          const p = payload as {
            eventType: string;
            new: Record<string, unknown> | null;
          };
          emitPatch(patchFromProductionRow(p.eventType, p.new));
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "installations", filter: `order_id=eq.${orderId}` },
        (payload) => {
          const p = payload as {
            eventType: string;
            new: Record<string, unknown> | null;
          };
          emitPatch(patchFromInstallationRow(p.eventType, p.new));
        }
      );

    if (onActivityRef.current) {
      channel = channel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "order_activity",
          filter: `order_id=eq.${activityFilterId}`,
        },
        (payload) => {
          onActivityRef.current?.(
            payload as {
              eventType: string;
              new: Record<string, unknown> | null;
              old: Record<string, unknown> | null;
            }
          );
        }
      );
    }

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orderId, businessOrderId, resolvedSiteVisitId, enabled]);
}

export { mergeOrderDetailPatch };
