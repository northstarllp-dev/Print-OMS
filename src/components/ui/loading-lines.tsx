"use client";

import React from "react";
import { Logo } from "@/components/ui/Logo";

interface LoadingLinesProps {
  className?: string;
  logoWidth?: number;
  logoHeight?: number;
}

/** Simple branded loader — logo with a soft pulse and spinner ring. */
export default function LoadingLines({
  className = "",
  logoWidth = 180,
  logoHeight = 48,
}: LoadingLinesProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-5 select-none ${className}`}
      role="status"
      aria-label="Loading"
    >
      <div className="relative flex items-center justify-center">
        <div
          className="absolute rounded-full border-2 border-slate-200 border-t-[var(--color-primary,#1E40AF)] animate-spin"
          style={{
            width: Math.max(logoWidth, logoHeight) + 28,
            height: Math.max(logoWidth, logoHeight) + 28,
          }}
          aria-hidden
        />
        <div className="animate-pulse">
          <Logo width={logoWidth} height={logoHeight} align="center" />
        </div>
      </div>
      <span className="text-xs font-semibold tracking-wide text-slate-400 uppercase">
        Loading…
      </span>
    </div>
  );
}
