/**
 * Server-side storage configuration for the two upload pipelines.
 * Source of truth for bucket visibility, size limits, allowed MIME, and path scope.
 */

import type { StorageUploadPurpose } from "@/utils/supabase/serverStorageUpload";

export type StoragePipeline = "image" | "production";

export interface PurposeStorageConfig {
  purpose: StorageUploadPurpose;
  bucket: string;
  pipeline: StoragePipeline;
  /** Max bytes allowed (also mirrored at the bucket level). */
  maxBytes: number;
  /** Allowed MIME types for this purpose. */
  allowedMime: readonly string[];
  /** Extensions we accept when client MIME is missing. */
  allowedExt: readonly string[];
}

const IMAGE_50MB = 50 * 1024 * 1024;

/** Design source + production files per-file ceiling. */
export const LARGE_FILE_MAX_BYTES = 250 * 1024 * 1024;
export const STAGE_FILE_MAX_MB = 250;
export const STAGE_ITEM_TOTAL_MAX_BYTES = 500 * 1024 * 1024;
export const STAGE_ITEM_TOTAL_MAX_MB = 500;
export const STAGE_FILE_MAX_DOWNLOADS = 2;

const IMAGE_MIMES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
] as const;

const IMAGE_EXTS = ["jpg", "jpeg", "png", "webp", "gif", "heic", "heif"] as const;

export const STAGE_FILE_SECTION_HINT =
  "Max 250 MB per file · 500 MB total per item (design + production combined) · Each file downloadable 2 times to limit bandwidth";

/** Preferred upload guidance shown near design/production file uploads. */
export const STAGE_FILE_ZIP_PREFERRED_NOTE =
  "Preferred: compress or zip your files before uploading. A single .zip is faster and uses less storage.";

export interface StageFileEntry {
  id: string;
  name: string;
  url: string;
  createdAt: string;
  sizeBytes?: number;
  downloadCount?: number;
}

export interface StageFileItemLike {
  name?: string;
  designFiles?: StageFileEntry[];
  productionFiles?: StageFileEntry[];
}

export function isStageFilePurpose(purpose: StorageUploadPurpose): boolean {
  return purpose === "design_source_file" || purpose === "production_asset";
}

/** Format bytes as MB with one decimal for user-facing messages. */
export function formatStageFileMb(bytes: number): number {
  return Math.round((bytes / (1024 * 1024)) * 10) / 10;
}

export function sumStageFileBytes(item: StageFileItemLike): number {
  const files = [...(item.designFiles ?? []), ...(item.productionFiles ?? [])];
  return files.reduce((sum, f) => sum + (f.sizeBytes ?? 0), 0);
}

export function wouldExceedItemTotal(item: StageFileItemLike, additionalBytes: number): boolean {
  return sumStageFileBytes(item) + additionalBytes > STAGE_ITEM_TOTAL_MAX_BYTES;
}

export function isItemAtStageCapacity(item: StageFileItemLike): boolean {
  return sumStageFileBytes(item) >= STAGE_ITEM_TOTAL_MAX_BYTES;
}

export const stageFileErrors = {
  fileTooLarge(fileName: string, sizeMb: number): string {
    return `"${fileName}" is ${sizeMb} MB. Each design or production file can be at most ${STAGE_FILE_MAX_MB} MB. Compress the file or split it into smaller parts.`;
  },
  itemTotalExceeded(params: {
    itemName: string;
    usedMb: number;
    fileName: string;
    fileMb: number;
  }): string {
    const { itemName, usedMb, fileName, fileMb } = params;
    return `Cannot upload "${fileName}" (${fileMb} MB). "${itemName}" already uses ${usedMb} MB of the ${STAGE_ITEM_TOTAL_MAX_MB} MB limit for design + production files combined. Remove an existing file or use a smaller file.`;
  },
  itemAtCapacity(itemName: string): string {
    return `"${itemName}" has reached the ${STAGE_ITEM_TOTAL_MAX_MB} MB limit for design + production files. Delete a file before uploading more.`;
  },
  downloadLimitReached(fileName: string): string {
    return `Download limit reached for "${fileName}" (${STAGE_FILE_MAX_DOWNLOADS} of ${STAGE_FILE_MAX_DOWNLOADS} downloads used). Contact your admin if you need another copy.`;
  },
  fileTypeNotAllowed(fileName: string): string {
    return `"${fileName}" is not an allowed file type. Use .cdr, .ai, .eps, .psd, .dxf, .plt, .pdf, .svg, .zip, or common image formats.`;
  },
  fileEmpty(fileName: string): string {
    return `"${fileName}" is empty. Choose a valid file and try again.`;
  },
  itemLimitReachedInline(): string {
    return "500 MB limit reached for this item — delete a file to upload more";
  },
};

export const PURPOSE_STORAGE_CONFIG: Record<StorageUploadPurpose, PurposeStorageConfig> = {
  site_visit_photo: {
    purpose: "site_visit_photo",
    bucket: "site-visit-photos",
    pipeline: "image",
    maxBytes: IMAGE_50MB,
    allowedMime: [...IMAGE_MIMES, "application/pdf"],
    allowedExt: [...IMAGE_EXTS, "pdf"],
  },
  design_resource: {
    purpose: "design_resource",
    bucket: "order-resources",
    pipeline: "image",
    maxBytes: IMAGE_50MB,
    allowedMime: [
      ...IMAGE_MIMES,
      "image/svg+xml",
      "application/pdf",
      "application/postscript",
      "application/octet-stream",
    ],
    allowedExt: [...IMAGE_EXTS, "svg", "pdf", "ai", "eps", "psd", "cdr"],
  },
  design_proof: {
    purpose: "design_proof",
    bucket: "design-proofs",
    pipeline: "image",
    maxBytes: IMAGE_50MB,
    allowedMime: [...IMAGE_MIMES, "application/pdf"],
    allowedExt: [...IMAGE_EXTS, "pdf"],
  },
  design_source_file: {
    purpose: "design_source_file",
    bucket: "design-files",
    pipeline: "production",
    maxBytes: LARGE_FILE_MAX_BYTES,
    allowedMime: [
      ...IMAGE_MIMES,
      "image/svg+xml",
      "application/pdf",
      "application/zip",
      "application/x-zip-compressed",
      "application/postscript",
      "application/octet-stream",
      "application/dxf",
      "image/x-dxf",
      "application/plt",
    ],
    allowedExt: [...IMAGE_EXTS, "svg", "pdf", "zip", "ai", "eps", "psd", "cdr", "dxf", "plt"],
  },
  production_asset: {
    purpose: "production_asset",
    bucket: "production-files",
    pipeline: "production",
    maxBytes: LARGE_FILE_MAX_BYTES,
    allowedMime: [
      ...IMAGE_MIMES,
      "image/svg+xml",
      "application/pdf",
      "application/zip",
      "application/x-zip-compressed",
      "application/postscript",
      "application/octet-stream",
      "application/dxf",
      "image/x-dxf",
      "application/plt",
    ],
    allowedExt: [...IMAGE_EXTS, "svg", "pdf", "zip", "ai", "eps", "psd", "cdr", "dxf", "plt"],
  },
  installation_photo: {
    purpose: "installation_photo",
    bucket: "installation-photos",
    pipeline: "image",
    maxBytes: IMAGE_50MB,
    allowedMime: IMAGE_MIMES,
    allowedExt: IMAGE_EXTS,
  },
  service_ticket_photo: {
    purpose: "service_ticket_photo",
    bucket: "service-ticket-photos",
    pipeline: "image",
    maxBytes: IMAGE_50MB,
    allowedMime: IMAGE_MIMES,
    allowedExt: IMAGE_EXTS,
  },
  service_ticket_resolution_photo: {
    purpose: "service_ticket_resolution_photo",
    bucket: "service-ticket-resolution-photos",
    pipeline: "image",
    maxBytes: IMAGE_50MB,
    allowedMime: IMAGE_MIMES,
    allowedExt: IMAGE_EXTS,
  },
};

export function configForPurpose(purpose: StorageUploadPurpose): PurposeStorageConfig {
  return PURPOSE_STORAGE_CONFIG[purpose];
}

/** Buckets that remain public; all others are private and use signed URLs. */
export const PUBLIC_BUCKETS: ReadonlySet<string> = new Set(["product-images"]);

export function isPublicBucket(bucket: string): boolean {
  return PUBLIC_BUCKETS.has(bucket);
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Object key for an order-scoped upload: {orderId}/{stamp}.{ext} (stage = bucket). */
export function buildOrderObjectPath(orderId: string, ext: string): string {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${orderId}/${stamp}.${ext}`;
}

export function isValidOrderScopedPath(orderId: string, path: string): boolean {
  return UUID_RE.test(orderId) && path.startsWith(`${orderId}/`) && !path.includes("..");
}

/** Derive a lowercase file extension from a name or MIME fallback. */
export function extFromNameOrMime(fileName: string, mime?: string): string {
  const ext = (fileName.split(".").pop() || "").toLowerCase();
  if (ext && ext !== fileName.toLowerCase() && fileName.includes(".")) return ext;
  if (mime === "application/pdf") return "pdf";
  if (mime?.startsWith("image/")) return mime.split("/")[1]?.replace("jpeg", "jpg") || "jpg";
  return "bin";
}

export interface StorageValidationError {
  ok: false;
  reason: "file_type" | "file_size" | "file_empty";
  message: string;
}

export interface StorageValidationOk {
  ok: true;
}

/** Validate a file against its purpose config (server-side security boundary). */
export function validateUploadForPurpose(
  purpose: StorageUploadPurpose,
  input: { fileName: string; size: number; mime?: string }
): StorageValidationOk | StorageValidationError {
  const cfg = configForPurpose(purpose);
  const stage = isStageFilePurpose(purpose);

  if (!input.size || input.size <= 0) {
    return {
      ok: false,
      reason: "file_empty",
      message: stage
        ? stageFileErrors.fileEmpty(input.fileName)
        : "File is empty",
    };
  }
  if (input.size > cfg.maxBytes) {
    const mb = formatStageFileMb(input.size);
    return {
      ok: false,
      reason: "file_size",
      message: stage
        ? stageFileErrors.fileTooLarge(input.fileName, mb)
        : `File exceeds ${Math.round(cfg.maxBytes / (1024 * 1024))} MB limit`,
    };
  }

  const ext = extFromNameOrMime(input.fileName, input.mime);
  const mime = input.mime?.toLowerCase();
  const mimeOk = mime ? (cfg.allowedMime as readonly string[]).includes(mime) : false;
  const extOk = (cfg.allowedExt as readonly string[]).includes(ext);
  if (!mimeOk && !extOk) {
    return {
      ok: false,
      reason: "file_type",
      message: stage
        ? stageFileErrors.fileTypeNotAllowed(input.fileName)
        : `File type not allowed for ${purpose}`,
    };
  }
  return { ok: true };
}
