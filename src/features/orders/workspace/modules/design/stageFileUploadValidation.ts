"use client";

import type { StageFileItemLike } from "@/utils/supabase/storageConfig";
import {
  formatStageFileMb,
  isItemAtStageCapacity,
  isStageFilePurpose,
  stageFileErrors,
  sumStageFileBytes,
  validateUploadForPurpose,
  wouldExceedItemTotal,
} from "@/utils/supabase/storageConfig";
import type { StorageUploadPurpose } from "@/utils/supabase/serverStorageUpload";

export function validateStageFilesBeforeUpload(
  files: File[],
  item: StageFileItemLike & { name?: string },
  purpose: StorageUploadPurpose
): string | null {
  if (!isStageFilePurpose(purpose)) return null;

  const itemName = item.name?.trim() || "This item";

  if (isItemAtStageCapacity(item)) {
    return stageFileErrors.itemAtCapacity(itemName);
  }

  let additionalBytes = 0;
  for (const file of files) {
    const validation = validateUploadForPurpose(purpose, {
      fileName: file.name,
      size: file.size,
      mime: file.type,
    });
    if (!validation.ok) return validation.message;

    if (wouldExceedItemTotal(item, additionalBytes + file.size)) {
      return stageFileErrors.itemTotalExceeded({
        itemName,
        usedMb: formatStageFileMb(sumStageFileBytes(item) + additionalBytes),
        fileName: file.name,
        fileMb: formatStageFileMb(file.size),
      });
    }
    additionalBytes += file.size;
  }

  return null;
}
