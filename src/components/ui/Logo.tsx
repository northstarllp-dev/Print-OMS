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
  /** Shine sweep over logo pixels (same as Polaris footer). Default true. */
  shine?: boolean;
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

/** CSS url() needs spaces / special chars encoded for mask-image. */
function logoCssUrl(logoUrl: string): string {
  const path = logoSrc(logoUrl);
  const encoded = path
    .split("/")
    .map((seg, i) => (i === 0 ? seg : encodeURIComponent(decodeURIComponent(seg))))
    .join("/");
  return `url("${encoded}")`;
}

export function Logo({
  className = "",
  forceText = false,
  width = 200,
  height = 48,
  align = "center",
  applyScale = true,
  shine = true,
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

    const img = (
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
    );

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
        {shine ? (
          <span
            className="company-logo-shine"
            style={{
              width: "100%",
              height: "100%",
              ["--mwl-logo" as string]: logoCssUrl(client.logoUrl),
            }}
          >
            {img}
          </span>
        ) : (
          img
        )}
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
