"use server";

import { getCurrentUser } from "@/features/auth/actions/authActions";
import { createAdminClient } from "@/utils/supabase/admin";
import { parseStoredRef } from "@/utils/storage/storageRef";
import { signReadUrl } from "@/utils/supabase/storageSignRead";
import {
  STAGE_FILE_MAX_DOWNLOADS,
  stageFileErrors,
  type StageFileEntry,
} from "@/utils/supabase/storageConfig";

export type StageFileKind = "design" | "production";

export interface SignStageFileDownloadResult {
  url?: string;
  downloadCount?: number;
  remaining?: number;
  error?: string;
}

type DesignItemRow = {
  id: string;
  name?: string;
  designFiles?: StageFileEntry[];
  productionFiles?: StageFileEntry[];
};

function findFileInItems(
  items: DesignItemRow[],
  fileId: string,
  kind: StageFileKind
): { itemIndex: number; fileIndex: number; file: StageFileEntry } | null {
  for (let i = 0; i < items.length; i++) {
    const list = kind === "design" ? items[i].designFiles : items[i].productionFiles;
    if (!list) continue;
    const fileIndex = list.findIndex((f) => f.id === fileId);
    if (fileIndex >= 0) {
      return { itemIndex: i, fileIndex, file: list[fileIndex] };
    }
  }
  return null;
}

export async function signStageFileDownloadAction(input: {
  orderId: string;
  fileId: string;
  kind: StageFileKind;
}): Promise<SignStageFileDownloadResult> {
  const user = await getCurrentUser();
  if (!user) {
    return { error: "Session expired. Please log in again." };
  }
  if (user.role !== "admin" && user.role !== "staff") {
    return { error: "Unauthorized" };
  }

  const orderId = String(input.orderId || "").trim();
  const fileId = String(input.fileId || "").trim();
  if (!orderId || !fileId) {
    return { error: "Invalid download request" };
  }

  const admin = createAdminClient();
  if (!admin) return { error: "Server not configured" };

  const { data: design, error: loadErr } = await admin
    .from("designs")
    .select("id, items, updated_at")
    .eq("order_id", orderId)
    .maybeSingle();

  if (loadErr) return { error: loadErr.message };
  if (!design) return { error: "Design record not found" };

  const items = (design.items ?? []) as DesignItemRow[];
  const located = findFileInItems(items, fileId, input.kind);
  if (!located) return { error: "File not found" };

  const { file, itemIndex, fileIndex } = located;
  const currentCount = file.downloadCount ?? 0;
  if (currentCount >= STAGE_FILE_MAX_DOWNLOADS) {
    return { error: stageFileErrors.downloadLimitReached(file.name) };
  }

  const parsed = parseStoredRef(file.url);
  if (!parsed) return { error: "Invalid file reference" };

  const nextCount = currentCount + 1;
  const updatedItems = items.map((item, i) => {
    if (i !== itemIndex) return item;
    const key = input.kind === "design" ? "designFiles" : "productionFiles";
    const list = [...(item[key] ?? [])];
    list[fileIndex] = { ...list[fileIndex], downloadCount: nextCount };
    return { ...item, [key]: list };
  });

  const { error: updateErr } = await admin
    .from("designs")
    .update({ items: updatedItems, updated_at: new Date().toISOString() })
    .eq("id", design.id)
    .eq("updated_at", design.updated_at);

  if (updateErr) {
    return { error: "Could not record download. Please try again." };
  }

  try {
    const url = await signReadUrl(parsed.bucket, parsed.path);
    return {
      url,
      downloadCount: nextCount,
      remaining: STAGE_FILE_MAX_DOWNLOADS - nextCount,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Could not create download link";
    return { error: message };
  }
}
