"use client";

import React from "react";
import { Eye, Download } from "lucide-react";
import { OrderImage } from "@/components/storage/OrderImage";
import { parseStoredRef } from "@/utils/storage/storageRef";
import { getSignedReadUrl } from "@/utils/storage/signedReadCache";

async function openSigned(refOrUrl: string, download = false) {
  const parsed = parseStoredRef(refOrUrl);
  const href = parsed
    ? await getSignedReadUrl(parsed.bucket, parsed.path)
    : refOrUrl;
  if (download) {
    const a = document.createElement("a");
    a.href = href;
    a.download = "";
    a.target = "_blank";
    a.rel = "noreferrer";
    document.body.appendChild(a);
    a.click();
    a.remove();
    return;
  }
  window.open(href, "_blank", "noopener,noreferrer");
}

/** Compact photo tile that works with private bucket refs and legacy public URLs. */
export function TicketPhotoThumb({
  url,
  name,
  onRemove,
  canRemove,
}: {
  url: string;
  name?: string;
  onRemove?: () => void;
  canRemove?: boolean;
}) {
  return (
    <div className="group relative w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden border border-[var(--color-outline-variant)] shadow-sm">
      <OrderImage src={url} width={200} alt={name || "Photo"} className="w-full h-full object-cover" />
      <div className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 absolute inset-0 bg-slate-900/70 flex items-center justify-center gap-1.5 transition-opacity">
        <button
          type="button"
          onClick={() => void openSigned(url)}
          className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center text-white hover:bg-white/40"
          title="View"
        >
          <Eye size={14} />
        </button>
        <button
          type="button"
          onClick={() => void openSigned(url, true)}
          className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center text-white hover:bg-white/40"
          title="Download"
        >
          <Download size={14} />
        </button>
        {canRemove && onRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="w-7 h-7 rounded-full bg-red-500/80 flex items-center justify-center text-white hover:bg-red-500"
            title="Remove"
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
}
