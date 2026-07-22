"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

const PULL_THRESHOLD = 72;
const MAX_PULL = 120;

interface PullToRefreshProps {
  children: React.ReactNode;
  /** Skip pull-to-refresh (e.g. order worksheet pages). */
  disabled?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Mobile pull-to-refresh: drag down from the top of the scroll area to refresh.
 */
export function PullToRefresh({
  children,
  disabled = false,
  className,
  style,
}: PullToRefreshProps) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const startYRef = useRef(0);
  const pullingRef = useRef(false);
  const distanceRef = useRef(0);
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const triggerRefresh = useCallback(() => {
    setRefreshing(true);
    setPullDistance(PULL_THRESHOLD * 0.55);
    distanceRef.current = PULL_THRESHOLD * 0.55;
    router.refresh();
    window.setTimeout(() => {
      setRefreshing(false);
      setPullDistance(0);
      distanceRef.current = 0;
    }, 900);
  }, [router]);

  useEffect(() => {
    const resetPull = () => {
      pullingRef.current = false;
      distanceRef.current = 0;
      setPullDistance(0);
      setRefreshing(false);
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") resetPull();
    };
    window.addEventListener("pagehide", resetPull);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", resetPull);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || disabled) return;

    const onTouchStart = (e: TouchEvent) => {
      if (refreshing) return;
      if (el.scrollTop > 1) return;
      startYRef.current = e.touches[0].clientY;
      pullingRef.current = true;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!pullingRef.current || refreshing) return;
      if (el.scrollTop > 1) {
        pullingRef.current = false;
        distanceRef.current = 0;
        setPullDistance(0);
        return;
      }
      const dy = e.touches[0].clientY - startYRef.current;
      if (dy <= 0) {
        distanceRef.current = 0;
        setPullDistance(0);
        return;
      }
      const damped = Math.min(dy * 0.42, MAX_PULL);
      distanceRef.current = damped;
      setPullDistance(damped);
      if (damped > 10) {
        e.preventDefault();
      }
    };

    const onTouchEnd = () => {
      if (!pullingRef.current) return;
      pullingRef.current = false;
      if (distanceRef.current >= PULL_THRESHOLD && !refreshing) {
        triggerRefresh();
      } else {
        distanceRef.current = 0;
        setPullDistance(0);
      }
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    el.addEventListener("touchcancel", onTouchEnd, { passive: true });

    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [disabled, refreshing, triggerRefresh]);

  const showIndicator = !disabled && (pullDistance > 8 || refreshing);
  const ready = pullDistance >= PULL_THRESHOLD || refreshing;

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        ...style,
        position: "relative",
        overscrollBehaviorY: disabled ? undefined : "contain",
        WebkitOverflowScrolling: "touch",
      }}
    >
      {showIndicator && (
        <div
          className="pointer-events-none sticky top-0 z-[30] flex justify-center"
          style={{
            height: 0,
            marginBottom: 0,
          }}
          aria-hidden
        >
          <div
            className="flex items-center justify-center gap-2 rounded-full bg-white border border-slate-200 shadow-md px-3 py-1.5 text-[11px] font-bold text-slate-600"
            style={{
              transform: `translateY(${Math.max(pullDistance - 8, refreshing ? 36 : 0)}px)`,
              opacity: Math.min(pullDistance / 40, 1),
              transition: refreshing || pullDistance === 0 ? "transform 0.2s ease, opacity 0.2s ease" : "none",
            }}
          >
            <RefreshCw
              size={14}
              className={refreshing ? "animate-spin" : ""}
              style={{
                color: ready ? "var(--color-secondary)" : "#94a3b8",
                transform: refreshing ? undefined : `rotate(${pullDistance * 2.5}deg)`,
              }}
            />
            <span>{refreshing ? "Refreshing…" : ready ? "Release to refresh" : "Pull to refresh"}</span>
          </div>
        </div>
      )}
      {children}
    </div>
  );
}
