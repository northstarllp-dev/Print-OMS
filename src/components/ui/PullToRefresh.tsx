"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const PULL_THRESHOLD = 72;
const MAX_PULL = 120;
const RING_SIZE = 40;
const RING_STROKE = 2.25;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

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
  const progress = Math.min(pullDistance / PULL_THRESHOLD, 1);
  const ready = progress >= 1 || refreshing;
  const dashOffset = RING_CIRCUMFERENCE * (1 - (refreshing ? 0.72 : progress));
  const translateY = Math.max(pullDistance - 6, refreshing ? 40 : 0);
  const scale = refreshing ? 1 : 0.72 + progress * 0.28;

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
          style={{ height: 0, marginBottom: 0 }}
          aria-hidden
        >
          <div
            className="flex flex-col items-center gap-1.5"
            style={{
              transform: `translateY(${translateY}px) scale(${scale})`,
              opacity: refreshing ? 1 : Math.min((pullDistance - 8) / 28, 1),
              transition:
                refreshing || pullDistance === 0
                  ? "transform 0.35s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.25s ease"
                  : "none",
            }}
          >
            <div
              className="relative flex items-center justify-center rounded-full"
              style={{
                width: RING_SIZE,
                height: RING_SIZE,
                background:
                  "linear-gradient(180deg, rgba(255,255,255,0.96) 0%, rgba(248,250,252,0.92) 100%)",
                boxShadow:
                  ready
                    ? "0 8px 28px rgba(15, 23, 42, 0.12), 0 0 0 1px rgba(15, 23, 42, 0.04)"
                    : "0 6px 20px rgba(15, 23, 42, 0.08), 0 0 0 1px rgba(15, 23, 42, 0.04)",
                backdropFilter: "blur(12px)",
                WebkitBackdropFilter: "blur(12px)",
              }}
            >
              <svg
                width={RING_SIZE}
                height={RING_SIZE}
                viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
                className="absolute inset-0"
                style={{
                  transform: "rotate(-90deg)",
                  animation: refreshing ? "prt-ptr-spin 0.85s linear infinite" : undefined,
                }}
              >
                <circle
                  cx={RING_SIZE / 2}
                  cy={RING_SIZE / 2}
                  r={RING_RADIUS}
                  fill="none"
                  stroke="rgba(148, 163, 184, 0.22)"
                  strokeWidth={RING_STROKE}
                />
                <circle
                  cx={RING_SIZE / 2}
                  cy={RING_SIZE / 2}
                  r={RING_RADIUS}
                  fill="none"
                  stroke={ready ? "var(--color-secondary, #4f46e5)" : "var(--color-primary, #1e40af)"}
                  strokeWidth={RING_STROKE}
                  strokeLinecap="round"
                  strokeDasharray={RING_CIRCUMFERENCE}
                  strokeDashoffset={dashOffset}
                  style={{
                    transition: refreshing ? "none" : "stroke-dashoffset 0.05s linear, stroke 0.2s ease",
                  }}
                />
              </svg>

              {/* Center chevron / check mark */}
              <div
                className="relative flex items-center justify-center"
                style={{
                  width: 16,
                  height: 16,
                  color: ready ? "var(--color-secondary, #4f46e5)" : "#94a3b8",
                  transition: "color 0.2s ease, transform 0.25s cubic-bezier(0.22, 1, 0.36, 1)",
                  transform: ready && !refreshing ? "scale(1.05)" : "scale(1)",
                }}
              >
                {refreshing ? (
                  <span
                    className="block rounded-full"
                    style={{
                      width: 5,
                      height: 5,
                      background: "var(--color-secondary, #4f46e5)",
                      boxShadow: "0 0 0 3px color-mix(in srgb, var(--color-secondary, #4f46e5) 18%, transparent)",
                    }}
                  />
                ) : (
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
                    <path
                      d={
                        ready
                          ? "M3.5 7.25L5.75 9.5L10.5 4.5"
                          : "M7 3.25V9.5M7 9.5L4.25 6.75M7 9.5L9.75 6.75"
                      }
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </div>
            </div>

            <span
              className="text-[10px] font-semibold tracking-[0.04em] uppercase"
              style={{
                color: ready ? "var(--color-secondary, #4f46e5)" : "#94a3b8",
                opacity: refreshing ? 1 : Math.max(progress - 0.15, 0),
                transition: "color 0.2s ease, opacity 0.2s ease",
              }}
            >
              {refreshing ? "Updating" : ready ? "Release" : "Pull"}
            </span>
          </div>

          <style>{`
            @keyframes prt-ptr-spin {
              to { transform: rotate(270deg); }
            }
          `}</style>
        </div>
      )}
      {children}
    </div>
  );
}
