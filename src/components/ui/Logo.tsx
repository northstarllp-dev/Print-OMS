"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import { loadClientConfig, ClientConfig } from "@/config/loadClientConfig";

interface LogoProps {
  className?: string;
  forceText?: boolean; // Useful if we just want text even if image exists
  width?: number;
  height?: number;
  align?: "left" | "center" | "right";
}

export function Logo({ className = "", forceText = false, width = 200, height = 48, align = "center" }: LogoProps) {
  const [client, setClient] = useState<ClientConfig | null>(null);

  useEffect(() => {
    // Only resolve the active client on the client-side to prevent hydration mismatches
    setClient(loadClientConfig());
  }, []);

  if (!client) {
    // Return empty placeholder during SSR to prevent hydration mismatch
    return <div className={`flex items-center ${className}`} style={{ height, width }} />;
  }

  if (client.logoUrl && !forceText) {
    return (
      <div className={`flex items-center ${className}`} style={{ width, transition: "all 0.25s cubic-bezier(0.4,0,0.2,1)" }}>
        <Image
          src={client.logoUrl}
          alt={`${client.name} Logo`}
          width={width}
          height={height}
          className="object-contain"
          style={{ maxHeight: height, maxWidth: "100%", objectPosition: align, transition: "all 0.25s cubic-bezier(0.4,0,0.2,1)" }}
          priority
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
