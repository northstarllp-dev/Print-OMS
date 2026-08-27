"use client";

import React from "react";
import { FileText } from "lucide-react";
import {
  STAGE_FILE_MAX_DOWNLOADS,
  STAGE_ITEM_TOTAL_MAX_BYTES,
  stageFileErrors,
  type StageFileEntry,
} from "@/utils/supabase/storageConfig";
import { fileExtensionLabel } from "@/features/orders/workspace/modules/production/productionFilesUi";
import { downloadStageFile, type StageFileKind } from "@/utils/storage/stageFileDownload";

export function StageFileUsageBar({
  usedBytes,
}: {
  usedBytes: number;
}) {
  const usedMb = Math.round((usedBytes / (1024 * 1024)) * 10) / 10;
  const totalMb = STAGE_ITEM_TOTAL_MAX_BYTES / (1024 * 1024);
  const pct = Math.min(100, Math.round((usedBytes / STAGE_ITEM_TOTAL_MAX_BYTES) * 100));
  const atCapacity = usedBytes >= STAGE_ITEM_TOTAL_MAX_BYTES;
  const warn = pct > 80 && !atCapacity;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-[11px] font-semibold text-slate-600">
        <span>Stage files: {usedMb} MB / {totalMb} MB used</span>
        <span className={atCapacity ? "text-red-600" : warn ? "text-amber-600" : "text-slate-500"}>
          {pct}%
        </span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-slate-200 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${
            atCapacity ? "bg-red-500" : warn ? "bg-amber-500" : "bg-emerald-500"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {atCapacity && (
        <p className="text-[11px] font-semibold text-red-600">
          {stageFileErrors.itemLimitReachedInline()}
        </p>
      )}
    </div>
  );
}

export function StageFileCard({
  file,
  accent,
  orderId,
  kind,
  onDownloadCountChange,
}: {
  file: StageFileEntry;
  accent: "violet" | "blue";
  orderId: string;
  kind: StageFileKind;
  onDownloadCountChange?: (fileId: string, downloadCount: number) => void;
}) {
  const [downloading, setDownloading] = React.useState(false);
  const ext = fileExtensionLabel(file.name);
  const isViolet = accent === "violet";
  const used = file.downloadCount ?? 0;
  const remaining = Math.max(0, STAGE_FILE_MAX_DOWNLOADS - used);
  const exhausted = used >= STAGE_FILE_MAX_DOWNLOADS;

  const handleDownload = async () => {
    if (exhausted || downloading) return;
    setDownloading(true);
    try {
      const result = await downloadStageFile({
        orderId,
        fileId: file.id,
        kind,
        fileName: file.name,
      });
      onDownloadCountChange?.(file.id, result.downloadCount);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Download failed";
      window.alert(message);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div
      className={`border border-slate-200 rounded-xl p-4 flex flex-col items-center justify-center bg-white shadow-sm text-center gap-2 transition-colors ${
        isViolet ? "hover:border-violet-300" : "hover:border-blue-300"
      }`}
    >
      <div
        className={`w-12 h-12 rounded-lg flex items-center justify-center font-black text-xs mb-1 ${
          isViolet ? "bg-violet-50 text-violet-600" : "bg-blue-50 text-blue-600"
        }`}
      >
        {ext !== "FILE" ? ext : <FileText size={20} className={isViolet ? "text-violet-500" : "text-blue-500"} />}
      </div>
      <span className="text-xs font-bold text-slate-700 truncate w-full" title={file.name}>
        {file.name || "Untitled file"}
      </span>
      <span
        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
          exhausted
            ? "bg-red-50 text-red-700 border border-red-200"
            : "bg-slate-100 text-slate-600"
        }`}
      >
        {exhausted
          ? `Limit reached (${STAGE_FILE_MAX_DOWNLOADS}/${STAGE_FILE_MAX_DOWNLOADS})`
          : `Downloads left: ${remaining}/${STAGE_FILE_MAX_DOWNLOADS}`}
      </span>
      <button
        type="button"
        disabled={exhausted || downloading}
        title={exhausted ? `${STAGE_FILE_MAX_DOWNLOADS} of ${STAGE_FILE_MAX_DOWNLOADS} downloads used` : "Download file"}
        onClick={() => void handleDownload()}
        className={`mt-1 px-4 py-1.5 text-white rounded-lg text-xs font-bold transition-colors w-full shadow-sm disabled:opacity-50 disabled:cursor-not-allowed ${
          isViolet ? "bg-violet-600 hover:bg-violet-700" : "bg-blue-600 hover:bg-blue-700"
        }`}
      >
        {downloading ? "Downloading…" : "Download"}
      </button>
    </div>
  );
}
