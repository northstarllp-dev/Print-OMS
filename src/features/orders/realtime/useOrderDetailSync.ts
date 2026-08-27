"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { ensureRealtimeAuth } from "@/utils/supabase/ensureRealtimeAuth";
import type { RealtimeChannel, RealtimePostgresChangesPayload } from "@supabase/supabase-js";
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
  /** Tenant scope for order_activity (friendly order_id is not globally unique). */
  companyId?: string | null;
  siteVisitId?: string | null;
  enabled?: boolean;
  /** Current order snapshot used to merge site-visit locations. */
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

type Row = Record<string, unknown>;

/**
 * One channel per open order detail. Use event:"*" + server filters.
 * Tables have REPLICA IDENTITY FULL so DELETE events still match filters
 * on order_id / site_visit_id.
 *
 * Measurements use a separate channel so resolving siteVisitId after a
 * schedule upsert does not tear down the site_visits/orders subscription
 * (which would drop the concurrent stage UPDATE).
 */
export function useOrderDetailSync({
  orderId,
  businessOrderId,
  companyId,
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
      setResolvedSiteVisitId((prev) =>
        prev === siteVisitId ? prev : siteVisitId
      );
      return;
    }
    if (!orderId) return;
    const supabase = createClient();
    let cancelled = false;
    void (async () => {
      await ensureRealtimeAuth(supabase);
      if (cancelled) return;
      const { data } = await supabase
        .from("site_visits")
        .select("id")
        .eq("order_id", orderId)
        .maybeSingle();
      if (!cancelled && data?.id) {
        const id = String(data.id);
        setResolvedSiteVisitId((prev) => (prev === id ? prev : id));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orderId, siteVisitId]);

  // Core order / site-visit / stage tables stable for the open order.
  useEffect(() => {
    if (!enabled || !orderId) return;

    const supabase = createClient();
    const channelName = `order-detail-sync:${orderId}:${Math.random().toString(36).slice(2, 8)}`;
    const activityFilterId = businessOrderId || orderId;
    let channel: RealtimeChannel | null = null;
    let cancelled = false;

    const emitPatch = (patch: OrderDetailPatch) => {
      onPatchRef.current(patch);
    };

    const asRow = (
      payload: RealtimePostgresChangesPayload<Row>
    ): { eventType: string; newRow: Row | null; oldRow: Row | null } => ({
      eventType: payload.eventType,
      newRow:
        payload.new && Object.keys(payload.new).length > 0
          ? (payload.new as Row)
          : null,
      oldRow:
        payload.old && Object.keys(payload.old).length > 0
          ? (payload.old as Row)
          : null,
    });

    void (async () => {
      await ensureRealtimeAuth(supabase);
      if (cancelled) return;

      channel = supabase.channel(channelName);

      channel = channel.on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "orders",
          filter: `id=eq.${orderId}`,
        },
        (payload) => {
          const { newRow } = asRow(
            payload as RealtimePostgresChangesPayload<Row>
          );
          if (!newRow) return;
          const patch = patchFromOrdersRow(newRow);
          const prev = snapshotRef.current();
          if (
            onStageChangeRef.current &&
            ((patch.stage !== undefined && patch.stage !== prev.stage) ||
              (patch.stageStatus !== undefined &&
                patch.stageStatus !==
                  (prev as { stageStatus?: string }).stageStatus))
          ) {
            onStageChangeRef.current("This order was updated by another user.");
          }
          emitPatch(patch);
        }
      );

      channel = channel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "site_visits",
          filter: `order_id=eq.${orderId}`,
        },
        (payload) => {
          const { eventType, newRow } = asRow(
            payload as RealtimePostgresChangesPayload<Row>
          );
          if (eventType === "DELETE") {
            setResolvedSiteVisitId(null);
            emitPatch({ siteVisitDetails: null });
            return;
          }
          if (newRow) {
            if (newRow.id) {
              const id = String(newRow.id);
              setResolvedSiteVisitId((prev) => (prev === id ? prev : id));
            }
            emitPatch(patchFromSiteVisitRow(newRow));
          }
        }
      );

      channel = channel
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "quotations",
            filter: `order_id=eq.${orderId}`,
          },
          (payload) => {
            const { eventType, newRow } = asRow(
              payload as RealtimePostgresChangesPayload<Row>
            );
            if ((eventType === "INSERT" || eventType === "UPDATE") && newRow) {
              emitPatch(patchFromQuotationRow(newRow));
            }
          }
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "designs",
            filter: `order_id=eq.${orderId}`,
          },
          (payload) => {
            const { eventType, newRow } = asRow(
              payload as RealtimePostgresChangesPayload<Row>
            );
            emitPatch(patchFromDesignRow(eventType, newRow));
          }
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "productions",
            filter: `order_id=eq.${orderId}`,
          },
          (payload) => {
            const { eventType, newRow } = asRow(
              payload as RealtimePostgresChangesPayload<Row>
            );
            emitPatch(patchFromProductionRow(eventType, newRow));
          }
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "installations",
            filter: `order_id=eq.${orderId}`,
          },
          (payload) => {
            const { eventType, newRow } = asRow(
              payload as RealtimePostgresChangesPayload<Row>
            );
            emitPatch(patchFromInstallationRow(eventType, newRow));
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
            const { eventType, newRow, oldRow } = asRow(
              payload as RealtimePostgresChangesPayload<Row>
            );
            if (
              companyId &&
              newRow?.company_id &&
              newRow.company_id !== companyId
            ) {
              return;
            }
            onActivityRef.current?.({
              eventType,
              new: newRow,
              old: oldRow,
            });
          }
        );
      }

      channel.subscribe((status, err) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.warn("[useOrderDetailSync] channel error (likely unauthenticated portal access)", {
            orderId,
            status,
            err,
          });
        }
      });
    })();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [orderId, businessOrderId, companyId, enabled]);

  // Measurements separate channel so siteVisitId resolution doesn't drop schedule events.
  useEffect(() => {
    if (!enabled || !orderId || !resolvedSiteVisitId) return;

    const supabase = createClient();
    const channelName = `order-sv-measurements:${resolvedSiteVisitId}:${Math.random().toString(36).slice(2, 8)}`;
    let channel: RealtimeChannel | null = null;
    let cancelled = false;

    const asRow = (
      payload: RealtimePostgresChangesPayload<Row>
    ): { eventType: string; newRow: Row | null; oldRow: Row | null } => ({
      eventType: payload.eventType,
      newRow:
        payload.new && Object.keys(payload.new).length > 0
          ? (payload.new as Row)
          : null,
      oldRow:
        payload.old && Object.keys(payload.old).length > 0
          ? (payload.old as Row)
          : null,
    });

    void (async () => {
      await ensureRealtimeAuth(supabase);
      if (cancelled) return;

      channel = supabase
        .channel(channelName)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "site_visit_measurements",
            filter: `site_visit_id=eq.${resolvedSiteVisitId}`,
          },
          (payload) => {
            const { eventType, newRow, oldRow } = asRow(
              payload as RealtimePostgresChangesPayload<Row>
            );
            onPatchRef.current(
              patchFromMeasurementEvent(eventType, newRow, oldRow)
            );
          }
        )
        .subscribe((status, err) => {
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            console.warn("[useOrderDetailSync] measurements channel error (likely unauthenticated portal access)", {
              siteVisitId: resolvedSiteVisitId,
              status,
              err,
            });
          }
        });
    })();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [orderId, resolvedSiteVisitId, enabled]);
}

export { mergeOrderDetailPatch };
