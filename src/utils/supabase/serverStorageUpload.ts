import type { SupabaseClient } from "@supabase/supabase-js";

const MIME_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
  gif: "image/gif",
  pdf: "application/pdf",
  svg: "image/svg+xml",
};

export type StorageUploadPurpose =
  | "design_resource"
  | "design_proof"
  | "production_asset"
  | "site_visit_photo"
  | "installation_photo"
  | "service_ticket_photo"
  | "service_ticket_resolution_photo";

const BUCKET_BY_PURPOSE: Record<StorageUploadPurpose, string> = {
  design_resource: "order-resources",
  design_proof: "design-proofs",
  production_asset: "production-files",
  site_visit_photo: "site-visit-photos",
  installation_photo: "installation-photos",
  service_ticket_photo: "service-ticket-photos",
  service_ticket_resolution_photo: "service-ticket-resolution-photos",
};

export function bucketForPurpose(purpose: StorageUploadPurpose): string {
  return BUCKET_BY_PURPOSE[purpose];
}

/**
 * Extract bucket + object path from a Supabase public object URL.
 * Works for any bucket (new stage buckets and legacy site-visit-photos nested paths).
 */
export function parsePublicStorageUrl(
  url: string
): { bucket: string; path: string } | null {
  const marker = "/storage/v1/object/public/";
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  const rest = url.slice(idx + marker.length);
  const slash = rest.indexOf("/");
  if (slash <= 0) return null;
  const bucket = rest.slice(0, slash);
  const path = decodeURIComponent(rest.slice(slash + 1).split("?")[0] || "");
  if (!bucket || !path) return null;
  return { bucket, path };
}

function guessContentType(fileName: string, mimeType?: string): string {
  if (mimeType) return mimeType;
  const ext = fileName.split(".").pop()?.toLowerCase() || "";
  return MIME_BY_EXT[ext] || "application/octet-stream";
}

/** Flat order-scoped key: {orderId}/{stamp}.{ext} — stage is the bucket. */
function buildStoragePath(
  orderId: string,
  _purpose: StorageUploadPurpose,
  ext: string
): string {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${orderId}/${stamp}.${ext}`;
}

async function readUploadBytes(
  file: File | Blob,
  fileName: string
): Promise<{ bytes: Uint8Array; contentType: string; ext: string; name: string }> {
  const name = fileName || "upload.jpg";
  const ext = (name.split(".").pop() || "jpg").toLowerCase();
  const contentType = guessContentType(name, file.type || undefined);

  if (!file.size) {
    throw new Error("Selected file is empty. Please choose another photo.");
  }

  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  if (!bytes.byteLength) {
    throw new Error("Could not read file data. Please try again.");
  }

  return { bytes, contentType, ext, name };
}

export async function uploadBytesToStorageBucket(
  supabase: SupabaseClient,
  options: {
    orderId: string;
    purpose: StorageUploadPurpose;
    bytes: Uint8Array;
    fileName: string;
    contentType?: string;
  }
): Promise<{ url: string; path: string; name: string; bucket: string }> {
  const { orderId, purpose, bytes, fileName, contentType: mimeOverride } = options;
  const bucket = bucketForPurpose(purpose);

  if (!bytes.byteLength) {
    throw new Error("Could not read file data. Please try again.");
  }

  const ext = (fileName.split(".").pop() || "jpg").toLowerCase();
  const contentType = mimeOverride || guessContentType(fileName);
  const path = buildStoragePath(orderId, purpose, ext);

  const { error } = await supabase.storage.from(bucket).upload(path, bytes, {
    contentType,
    upsert: false,
    cacheControl: "3600",
  });

  if (error) throw new Error(error.message);

  // Private buckets: store "bucket/path" refs (signed at read time). Public URLs no longer work.
  const ref = `${bucket}/${path}`;
  return { url: ref, path, name: fileName, bucket };
}

export async function uploadFileToStorageBucket(
  supabase: SupabaseClient,
  options: {
    orderId: string;
    file: File | Blob;
    fileName?: string;
    purpose: StorageUploadPurpose;
  }
): Promise<{ url: string; path: string; name: string; bucket: string }> {
  const fileName =
    options.fileName ||
    (options.file instanceof File ? options.file.name : "") ||
    "upload.jpg";
  const { bytes, contentType, name } = await readUploadBytes(options.file, fileName);

  return uploadBytesToStorageBucket(supabase, {
    orderId: options.orderId,
    purpose: options.purpose,
    bytes,
    fileName: name,
    contentType,
  });
}

export async function uploadBase64ToStorageBucket(
  supabase: SupabaseClient,
  options: {
    orderId: string;
    purpose: StorageUploadPurpose;
    fileBase64: string;
    fileName: string;
    contentType?: string;
  }
): Promise<{ url: string; path: string; name: string; bucket: string }> {
  const buffer = Buffer.from(options.fileBase64, "base64");
  if (!buffer.length) {
    throw new Error("Could not read file data. Please try again.");
  }

  return uploadBytesToStorageBucket(supabase, {
    orderId: options.orderId,
    purpose: options.purpose,
    bytes: new Uint8Array(buffer),
    fileName: options.fileName,
    contentType: options.contentType,
  });
}
