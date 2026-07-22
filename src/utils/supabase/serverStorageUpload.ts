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

function guessContentType(file: File, ext: string): string {
  if (file.type) return file.type;
  return MIME_BY_EXT[ext] || "application/octet-stream";
}

function buildStoragePath(
  orderId: string,
  purpose: "design_resource" | "site_visit_photo",
  ext: string
): string {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  if (purpose === "design_resource") {
    return `${orderId}/resources/${stamp}.${ext}`;
  }
  return `${orderId}/${stamp}.${ext}`;
}

export async function uploadFileToStorageBucket(
  supabase: SupabaseClient,
  options: {
    bucket: string;
    orderId: string;
    file: File;
    purpose: "design_resource" | "site_visit_photo";
  }
): Promise<{ url: string; path: string; name: string }> {
  const { bucket, orderId, file, purpose } = options;

  if (!file.size) {
    throw new Error("Selected file is empty. Please choose another photo.");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  if (!buffer.length) {
    throw new Error("Could not read file data. Please try again.");
  }

  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const contentType = guessContentType(file, ext);
  const path = buildStoragePath(orderId, purpose, ext);

  const { error } = await supabase.storage.from(bucket).upload(path, buffer, {
    contentType,
    upsert: false,
  });

  if (error) throw new Error(error.message);

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return { url: data.publicUrl, path, name: file.name };
}
