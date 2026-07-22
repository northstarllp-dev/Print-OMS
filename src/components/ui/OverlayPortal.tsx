"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

interface OverlayPortalProps {
  children: React.ReactNode;
  lockScroll?: boolean;
}

/** Renders children on document.body above app chrome (sticky footers, overflow parents). */
export function OverlayPortal({ children, lockScroll = true }: OverlayPortalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || !lockScroll) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [mounted, lockScroll]);

  if (!mounted || typeof document === "undefined") return null;
  return createPortal(children, document.body);
}
