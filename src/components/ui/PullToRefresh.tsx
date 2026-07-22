"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshIndicator } from "@/components/ui/RefreshIndicator";

const PULL_THRESHOLD = 72;
const MAX_PULL = 120;
const MIN_REFRESH_MS = 650;

interface PullToRefreshProps {
  children: React.ReactNode;
  /** Skip pull-to-refresh (e.g. order worksheet pages). */
  disabled?: boolean;
  /** Custom refresh handler (e.g. refetch order snapshot). Falls back to router.refresh(). */
  onRefresh?: () => Promise<void> | void;
  /** Controlled refreshing state from parent (e.g. header refresh button). */
  refreshing?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

function assignRef<T>(ref: React.Ref<T> | undefined, value: T) {
  if (!ref) return;
  if (typeof ref === "function") ref(value);
  else ref.current = value;
}

/**
 * Mobile pull-to-refresh: drag down from the top of the scroll area to refresh.
 */
export const PullToRefresh = React.forwardRef<HTMLDivElement, PullToRefreshProps>(function PullToRefresh(
  {
    children,
    disabled = false,
    onRefresh,
    refreshing: externalRefreshing,
    className,
    style,
  },
  forwardedRef
) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const setContainerRef = useCallback(
    (node: HTMLDivElement | null) => {
      containerRef.current = node;
      assignRef(forwardedRef, node);
    },
    [forwardedRef]
  );
  const startYRef = useRef(0);
  const pullingRef = useRef(false);
  const distanceRef = useRef(0);
  const [pullDistance, setPullDistance] = useState(0);
  const [internalRefreshing, setInternalRefreshing] = useState(false);
  const refreshing = externalRefreshing ?? internalRefreshing;

  const triggerRefresh = useCallback(async () => {
    if (refreshing) return;
    if (externalRefreshing === undefined) {
      setInternalRefreshing(true);
    }
    setPullDistance(PULL_THRESHOLD * 0.55);
    distanceRef.current = PULL_THRESHOLD * 0.55;
    const started = Date.now();
    try {
      if (onRefresh) {
        await onRefresh();
      } else {
        router.refresh();
      }
    } finally {
      const wait = Math.max(0, MIN_REFRESH_MS - (Date.now() - started));
      window.setTimeout(() => {
        if (externalRefreshing === undefined) {
          setInternalRefreshing(false);
        }
        setPullDistance(0);
        distanceRef.current = 0;
      }, wait);
    }
  }, [externalRefreshing, onRefresh, refreshing, router]);

  useEffect(() => {
    const resetPull = () => {
      pullingRef.current = false;
      distanceRef.current = 0;
      setPullDistance(0);
      if (externalRefreshing === undefined) {
        setInternalRefreshing(false);
      }
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
  }, [externalRefreshing]);

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
        void triggerRefresh();
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
  const progress = Math.min(pullDistance / PULL_THRESHOLD, 1);
  const ready = progress >= 1 || refreshing;
  const translateY = Math.max(pullDistance - 6, refreshing ? 40 : 0);

  return (
    <div
      ref={setContainerRef}
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
          style={{ height: 0, marginBottom: 0 }}
          aria-hidden
        >
          <div
            style={{
              transform: `translateY(${translateY}px)`,
              opacity: refreshing ? 1 : Math.min((pullDistance - 8) / 28, 1),
              transition:
                refreshing || pullDistance === 0
                  ? "transform 0.35s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.25s ease"
                  : "none",
            }}
          >
            <RefreshIndicator
              active={refreshing}
              progress={progress}
              ready={ready}
              showLabel
            />
          </div>
        </div>
      )}
      {children}
    </div>
  );
});
