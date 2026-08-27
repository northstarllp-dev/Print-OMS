import React from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Shield, Users, ArrowRight, ClipboardList, Timer } from "lucide-react";
import { getCurrentUser } from "@/features/auth/actions/authActions";
import { getStaffHomePath } from "@/features/orders/workspace/shared/stageGrants";
import { Logo } from "@/components/ui/Logo";
import { PlatformMadeWithLove } from "@/components/ui/PlatformMadeWithLove";
import { InstallPwaButton } from "@/components/pwa/InstallPwaButton";
import { AuthAtmosphere } from "@/features/auth/components/AuthAtmosphere";

export default async function RootGateway() {
  const profile = await getCurrentUser();

  if (profile) {
    const actor = {
      role: profile.role,
      staff_role: profile.staff_role ?? null,
      company_id: profile.company_id ?? null,
    };
    if (profile.role === "admin") {
      redirect("/admin/dashboard");
    }
    redirect(getStaffHomePath(actor));
  }

  return (
    <div className="relative flex min-h-[100dvh] flex-col font-[family-name:var(--font-sans)] text-slate-900 antialiased">
      <AuthAtmosphere intensity="rich" />

      <header className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-4 pb-2 pt-[max(1rem,env(safe-area-inset-top))] sm:px-6 lg:px-8">
        <div className="inline-flex max-w-[min(100%,380px)] items-center rounded-2xl bg-white px-3 py-2 shadow-sm ring-1 ring-slate-200/80 sm:px-3.5 sm:py-2.5">
          <Logo fit="hug" height={72} applyScale align="left" />
        </div>
        <div className="max-w-full shrink-0 [&_button]:max-w-full [&_button]:text-xs sm:[&_button]:text-[13px]">
          <InstallPwaButton />
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-4 py-6 sm:px-6 lg:flex-row lg:items-center lg:gap-14 lg:px-8 lg:py-10">
        <section className="mb-8 max-w-xl lg:mb-0 lg:w-[48%] lg:shrink-0">
          <p className="mb-3 inline-flex items-center rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-[#1E40AF]">
            Print operations
          </p>
          <h1 className="text-[1.75rem] font-extrabold leading-[1.15] tracking-tight text-slate-900 sm:text-4xl lg:text-[2.75rem]">
            Stop chasing jobs across chats, sheets, and the floor
          </h1>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-slate-600 sm:text-base">
            Signage work breaks in the handoffs  enquiry, site visit, design, production, install. PrintOMS keeps one order trail so proofs, files, and dates don’t go missing.
          </p>
          <ul className="mt-6 hidden gap-5 text-sm text-slate-600 sm:flex">
            <li className="flex items-center gap-2">
              <ClipboardList size={16} className="text-[#1E40AF]" aria-hidden />
              No silent stage gaps
            </li>
            <li className="flex items-center gap-2">
              <Timer size={16} className="text-[#F97316]" aria-hidden />
              Deadlines you can actually see
            </li>
          </ul>
        </section>

        <section className="grid w-full gap-3 sm:grid-cols-2 lg:w-[52%] lg:gap-4">
          <Link
            href="/admin/login"
            className="group flex min-h-[168px] cursor-pointer flex-col rounded-2xl border border-slate-200/90 bg-white/90 p-5 shadow-[0_10px_30px_-16px_rgba(15,23,42,0.2)] backdrop-blur-sm transition-[border-color,box-shadow] duration-200 hover:border-[#1E40AF]/40 hover:shadow-[0_14px_36px_-14px_rgba(30,64,175,0.28)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1E40AF] sm:min-h-[220px] sm:p-6"
          >
            <span className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[#1E40AF] text-white">
              <Shield size={18} aria-hidden />
            </span>
            <h2 className="text-base font-extrabold text-slate-900">Admin Portal</h2>
            <p className="mt-1.5 flex-1 text-sm leading-relaxed text-slate-600">
              Catch stuck jobs, unpaid bills, and team bottlenecks before the customer has to call.
            </p>
            <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-[#1E40AF]">
              Go to Admin Login
              <ArrowRight size={14} className="transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden />
            </span>
          </Link>

          <Link
            href="/staff/login"
            className="group flex min-h-[168px] cursor-pointer flex-col rounded-2xl border border-slate-200/90 bg-white/90 p-5 shadow-[0_10px_30px_-16px_rgba(15,23,42,0.2)] backdrop-blur-sm transition-[border-color,box-shadow] duration-200 hover:border-[#F97316]/45 hover:shadow-[0_14px_36px_-14px_rgba(249,115,22,0.22)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1E40AF] sm:min-h-[220px] sm:p-6"
          >
            <span className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[#0B1220] text-white">
              <Users size={18} aria-hidden />
            </span>
            <h2 className="text-base font-extrabold text-slate-900">Staff Portal</h2>
            <p className="mt-1.5 flex-1 text-sm leading-relaxed text-slate-600">
              Today’s visits and measurements live on the job  not buried in someone’s chat.
            </p>
            <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-slate-800">
              Go to Staff Login
              <ArrowRight size={14} className="transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden />
            </span>
          </Link>
        </section>
      </main>

      <footer className="mx-auto w-full max-w-6xl px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4 text-center text-xs text-slate-500 sm:px-6 lg:px-8">
        <PlatformMadeWithLove variant="gateway" />
      </footer>
    </div>
  );
}
