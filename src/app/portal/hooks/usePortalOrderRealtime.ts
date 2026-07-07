"use client";

import { useEffect, type Dispatch, type SetStateAction } from "react";
import { createClient } from "@/utils/supabase/client";
import { mapSiteVisitFromDb } from "@/features/orders/actions/siteVisitMapper";
import { mapDesignFromDb } from "@/features/designs/actions/designMapper";

type UnreadHandler = Dispatch<SetStateAction<number>>;

interface PortalOrderRealtimeOptions<TOrder> {
  orderUuid: string;
  orderFriendlyId: string;
  onOrderPatch: (orderUuid: string, patch: (prev: TOrder) => TOrder) => void;
  onUnreadCount?: UnreadHandler;
}

/**
 * Single Supabase channel per active order: orders, site_visits, designs, and
 * order_activity (unread badge). Replaces multiple per-mount subscriptions.
 */
export function usePortalOrderRealtime<TOrder extends { id: string }>({
  orderUuid,
  orderFriendlyId,
  onOrderPatch,
  onUnreadCount,
}: PortalOrderRealtimeOptions<TOrder>) {
  const activityOrderId = orderFriendlyId || orderUuid;

  useEffect(() => {
    if (!orderUuid) return;

    const supabase = createClient();

    if (onUnreadCount) {
      void (async () => {
        const { count } = await supabase
          .from("order_activity")
          .select("*", { count: "exact", head: true })
          .eq("order_id", activityOrderId)
          .eq("activity_type", "customer")
          .eq("is_read", false);
        if (count !== null) onUnreadCount(count);
      })();
    }

    const channel = supabase
      .channel(`portal-order-${orderUuid}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "order_activity",
          filter: `order_id=eq.${activityOrderId}`,
        },
        (payload) => {
          if (!onUnreadCount) return;
          const msg = payload.new as { activity_type?: string; actor_role?: string };
          if (msg.activity_type === "customer" && msg.actor_role !== "Customer") {
            onUnreadCount((prev) => prev + 1);
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders", filter: `id=eq.${orderUuid}` },
        (payload) => {
          if (payload.eventType !== "UPDATE" && payload.eventType !== "INSERT") return;
          const updatedOrder = payload.new as Record<string, unknown>;
          if (!updatedOrder) return;
          onOrderPatch(orderUuid, (prev) => ({
            ...prev,
            stage: updatedOrder.stage,
            depositPaid: Number(updatedOrder.deposit_paid) || 0,
            stageStatus: updatedOrder.stage_status,
            stageAdminNotes: updatedOrder.stage_admin_notes,
          } as TOrder));
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "site_visits", filter: `order_id=eq.${orderUuid}` },
        (payload) => {
          if (payload.eventType === "DELETE") {
            onOrderPatch(orderUuid, (prev) => ({ ...prev, siteVisitDetails: undefined } as TOrder));
            return;
          }
          const mapped = mapSiteVisitFromDb(payload.new);
          if (!mapped) return;
          onOrderPatch(orderUuid, (prev) => {
            const prevAny = prev as TOrder & { siteVisitDetails?: { locations?: unknown[] } };
            return {
              ...prev,
              siteVisitDetails: {
                ...mapped,
                locations:
                  mapped.locations && mapped.locations.length > 0
                    ? mapped.locations
                    : prevAny.siteVisitDetails?.locations || [],
              },
            } as TOrder;
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "designs", filter: `order_id=eq.${orderUuid}` },
        (payload) => {
          if (payload.eventType === "DELETE") {
            onOrderPatch(orderUuid, (prev) => ({ ...prev, design: undefined } as TOrder));
            return;
          }
          const mapped = mapDesignFromDb(payload.new);
          if (mapped) {
            onOrderPatch(orderUuid, (prev) => ({ ...prev, design: mapped } as TOrder));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orderUuid, activityOrderId, onOrderPatch, onUnreadCount]);
}
