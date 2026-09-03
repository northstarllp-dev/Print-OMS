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

/** Branded gradient loader — logo + orbiting gradient rings. Use via PrintomsLoading. */
export default function LoadingLines({
  className = "",
  logoWidth = 160,
  logoHeight = 48,
}: LoadingLinesProps) {
  const frameSize = Math.max(logoWidth, logoHeight) + 88;
  const [label, setLabel] = useState(() => resolveLoadingLabel());

  useEffect(() => {
    setLabel(resolveLoadingLabel());
  }, []);

  return (
    <div
      className={`flex flex-col items-center justify-center gap-6 select-none ${className}`}
      role="status"
      aria-label="Loading"
    >
      <div
        className="relative flex items-center justify-center"
        style={{ width: frameSize, height: frameSize }}
      >
        {/* Aurora glow behind logo */}
        <div
          className="prt-loader-aurora pointer-events-none absolute left-1/2 top-1/2 h-[72%] w-[72%] rounded-full blur-2xl"
          style={{
            background:
              "conic-gradient(from 0deg, var(--color-primary), color-mix(in srgb, var(--color-primary) 40%, #fff), color-mix(in srgb, var(--color-primary) 60%, #a78bfa), var(--color-primary))",
          }}
          aria-hidden
        />

        {/* Outer soft ring */}
        <div
          className="prt-loader-orbit-rev pointer-events-none absolute inset-0 rounded-full opacity-70"
          style={{
            background:
              "conic-gradient(from 180deg, transparent 0%, color-mix(in srgb, var(--color-primary) 25%, transparent) 35%, transparent 70%)",
            mask: "radial-gradient(farthest-side, transparent calc(100% - 2px), #000 calc(100% - 1px))",
            WebkitMask:
              "radial-gradient(farthest-side, transparent calc(100% - 2px), #000 calc(100% - 1px))",
          }}
          aria-hidden
        />

        {/* Main gradient arc */}
        <div
          className="prt-loader-orbit pointer-events-none absolute inset-[10px] rounded-full"
          style={{
            background:
              "conic-gradient(from 0deg, transparent 0% 52%, var(--color-primary) 68%, color-mix(in srgb, var(--color-primary) 35%, #fff) 78%, color-mix(in srgb, var(--color-primary) 50%, #c4b5fd) 88%, transparent 100%)",
            mask: "radial-gradient(farthest-side, transparent calc(100% - 4px), #000 calc(100% - 3px))",
            WebkitMask:
              "radial-gradient(farthest-side, transparent calc(100% - 4px), #000 calc(100% - 3px))",
          }}
          aria-hidden
        />

        {/* Inner counter-orbit accent */}
        <div
          className="prt-loader-orbit-rev pointer-events-none absolute inset-[22px] rounded-full opacity-90"
          style={{
            background:
              "conic-gradient(from 90deg, transparent 55%, color-mix(in srgb, var(--color-primary) 70%, #fff) 72%, transparent 85%)",
            mask: "radial-gradient(farthest-side, transparent calc(100% - 2px), #000 calc(100% - 1px))",
            WebkitMask:
              "radial-gradient(farthest-side, transparent calc(100% - 2px), #000 calc(100% - 1px))",
          }}
          aria-hidden
        />

        <div className="prt-loader-float relative z-[1] flex items-center justify-center rounded-2xl bg-white/80 px-4 py-3 shadow-[0_8px_32px_-8px_color-mix(in_srgb,var(--color-primary)_35%,transparent)] backdrop-blur-sm ring-1 ring-white/60">
          <Logo width={logoWidth} height={logoHeight} align="center" applyScale={false} />
        </div>
      </div>

      <div className="flex flex-col items-center gap-2.5">
        <span
          className="prt-loader-shimmer text-[11px] font-bold tracking-[0.22em] uppercase text-center bg-clip-text text-transparent"
          style={{
            backgroundImage:
              "linear-gradient(90deg, color-mix(in srgb, var(--color-primary) 50%, #94a3b8) 0%, var(--color-primary) 40%, #fff 50%, var(--color-primary) 60%, color-mix(in srgb, var(--color-primary) 50%, #94a3b8) 100%)",
          }}
        >
          {label}
        </span>
        <div className="flex items-center gap-1.5" aria-hidden>
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="prt-loader-dot h-1.5 w-1.5 rounded-full"
              style={{
                background:
                  "linear-gradient(135deg, var(--color-primary), color-mix(in srgb, var(--color-primary) 40%, #c4b5fd))",
                animationDelay: `${i * 0.18}s`,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
