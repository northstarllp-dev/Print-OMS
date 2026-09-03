"use client";

import React, { useEffect, useState } from "react";

import { loadClientConfig, ClientConfig } from "@/config/loadClientConfig";

interface LogoProps {
  className?: string;
  forceText?: boolean; // Useful if we just want text even if image exists
  width?: number;
  height?: number;
  align?: "left" | "center" | "right";
  /** When false, skip client.logoScale (use for loaders so size stays predictable). */
  applyScale?: boolean;
  /**
   * fixed  fill a width×height box (sidebars).
   * hug  image keeps its aspect ratio; parent can wrap tightly around it.
   */
  fit?: "fixed" | "hug";
  /** Smaller logo below lg — for gateway / login headers on phone and tablet. */
  compactBelowLg?: boolean;
}

function tryLoadClientConfig(): ClientConfig | null {
  try {
    return loadClientConfig();
  } catch {
    return null;
  }
}

function logoSrc(logoUrl: string): string {
  return `/printoms${logoUrl}`;
}

export function Logo({
  className = "",
  forceText = false,
  width = 200,
  height = 48,
  align = "center",
  applyScale = true,
  fit = "fixed",
  compactBelowLg = false,
}: LogoProps) {
  // Resolve sync when NEXT_PUBLIC_CLIENT_SLUG is available so loaders show the logo immediately.
  const [client, setClient] = useState<ClientConfig | null>(() => tryLoadClientConfig());

  useEffect(() => {
    if (!client) {
      setClient(tryLoadClientConfig());
    }
  }, [client]);

  if (!client) {
    return <div className={`flex items-center ${className}`} style={{ height, width }} />;
  }

  if (client.logoUrl && !forceText) {
    const scale = applyScale ? (client.logoScale || 1) : 1;
    const finalWidth = width * scale;
    const finalHeight = height * scale;
    const src = logoSrc(client.logoUrl);

    if (fit === "hug") {
      const hugScale = applyScale ? Math.min(client.logoScale || 1, 1.45) : 1;
      const hugHeight = Math.round(height * hugScale);
      return (
        <img
          src={src}
          alt={`${client.name} Logo`}
          className={`block w-auto object-contain object-left ${
            compactBelowLg
              ? "h-10 max-w-[min(62vw,220px)] sm:h-11 sm:max-w-[min(68vw,260px)] md:h-12 md:max-w-[min(72vw,300px)] lg:h-[var(--logo-hug-height)] lg:max-w-[min(78vw,360px)]"
              : "h-auto max-w-[min(78vw,360px)]"
          } ${className}`}
          style={
            compactBelowLg
              ? ({ ["--logo-hug-height" as string]: `${hugHeight}px` } as React.CSSProperties)
              : { height: hugHeight }
          }
        />
      );
    }

    return (
      <div
        className={`flex items-center ${className}`}
        style={{
          width: finalWidth,
          height: finalHeight,
          justifyContent: align === "center" ? "center" : align === "right" ? "flex-end" : "flex-start",
          transition: "all 0.25s cubic-bezier(0.4,0,0.2,1)",
        }}
      >
        <img
          src={src}
          alt={`${client.name} Logo`}
          width={finalWidth}
          height={finalHeight}
          className="object-contain"
          style={{
            maxHeight: finalHeight,
            maxWidth: finalWidth,
            width: "100%",
            height: "100%",
            objectPosition: align === "center" ? "center" : align,
            transition: "all 0.25s cubic-bezier(0.4,0,0.2,1)",
          }}
        />
      </div>
    );
  }

  // Fallback to text logo
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div className="w-8 h-8 rounded bg-primary-600 flex items-center justify-center shadow-sm">
        <span className="font-bold text-white text-lg leading-none">
          {client.name.charAt(0)}
        </span>
      </div>
      <span className="font-bold text-xl tracking-tight text-slate-900 truncate">
        {client.name}
      </span>
    </div>
  );
}
