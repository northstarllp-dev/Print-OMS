"use client";

import React, { useState, useEffect, useRef } from "react";
import { History, Search, X, ArrowLeft } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { ensureRealtimeAuth } from "@/utils/supabase/ensureRealtimeAuth";

interface OrderCommunicationCenterProps {
  orderId: string;
  onClose?: () => void;
}

interface TimelineEvent {
  id: string;
  order_id: string;
  activity_type: string;
  actor_name: string;
  actor_role: string;
  content: string;
  created_at: string;
}

/** Order activity timeline (read-only). Chat tabs removed. */
export function OrderCommunicationCenter({
  orderId,
  onClose,
}: OrderCommunicationCenterProps) {
  const supabase = createClient();
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const { data, error } = await supabase
        .from("order_activity")
        .select("id, order_id, activity_type, actor_name, actor_role, content, created_at")
        .eq("order_id", orderId)
        .eq("activity_type", "timeline")
        .order("created_at", { ascending: true });
      if (cancelled) return;
      if (error) console.error("Error loading timeline:", error);
      else setEvents(data || []);
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [orderId, supabase]);

  useEffect(() => {
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    void (async () => {
      await ensureRealtimeAuth(supabase);
      if (cancelled) return;

      channel = supabase
        .channel(`order-timeline-${orderId}:${Math.random().toString(36).slice(2, 8)}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "order_activity",
            filter: `order_id=eq.${orderId}`,
          },
          (payload) => {
            const row = payload.new as TimelineEvent;
            if (row.activity_type !== "timeline") return;
            setEvents((prev) => (prev.some((e) => e.id === row.id) ? prev : [...prev, row]));
          }
        )
        .subscribe();
    })();

    return () => {
      cancelled = true;
      if (channel) {
        channel.unsubscribe();
        supabase.removeChannel(channel);
      }
    };
  }, [orderId, supabase]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [events.length]);

  const filtered = events.filter((e) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      e.content.toLowerCase().includes(q) ||
      e.actor_name.toLowerCase().includes(q)
    );
  });

  return (
    <div className="w-full h-full flex flex-col bg-white overflow-hidden text-slate-800">
      <header className="px-3 sm:px-4 py-3 sm:py-3.5 bg-slate-900 text-white flex flex-col shrink-0 gap-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="lg:hidden inline-flex items-center gap-1.5 shrink-0 rounded-lg px-2.5 py-1.5 bg-slate-700/80 text-white text-xs font-bold hover:bg-slate-600 transition-colors"
                aria-label="Back"
              >
                <ArrowLeft size={14} />
                Back
              </button>
            )}
            <History size={16} className="text-emerald-400 shrink-0" />
            <h2 className="text-sm font-extrabold tracking-wider uppercase truncate">Timeline</h2>
            <span className="hidden sm:inline text-[10px] font-mono bg-slate-700 px-2 py-0.5 rounded-full text-sky-300 font-bold truncate max-w-[8rem]">
              {orderId}
            </span>
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-2 hover:bg-slate-700 rounded-full text-slate-300 hover:text-white transition-all shrink-0"
              aria-label="Close timeline"
            >
              <X size={18} />
            </button>
          )}
        </div>
        <div className="relative">
          <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search timeline…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-700/60 border-none rounded-xl text-xs pl-8 pr-3 py-2 text-white outline-none placeholder-slate-400"
          />
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
        {loading && (
          <p className="text-center text-xs text-slate-400 py-8 font-medium">Loading timeline…</p>
        )}
        {!loading && filtered.length === 0 && (
          <p className="text-center text-xs text-slate-400 py-12 font-medium">
            No timeline events yet.
          </p>
        )}
        {filtered.map((event) => {
          const time = new Date(event.created_at).toLocaleString([], {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          });
          return (
            <div
              key={event.id}
              className="rounded-xl border border-slate-200 bg-white px-3.5 py-3 shadow-sm"
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                  {event.actor_name}
                  {event.actor_role ? ` · ${event.actor_role}` : ""}
                </span>
                <span className="text-[10px] font-mono text-slate-400 shrink-0">{time}</span>
              </div>
              <p className="text-[13px] text-slate-800 leading-relaxed whitespace-pre-wrap">
                {event.content}
              </p>
            </div>
          );
        })}
        <div ref={scrollRef} />
      </div>
    </div>
  );
}
