import type { LucideIcon } from "lucide-react";

interface ComingSoonPageProps {
  title: string;
  description: string;
  icon: LucideIcon;
}

export function ComingSoonPage({ title, description, icon: Icon }: ComingSoonPageProps) {
  return (
    <div className="p-3 sm:p-5 md:p-8 bg-slate-50 min-h-screen flex items-center justify-center">
      <div className="w-full max-w-lg text-center bg-white border border-slate-200 rounded-2xl px-6 py-12 sm:px-10 shadow-sm">
        <div className="mx-auto mb-5 w-14 h-14 rounded-2xl bg-[rgba(30,64,175,0.08)] flex items-center justify-center">
          <Icon size={26} className="text-[var(--color-primary,#1E40AF)]" />
        </div>
        <p className="m-0 mb-2 text-[11px] font-extrabold uppercase tracking-[0.14em] text-[var(--color-primary,#1E40AF)]">
          Coming soon
        </p>
        <h1 className="m-0 mb-3 text-xl sm:text-2xl font-extrabold text-slate-900">
          {title}
        </h1>
        <p className="m-0 text-sm text-slate-500 leading-relaxed">
          {description}
        </p>
      </div>
    </div>
  );
}
