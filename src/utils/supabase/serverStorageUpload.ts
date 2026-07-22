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
  | "installation_photo";

const BUCKET_BY_PURPOSE: Record<StorageUploadPurpose, string> = {
  design_resource: "site-visit-photos",
  design_proof: "site-visit-photos",
  production_asset: "site-visit-photos",
  site_visit_photo: "site-visit-photos",
  installation_photo: "installation-photos",
};

export function bucketForPurpose(purpose: StorageUploadPurpose): string {
  return BUCKET_BY_PURPOSE[purpose];
}

function guessContentType(fileName: string, mimeType?: string): string {
  if (mimeType) return mimeType;
  const ext = fileName.split(".").pop()?.toLowerCase() || "";
  return MIME_BY_EXT[ext] || "application/octet-stream";
}

function buildStoragePath(
  orderId: string,
  purpose: StorageUploadPurpose,
  ext: string
): string {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  switch (purpose) {
    case "design_resource":
      return `${orderId}/resources/${stamp}.${ext}`;
    case "design_proof":
      return `${orderId}/designs/${stamp}.${ext}`;
    case "production_asset":
      return `${orderId}/production/${stamp}.${ext}`;
    default:
      return `${orderId}/${stamp}.${ext}`;
  }
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
  });

  if (error) throw new Error(error.message);

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return { url: data.publicUrl, path, name: fileName, bucket };
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
