"use client";

import React, { useEffect, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { KeyRound, Lock } from "lucide-react";

const DEV_ACCESS_STORAGE_KEY = "printoms_dev_module_access";
const DEV_ACCESS_PASSWORD = "hariakshay";

interface ComingSoonPageProps {
  title: string;
  description: string;
  icon: LucideIcon;
  /** Real module UI shown after password unlock. */
  children?: React.ReactNode;
}

function readUnlocked(): boolean {
  try {
    return window.localStorage.getItem(DEV_ACCESS_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function ComingSoonPage({
  title,
  description,
  icon: Icon,
  children,
}: ComingSoonPageProps) {
  const [ready, setReady] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setUnlocked(readUnlocked());
    setReady(true);
  }, []);

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (password.trim() !== DEV_ACCESS_PASSWORD) {
      setError("Incorrect password");
      return;
    }
    try {
      window.localStorage.setItem(DEV_ACCESS_STORAGE_KEY, "1");
    } catch {
      // ignore storage failures — still unlock this session
    }
    setUnlocked(true);
    setError("");
    setPassword("");
    setShowPassword(false);
  };

  if (!ready) {
    return (
      <div className="p-3 sm:p-5 md:p-8 bg-slate-50 min-h-screen flex items-center justify-center">
        <div className="text-sm font-semibold text-slate-400">Loading…</div>
      </div>
    );
  }

  if (unlocked) {
    if (children) return <>{children}</>;
    return (
      <div className="p-3 sm:p-5 md:p-8 bg-slate-50 min-h-screen flex items-center justify-center">
        <div className="w-full max-w-lg text-center bg-white border border-slate-200 rounded-2xl px-6 py-12 sm:px-10 shadow-sm">
          <div className="mx-auto mb-5 w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center">
            <Icon size={26} className="text-emerald-600" />
          </div>
          <h1 className="m-0 mb-3 text-xl sm:text-2xl font-extrabold text-slate-900">
            {title}
          </h1>
          <p className="m-0 text-sm text-slate-500 leading-relaxed">
            Access granted. This module UI is still being finished.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-5 md:p-8 bg-slate-50 min-h-screen flex items-center justify-center">
      <div className="w-full max-w-lg text-center bg-white border border-slate-200 rounded-2xl px-6 py-12 sm:px-10 shadow-sm">
        <div className="mx-auto mb-5 w-14 h-14 rounded-2xl bg-[rgba(30,64,175,0.08)] flex items-center justify-center">
          <Icon size={26} className="text-[var(--color-primary,#1E40AF)]" />
        </div>
        <p className="m-0 mb-2 text-[11px] font-extrabold uppercase tracking-[0.14em] text-amber-600">
          Under development
        </p>
        <h1 className="m-0 mb-3 text-xl sm:text-2xl font-extrabold text-slate-900">
          {title}
        </h1>
        <p className="m-0 text-sm text-slate-500 leading-relaxed">
          {description}
        </p>

        {!showPassword ? (
          <button
            type="button"
            onClick={() => {
              setShowPassword(true);
              setError("");
            }}
            className="mt-8 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-[var(--color-primary,#1E40AF)] hover:opacity-90 transition-opacity"
          >
            <KeyRound size={14} />
            Get Access
          </button>
        ) : (
          <form onSubmit={handleUnlock} className="mt-8 text-left space-y-3">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Access password
            </label>
            <div className="relative">
              <Lock
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="password"
                autoFocus
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError("");
                }}
                placeholder="Enter password"
                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
              />
            </div>
            {error ? (
              <p className="m-0 text-xs font-semibold text-rose-600">{error}</p>
            ) : null}
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setShowPassword(false);
                  setPassword("");
                  setError("");
                }}
                className="px-3 py-2 rounded-lg text-xs font-bold text-slate-500 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg text-xs font-bold text-white bg-[var(--color-primary,#1E40AF)] hover:opacity-90"
              >
                Unlock
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
