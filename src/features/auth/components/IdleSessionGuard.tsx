"use client";

import { useEffect, useRef } from "react";
import { signOut } from "@/features/auth/actions/authActions";
import { withBasePath } from "@/lib/appBasePath";

const IDLE_MS = 10 * 60 * 1000; // 10 minutes
/** Ignore noisy mousemove — only count deliberate interaction. */
const ACTIVITY_EVENTS: (keyof WindowEventMap)[] = [
  "mousedown",
  "keydown",
  "touchstart",
  "click",
  "scroll",
];
/** Don't reset the idle timer more often than this (avoids thrash on scroll). */
const RESET_THROTTLE_MS = 30_000;

type IdleSessionGuardProps = {
  /** Where to send the user after idle logout. */
  loginPath: string;
};

/**
 * Signs the user out after 10 minutes with no deliberate activity.
 * Does not react to navigation/request volume — only user input idle time.
 */
export function IdleSessionGuard({ loginPath }: IdleSessionGuardProps) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastResetRef = useRef(0);
  const loggingOutRef = useRef(false);

  useEffect(() => {
    const logout = async () => {
      if (loggingOutRef.current) return;
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        // Tab in background — re-arm; logout only while the tab is visible.
        armTimer();
        return;
      }
      loggingOutRef.current = true;
      try {
        await signOut();
      } finally {
        window.location.href = withBasePath(loginPath);
      }
    };

    const armTimer = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        void logout();
      }, IDLE_MS);
    };

    const onActivity = () => {
      const now = Date.now();
      if (now - lastResetRef.current < RESET_THROTTLE_MS) return;
      lastResetRef.current = now;
      armTimer();
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") onActivity();
    };

    armTimer();
    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, onActivity, { passive: true });
    }
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, onActivity);
      }
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [loginPath]);

  return null;
}
