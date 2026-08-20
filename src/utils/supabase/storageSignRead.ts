import { createAdminClient } from "@/utils/supabase/admin";
import { isPublicBucket } from "@/utils/supabase/storageConfig";

export const SIGNED_READ_TTL_SECONDS = 60 * 60; // 1 hour

export interface SignReadOptions {
  width?: number;
  height?: number;
  format?: "origin" | "webp";
  quality?: number;
}

/**
 * Resolve a stored object reference to a browser-loadable URL.
 * Public buckets → public URL (+ optional transform). Private buckets → signed URL.
 */
export async function signReadUrl(
  bucket: string,
  path: string,
  options?: SignReadOptions
): Promise<string> {
  if (!bucket || !path || path.includes("..")) {
    throw new Error("Invalid storage reference");
  }
  const admin = createAdminClient();
  if (!admin) throw new Error("Server not configured");

  const transform =
    options && (options.width || options.height)
      ? ({
          width: options.width,
          height: options.height,
          quality: options.quality,
          resize: "contain",
        } as const)
      : undefined;

  if (isPublicBucket(bucket)) {
    const { data } = admin.storage
      .from(bucket)
      .getPublicUrl(path, transform ? { transform } : undefined);
    return data.publicUrl;
  }

  const { data, error } = await admin.storage
    .from(bucket)
    .createSignedUrl(path, SIGNED_READ_TTL_SECONDS, transform ? { transform } : undefined);
  if (error || !data) {
    throw new Error(error?.message || "Could not create signed URL");
  }
  return data.signedUrl;
}
