"use client";

import React from "react";
import { Logo } from "@/components/ui/Logo";

interface LoadingLinesProps {
  className?: string;
  logoWidth?: number;
  logoHeight?: number;
}

/**
 * Branded loading animation: client logo over the colorful stripe mask effect.
 */
export default function LoadingLines({
  className = "",
  logoWidth = 180,
  logoHeight = 48,
}: LoadingLinesProps) {
  return (
    <div
      className={`relative flex items-center justify-center h-[120px] w-[min(100%,320px)] m-8 select-none scale-[1.15] sm:scale-[1.4] ${className}`}
      role="status"
      aria-label="Loading"
    >
      <div className="relative z-[2] animate-[logoAnim_4s_linear_infinite]">
        <Logo width={logoWidth} height={logoHeight} align="center" />
      </div>

      <div className="absolute top-0 left-0 w-full h-full z-[1] bg-transparent [mask:repeating-linear-gradient(90deg,transparent_0,transparent_6px,black_7px,black_8px)]">
        <div
          className="absolute top-0 left-0 w-full h-full
            [background-image:radial-gradient(circle_at_50%_50%,#ff0_0%,transparent_50%),radial-gradient(circle_at_45%_45%,#f00_0%,transparent_45%),radial-gradient(circle_at_55%_55%,#0ff_0%,transparent_45%),radial-gradient(circle_at_45%_55%,#0f0_0%,transparent_45%),radial-gradient(circle_at_55%_45%,#00f_0%,transparent_45%)]
            [mask:radial-gradient(circle_at_50%_50%,transparent_0%,transparent_10%,black_25%)]
            animate-[transformAnim_2s_infinite_alternate_cubic-bezier(0.6,0.8,0.5,1),opacityAnim_4s_infinite]"
        />
      </div>
    </div>
  );
}
