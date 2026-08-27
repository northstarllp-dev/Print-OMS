import { createAdminClient } from "@/utils/supabase/admin";
import type { StageFileItemLike } from "@/utils/supabase/storageConfig";
import {
  formatStageFileMb,
  isStageFilePurpose,
  stageFileErrors,
  sumStageFileBytes,
  wouldExceedItemTotal,
} from "@/utils/supabase/storageConfig";
import type { StorageUploadPurpose } from "@/utils/supabase/serverStorageUpload";

function findDesignItem(
  items: StageFileItemLike[] | null | undefined,
  itemId: string
): StageFileItemLike | undefined {
  if (!Array.isArray(items)) return undefined;
  return items.find((i) => (i as { id?: string }).id === itemId) as
    | StageFileItemLike
    | undefined;
}

/**
 * Enforce the 500 MB per-item cap for design source + production uploads.
 * Requires itemId when purpose is design_source_file or production_asset.
 */
export async function assertStageItemUploadQuota(
  purpose: StorageUploadPurpose,
  orderId: string,
  itemId: string | undefined,
  fileName: string,
  size: number
): Promise<void> {
  if (!isStageFilePurpose(purpose)) return;
  if (!itemId?.trim()) {
    throw new Error("Missing itemId for design or production file upload");
  }

  const admin = createAdminClient();
  if (!admin) throw new Error("Server not configured");

  const { data, error } = await admin
    .from("designs")
    .select("items")
    .eq("order_id", orderId)
    .maybeSingle();

  if (error) throw new Error(error.message);

  const items = (data?.items ?? []) as StageFileItemLike[];
  const item = findDesignItem(items, itemId);
  const itemName = (item as { name?: string } | undefined)?.name?.trim() || "This item";
  const usedBytes = item ? sumStageFileBytes(item) : 0;

  if (item && wouldExceedItemTotal(item, size)) {
    throw new Error(
      stageFileErrors.itemTotalExceeded({
        itemName,
        usedMb: formatStageFileMb(usedBytes),
        fileName,
        fileMb: formatStageFileMb(size),
      })
    );
  }
}
