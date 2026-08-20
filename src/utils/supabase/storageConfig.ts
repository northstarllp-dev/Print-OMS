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
const PROD_100MB = 100 * 1024 * 1024;

const IMAGE_MIMES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
] as const;

const IMAGE_EXTS = ["jpg", "jpeg", "png", "webp", "gif", "heic", "heif"] as const;

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
    // Logos / inspiration: images + PDF + common brand-asset formats customers send.
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
  production_asset: {
    purpose: "production_asset",
    bucket: "production-files",
    pipeline: "production",
    maxBytes: PROD_100MB,
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
  // Only trust the name's extension when a real "." separator exists
  // (e.g. "noext" must not be treated as a .noext extension).
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

  if (!input.size || input.size <= 0) {
    return { ok: false, reason: "file_empty", message: "File is empty" };
  }
  if (input.size > cfg.maxBytes) {
    const mb = Math.round(cfg.maxBytes / (1024 * 1024));
    return {
      ok: false,
      reason: "file_size",
      message: `File exceeds ${mb} MB limit for ${purpose}`,
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
      message: `File type not allowed for ${purpose}`,
    };
  }
  return { ok: true };
}
