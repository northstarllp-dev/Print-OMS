"use client";

import React, { useState } from "react";
import { Eye, EyeOff, ArrowLeft, Shield, Users, Factory, Wrench } from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { PlatformMadeWithLove } from "@/components/ui/PlatformMadeWithLove";
import { PrintomsLoading } from "@/components/ui/PrintomsLoading";
import { withBasePath } from "@/lib/appBasePath";
import { AuthAtmosphere } from "@/features/auth/components/AuthAtmosphere";

export type AuthPortalKind = "admin" | "staff" | "production" | "installation";

const PORTAL_META: Record<
  AuthPortalKind,
  { badge: string; Icon: typeof Shield; panelTitle: string; panelLine: string }
> = {
  admin: {
    badge: "Admin",
    Icon: Shield,
    panelTitle: "Jobs slip when status lives in chats",
    panelLine: "See stuck stages, money, and people in one desk  before the customer chases you.",
  },
  staff: {
    badge: "Staff",
    Icon: Users,
    panelTitle: "Field work dies in someone else’s phone",
    panelLine: "Open the assigned job, not a WhatsApp thread. Site notes and files stay on the order.",
  },
  production: {
    badge: "Production",
    Icon: Factory,
    panelTitle: "The press waits while files hide",
    panelLine: "Pull approved artwork from the order, tick the checklist, and flag blockers before the install date slips.",
  },
  installation: {
    badge: "Installation",
    Icon: Wrench,
    panelTitle: "Crews shouldn’t arrive blind",
    panelLine: "Site photos, size, and address sit on the job. Close the install without calling the office.",
  },
};

export interface AuthLoginFormProps {
  portal: AuthPortalKind;
  title: string;
  subtitle: string;
  emailId: string;
  passwordId: string;
  emailPlaceholder?: string;
  submitLabel: string;
  backHref?: string;
  onSignIn: (email: string, password: string) => Promise<{ error?: string } | void>;
}

export function AuthLoginForm({
  portal,
  title,
  subtitle,
  emailId,
  passwordId,
  emailPlaceholder = "you@company.com",
  submitLabel,
  backHref = "/printoms",
  onSignIn,
}: AuthLoginFormProps) {
  const meta = PORTAL_META[portal];
  const Icon = meta.Icon;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await onSignIn(email, password);
      if (res && "error" in res && res.error) {
        setError(res.error);
        setLoading(false);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred.");
      setLoading(false);
    }
  };

  const goBack = () => {
    const path = backHref.startsWith("/printoms")
      ? backHref
      : withBasePath(backHref.startsWith("/") ? backHref : `/${backHref}`);
    window.location.href = path;
  };

  return (
    <div className="relative min-h-[100dvh] font-[family-name:var(--font-sans)] text-slate-900 antialiased">
      {loading && <PrintomsLoading fullScreen />}

      <div className="flex min-h-[100dvh] w-full flex-col lg:grid lg:grid-cols-[minmax(280px,42%)_1fr]">
        <aside className="relative isolate min-h-[auto] overflow-hidden bg-[#070B14] px-4 pb-6 pt-[max(1rem,env(safe-area-inset-top))] text-white sm:px-6 lg:flex lg:min-h-[100dvh] lg:flex-col lg:justify-between lg:px-12 lg:py-12 xl:px-16">
          <div
            className="pointer-events-none absolute inset-0"
            aria-hidden
            style={{
              background:
                "radial-gradient(90% 70% at 0% 0%, rgba(37,99,235,0.72) 0%, transparent 55%), radial-gradient(70% 55% at 100% 100%, rgba(249,115,22,0.38) 0%, transparent 52%), linear-gradient(165deg, #070B14 0%, #0B1220 42%, #111827 100%)",
            }}
          />
          <div
            className="pointer-events-none absolute -right-10 top-12 hidden h-44 w-44 rounded-full border border-white/10 lg:block"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute -right-4 top-[4.5rem] hidden h-24 w-24 rounded-full border border-orange-400/35 lg:block"
            aria-hidden
          />

          <div className="relative z-10 flex items-center justify-between gap-3">
            <div className="inline-flex max-w-[min(100%,360px)] items-center rounded-2xl bg-white px-3 py-2 sm:px-3.5 sm:py-2.5">
              <Logo fit="hug" height={72} applyScale align="left" />
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-slate-100 lg:hidden">
              <Icon size={12} aria-hidden />
              {meta.badge}
            </span>
          </div>

          <div className="relative z-10 mt-5 hidden lg:mt-0 lg:block">
            <span className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-slate-100">
              <Icon size={14} aria-hidden />
              {meta.badge} portal
            </span>
            <h1 className="max-w-sm text-3xl font-extrabold leading-tight tracking-tight text-white xl:text-[2.15rem]">
              {meta.panelTitle}
            </h1>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-slate-300">{meta.panelLine}</p>
            <ul className="mt-8 space-y-3 text-sm text-slate-300">
              <li className="flex items-start gap-2.5">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#F97316]" />
                One order  not five chat threads
              </li>
              <li className="flex items-start gap-2.5">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#60A5FA]" />
                Files stay on the job they belong to
              </li>
              <li className="flex items-start gap-2.5">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#34D399]" />
                Deadlines visible before they slip
              </li>
            </ul>
          </div>

          <p className="relative z-10 mt-4 hidden text-xs text-slate-500 lg:block">PrintOMS  print ops, without the chase</p>
        </aside>

        <main className="relative flex flex-1 flex-col justify-center px-4 py-6 sm:px-6 sm:py-10 lg:px-12 lg:py-12">
          <AuthAtmosphere intensity="rich" />
          <div className="mx-auto w-full max-w-[420px]">
            <button
              type="button"
              onClick={goBack}
              className="mb-5 inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-lg px-1 py-1 text-xs font-semibold text-slate-500 transition-colors duration-200 hover:text-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1E40AF]"
            >
              <ArrowLeft size={14} aria-hidden />
              Back to portal select
            </button>

            <div className="rounded-2xl border border-slate-200/90 bg-white/95 p-4 shadow-[0_12px_40px_-14px_rgba(15,23,42,0.2)] sm:p-7">
              <div className="mb-5">
                <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-[#1E40AF]">
                  {meta.badge} sign in
                </p>
                <h2 className="text-[1.45rem] font-extrabold tracking-tight text-slate-900 sm:text-2xl">{title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{subtitle}</p>
              </div>

              {error ? (
                <div
                  role="alert"
                  className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm font-semibold text-rose-800"
                >
                  {error}
                </div>
              ) : null}

              <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
                <div>
                  <label htmlFor={emailId} className="mb-1.5 block text-xs font-bold tracking-wide text-slate-700">
                    Email address
                  </label>
                  <input
                    id={emailId}
                    name="email"
                    type="email"
                    autoComplete="email"
                    inputMode="email"
                    required
                    disabled={loading}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={emailPlaceholder}
                    className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-base text-slate-900 outline-none transition-[border-color,box-shadow,background] duration-200 placeholder:text-slate-400 focus:border-[#1E40AF] focus:bg-white focus:ring-4 focus:ring-[#1E40AF]/15 disabled:opacity-60 sm:text-sm"
                  />
                </div>

                <div>
                  <label htmlFor={passwordId} className="mb-1.5 block text-xs font-bold tracking-wide text-slate-700">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      id={passwordId}
                      name="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      required
                      disabled={loading}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 pr-12 text-base text-slate-900 outline-none transition-[border-color,box-shadow,background] duration-200 placeholder:text-slate-400 focus:border-[#1E40AF] focus:bg-white focus:ring-4 focus:ring-[#1E40AF]/15 disabled:opacity-60 sm:text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((p) => !p)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 cursor-pointer items-center justify-center rounded-lg text-slate-400 transition-colors duration-200 hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1E40AF]"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="mt-1 inline-flex h-12 w-full cursor-pointer items-center justify-center rounded-xl bg-[#1E40AF] px-4 text-sm font-bold text-white transition-[background-color,box-shadow] duration-200 hover:bg-[#1D4ED8] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1E40AF] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? "Signing in…" : submitLabel}
                </button>
              </form>
            </div>

            <div className="mt-6 pb-[max(1rem,env(safe-area-inset-bottom))] text-center text-xs text-slate-500">
              <PlatformMadeWithLove />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
