"use client";

import React, { useEffect, useState } from "react";
import { Logo } from "@/components/ui/Logo";
import { loadClientConfig } from "@/config/loadClientConfig";

interface LoadingLinesProps {
  className?: string;
  logoWidth?: number;
  logoHeight?: number;
}

function resolveLoadingLabel(): string {
  try {
    return loadClientConfig().loadingText?.trim() || "Loading…";
  } catch {
    return "Loading…";
  }
}

/** Canonical branded loader — centered logo + spinner ring. Use via PrintomsLoading for layout. */
export default function LoadingLines({
  className = "",
  logoWidth = 160,
  logoHeight = 48,
}: LoadingLinesProps) {
  const ringSize = Math.max(logoWidth, logoHeight) + 48;
  const [label, setLabel] = useState(() => resolveLoadingLabel());

  useEffect(() => {
    setLabel(resolveLoadingLabel());
  }, []);

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
        <div className="relative z-[1] flex items-center justify-center animate-pulse">
          <Logo
            width={logoWidth}
            height={logoHeight}
            align="center"
            applyScale={false}
          />
        </div>
      </div>
      <span className="text-xs font-semibold tracking-wide text-slate-400 uppercase text-center">
        {label}
      </span>
    </div>
  );
}
