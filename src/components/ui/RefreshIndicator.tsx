"use client";

import React from "react";

const SIZES = {
  sm: 32,
  md: 40,
} as const;

interface RefreshIndicatorProps {
  /** Spinning / updating state */
  active?: boolean;
  /** Pull progress 0–1 (ignored when active) */
  progress?: number;
  /** Pull passed threshold */
  ready?: boolean;
  size?: keyof typeof SIZES;
  showLabel?: boolean;
  className?: string;
}

export function RefreshIndicator({
  active = false,
  progress = 0,
  ready = false,
  size = "md",
  showLabel = false,
  className = "",
}: RefreshIndicatorProps) {
  const ringSize = SIZES[size];
  const stroke = size === "sm" ? 2 : 2.25;
  const radius = (ringSize - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const isReady = ready || active;
  const dashOffset = circumference * (1 - (active ? 0.72 : Math.min(progress, 1)));
  const scale = active ? 1 : 0.72 + Math.min(progress, 1) * 0.28;

  return (
    <div className={`flex flex-col items-center gap-1.5 ${className}`}>
      <div
        className="relative flex items-center justify-center rounded-full"
        style={{
          width: ringSize,
          height: ringSize,
          transform: `scale(${scale})`,
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(248,250,252,0.94) 100%)",
          boxShadow: isReady
            ? "0 8px 28px rgba(15, 23, 42, 0.12), 0 0 0 1px rgba(15, 23, 42, 0.05)"
            : "0 6px 20px rgba(15, 23, 42, 0.08), 0 0 0 1px rgba(15, 23, 42, 0.04)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          transition: "transform 0.35s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.25s ease",
        }}
      >
        <svg
          width={ringSize}
          height={ringSize}
          viewBox={`0 0 ${ringSize} ${ringSize}`}
          className="absolute inset-0"
          style={{
            transform: "rotate(-90deg)",
            animation: active ? "prt-refresh-spin 0.85s linear infinite" : undefined,
          }}
          aria-hidden
        >
          <circle
            cx={ringSize / 2}
            cy={ringSize / 2}
            r={radius}
            fill="none"
            stroke="rgba(148, 163, 184, 0.22)"
            strokeWidth={stroke}
          />
          <circle
            cx={ringSize / 2}
            cy={ringSize / 2}
            r={radius}
            fill="none"
            stroke={isReady ? "var(--color-secondary, #1E40AF)" : "var(--color-primary, #1E40AF)"}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            style={{
              transition: active ? "none" : "stroke-dashoffset 0.05s linear, stroke 0.2s ease",
            }}
          />
        </svg>

        <div
          className="relative flex items-center justify-center"
          style={{
            width: size === "sm" ? 14 : 16,
            height: size === "sm" ? 14 : 16,
            color: isReady ? "var(--color-secondary, #1E40AF)" : "#94a3b8",
            transition: "color 0.2s ease",
          }}
        >
          {active ? (
            <span
              className="block rounded-full"
              style={{
                width: size === "sm" ? 4 : 5,
                height: size === "sm" ? 4 : 5,
                background: "var(--color-secondary, #1E40AF)",
                boxShadow:
                  "0 0 0 3px color-mix(in srgb, var(--color-secondary, #1E40AF) 18%, transparent)",
              }}
            />
          ) : (
            <svg width={size === "sm" ? 12 : 14} height={size === "sm" ? 12 : 14} viewBox="0 0 14 14" fill="none" aria-hidden>
              <path
                d={
                  isReady
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

      {showLabel && (
        <span
          className="text-[10px] font-semibold tracking-[0.04em] uppercase"
          style={{
            color: isReady ? "var(--color-secondary, #1E40AF)" : "#94a3b8",
            transition: "color 0.2s ease",
          }}
        >
          {active ? "Updating" : isReady ? "Release" : "Pull"}
        </span>
      )}
    </div>
  );
}
