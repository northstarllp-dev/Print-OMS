"use client";

import React from "react";
import { Link2 } from "lucide-react";
import { loadClientConfig } from "@/config/loadClientConfig";
import { withBasePath } from "@/lib/appBasePath";
import { resolvePublicCompanyId } from "@/features/service-tickets/resolvePublicCompanyId";

interface CopyLinkButtonProps {
  /** Company UUID preferred; slug is accepted and resolved to UUID. */
  companyId: string;
}

export function CopyLinkButton({ companyId }: CopyLinkButtonProps) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = async () => {
    const resolved =
      resolvePublicCompanyId(companyId) || loadClientConfig().companyId;
    if (!resolved) {
      alert("Unable to build portal link: company is not configured.");
      return;
    }
    const base =
      typeof window !== "undefined" ? window.location.origin : "";
    const shareLink = `${base}${withBasePath(`/service-ticket/${resolved}`)}`;
    try {
      await navigator.clipboard.writeText(shareLink);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      alert("Unable to copy link. Please copy manually.");
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      title={copied ? "Link copied" : "Copy public ticket link"}
      className={`inline-flex items-center justify-center gap-1.5 shrink-0 whitespace-nowrap rounded-lg border px-2.5 sm:px-3.5 py-2 text-[12px] sm:text-[13px] font-bold transition-colors ${
        copied
          ? "bg-emerald-50 border-emerald-200 text-emerald-800"
          : "bg-slate-100 border-slate-300 text-slate-600 hover:bg-slate-200"
      }`}
    >
      <Link2 size={15} className="shrink-0" />
      {copied ? "Copied" : "Copy"}
    </button>
  );
}
