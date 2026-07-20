"use client";

import React from "react";
import { Link2 } from "lucide-react";

interface CopyLinkButtonProps {
  companyId: string;
}

export function CopyLinkButton({ companyId }: CopyLinkButtonProps) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = async () => {
    const base =
      typeof window !== "undefined" ? window.location.origin : "";
    const shareLink = `${base}/printoms/service-ticket/${companyId}`;
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
      onClick={handleCopy}
      style={{
        padding: "10px 14px",
        background: copied ? "#dcfce7" : "#f1f5f9",
        color: copied ? "#166534" : "#475569",
        border: "1px solid #cbd5e1",
        borderRadius: "8px",
        fontSize: "13px",
        fontWeight: 700,
        display: "inline-flex",
        alignItems: "center",
        gap: "8px",
        cursor: "pointer",
      }}
    >
      <Link2 size={16} />
      {copied ? "Link Copied" : "Copy Link"}
    </button>
  );
}

