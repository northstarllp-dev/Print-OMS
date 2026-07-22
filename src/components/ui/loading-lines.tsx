"use client";

import React from "react";
import { Logo } from "@/components/ui/Logo";

interface LoadingLinesProps {
  className?: string;
  logoWidth?: number;
  logoHeight?: number;
}

/** Canonical branded loader — logo + spinner ring. Use via PrintomsLoading for layout. */
export default function LoadingLines({
  className = "",
  logoWidth = 160,
  logoHeight = 48,
}: LoadingLinesProps) {
  const ringSize = Math.max(logoWidth, logoHeight) + 36;

  return (
    <div
      className={`flex flex-col items-center justify-center gap-5 select-none ${className}`}
      role="status"
      aria-label="Loading"
    >
      <div
        className="relative flex items-center justify-center"
        style={{ width: ringSize, height: ringSize }}
      >
        <div
          className="absolute inset-0 rounded-full border-2 border-slate-200 border-t-[var(--color-primary,#1E40AF)] animate-spin"
          aria-hidden
        />
        <div className="animate-pulse flex items-center justify-center">
          <Logo
            width={logoWidth}
            height={logoHeight}
            align="center"
            applyScale={false}
          />
        </div>
      </div>
      <span className="text-xs font-semibold tracking-wide text-slate-400 uppercase">
        Loading…
      </span>
    </div>
  );
}
