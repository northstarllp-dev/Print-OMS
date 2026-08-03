"use client";

import React from "react";
import LoadingLines from "@/components/ui/loading-lines";

interface PrintomsLoadingProps {
  /** Full-viewport overlay centered in the middle of the screen. */
  fullScreen?: boolean;
  className?: string;
}

/**
 * Single loading UI for the whole app (gateway, admin/staff, portal navigations).
 * Prefer fullScreen for route/auth transitions; inline for section placeholders.
 * Logo / loading text come from the active CLIENT_SLUG config.
 */
export function PrintomsLoading({ fullScreen = false, className = "" }: PrintomsLoadingProps) {
  if (fullScreen) {
    return (
      <div
        className={`fixed inset-0 z-[99999] flex items-center justify-center bg-white ${className}`}
        style={{
          minHeight: "100dvh",
          width: "100vw",
          left: 0,
          top: 0,
          right: 0,
          bottom: 0,
        }}
        role="status"
        aria-live="polite"
      >
        <LoadingLines logoWidth={160} logoHeight={48} />
      </div>
    );
  }

  return (
    <div
      className={`flex w-full flex-col items-center justify-center p-8 min-h-[240px] ${className}`}
      role="status"
      aria-live="polite"
    >
      <LoadingLines logoWidth={140} logoHeight={42} />
    </div>
  );
}
