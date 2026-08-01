"use client";

import React, { useEffect, useRef, useState } from "react";
import { Download, CheckCircle, Smartphone } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

type InstallState = "loading" | "ready" | "installed" | "ios" | "unsupported";

export function InstallPwaButton() {
  const [state, setState] = useState<InstallState>("loading");
  const deferredPrompt = useRef<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    // Never register (or keep) a service worker on localhost — it fights
    // Next.js / Turbopack HMR and causes "module factory is not available".
    const isLocalDev =
      typeof window !== "undefined" &&
      (window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1");

    if ("serviceWorker" in navigator) {
      if (isLocalDev) {
        void navigator.serviceWorker.getRegistrations().then((regs) => {
          for (const reg of regs) void reg.unregister();
        });
      } else {
        navigator.serviceWorker
          .register("/printoms/sw.js", { scope: "/printoms" })
          .catch((err) => console.warn("SW registration failed:", err));
      }
    }

    // Already running as installed PWA (standalone mode)
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setState("installed");
      return;
    }

    // iOS — doesn't support beforeinstallprompt, needs manual "Add to Home Screen"
    const isIos =
      /iphone|ipad|ipod/.test(navigator.userAgent.toLowerCase()) &&
      !(window as any).MSStream;
    if (isIos) {
      setState("ios");
      return;
    }

    // Listen for Chrome/Edge install prompt (Windows, Android, Mac)
    const handler = (e: Event) => {
      e.preventDefault();
      deferredPrompt.current = e as BeforeInstallPromptEvent;
      setState("ready");
    };
    window.addEventListener("beforeinstallprompt", handler);

    // Fallback: if prompt hasn't fired after 3s on a supported browser, show anyway
    const timer = setTimeout(() => {
      if (state === "loading") setState("ready");
    }, 3000);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt.current) {
      // Prompt not captured yet — browser may show its own install UI via address bar
      return;
    }
    await deferredPrompt.current.prompt();
    const { outcome } = await deferredPrompt.current.userChoice;
    if (outcome === "accepted") {
      setState("installed");
    }
    deferredPrompt.current = null;
  };

  // Don't render while detecting state
  if (state === "loading") return null;

  // Already installed
  if (state === "installed") {
    return (
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "8px 16px",
          borderRadius: 8,
          border: "1.5px solid #16a34a",
          background: "#f0fdf4",
          color: "#16a34a",
          fontSize: 12,
          fontWeight: 700,
        }}
      >
        <CheckCircle size={14} />
        App Installed
      </div>
    );
  }

  // iOS — show instructions
  if (state === "ios") {
    return (
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "8px 16px",
          borderRadius: 8,
          border: "1.5px solid var(--color-primary)",
          background: "var(--color-primaryContainer, #e0f6ff)",
          color: "var(--color-onPrimaryContainer, #005a80)",
          fontSize: 12,
          fontWeight: 600,
        }}
      >
        <Smartphone size={14} />
        Tap Share → Add to Home Screen to install
      </div>
    );
  }

  // Ready to install (Chrome / Edge on Windows, Android, Mac)
  return (
    <button
      onClick={handleInstall}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "10px 22px",
        borderRadius: 10,
        border: "1.5px solid var(--color-primary)",
        background: "var(--color-primary)",
        color: "var(--color-on-primary, #fff)",
        fontSize: 13,
        fontWeight: 700,
        cursor: "pointer",
        transition: "opacity 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease",
        boxShadow: "0 2px 12px rgba(0,0,0,0.12)",
        letterSpacing: "0.01em",
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLButtonElement;
        el.style.opacity = "0.88";
        el.style.transform = "translateY(-1px)";
        el.style.boxShadow = "0 4px 16px rgba(0,0,0,0.18)";
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLButtonElement;
        el.style.opacity = "1";
        el.style.transform = "translateY(0)";
        el.style.boxShadow = "0 2px 12px rgba(0,0,0,0.12)";
      }}
    >
      <Download size={15} />
      Install App
    </button>
  );
}
