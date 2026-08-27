"use client";

import { signStageFileDownloadAction, type StageFileKind } from "@/features/designs/actions/stageFileDownloadActions";

export type { StageFileKind };

export async function downloadStageFile(params: {
  orderId: string;
  fileId: string;
  kind: StageFileKind;
  fileName: string;
}): Promise<{ downloadCount: number; remaining: number }> {
  const result = await signStageFileDownloadAction({
    orderId: params.orderId,
    fileId: params.fileId,
    kind: params.kind,
  });

  if (result.error || !result.url) {
    throw new Error(result.error || "Download failed");
  }

  const response = await fetch(result.url);
  if (!response.ok) {
    throw new Error("Download failed. Please try again.");
  }

  const blob = await response.blob();
  const blobUrl = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = params.fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(blobUrl);

  return {
    downloadCount: result.downloadCount ?? 0,
    remaining: result.remaining ?? 0,
  };
}
