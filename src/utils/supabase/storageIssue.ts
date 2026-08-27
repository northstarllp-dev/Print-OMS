import { createAdminClient } from "@/utils/supabase/admin";
import {
  buildOrderObjectPath,
  configForPurpose,
  extFromNameOrMime,
  isValidOrderScopedPath,
  validateUploadForPurpose,
} from "@/utils/supabase/storageConfig";
import { assertStageItemUploadQuota } from "@/utils/supabase/stageFileQuota";
import type { StorageUploadPurpose } from "@/utils/supabase/serverStorageUpload";

export interface SignedUploadIssue {
  bucket: string;
  path: string;
  /** Token for uploadToSignedUrl (image + production fallback). */
  token?: string;
  /** Full signed upload URL from Supabase (preferred for PUT/XHR). */
  signedUrl?: string;
  /** Direct storage URL + headers for TUS (production pipeline). */
  tus?: {
    endpoint: string;
    uploadUrl: string;
    /** When true, the client should attach its own session access token. */
    useSessionToken: boolean;
  };
}

function supabaseHost(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  return url.replace(/\/$/, "");
}

/**
 * Issue credentials for a direct client→Storage upload after validation.
 * - image pipeline: signed upload URL token (uploadToSignedUrl)
 * - production pipeline: TUS endpoint using the caller's access token
 */
export async function issueSignedUpload(
  purpose: StorageUploadPurpose,
  orderId: string,
  input: {
    fileName: string;
    size: number;
    mime?: string;
    itemId?: string;
  }
): Promise<SignedUploadIssue> {
  const cfg = configForPurpose(purpose);
  const validation = validateUploadForPurpose(purpose, input);
  if (!validation.ok) throw new Error(validation.message);

  await assertStageItemUploadQuota(
    purpose,
    orderId,
    input.itemId,
    input.fileName,
    input.size
  );

  const ext = extFromNameOrMime(input.fileName, input.mime);
  const path = buildOrderObjectPath(orderId, ext);
  if (!isValidOrderScopedPath(orderId, path)) {
    throw new Error("Invalid order or path");
  }

  // Always issue a signed upload URL (service role). Production also gets TUS metadata.
  const admin = createAdminClient();
  if (!admin) throw new Error("Server not configured");
  const { data, error } = await admin.storage
    .from(cfg.bucket)
    .createSignedUploadUrl(path);
  if (error || !data) {
    throw new Error(error?.message || "Could not create signed upload URL");
  }

  const issued: SignedUploadIssue = {
    bucket: cfg.bucket,
    path,
    token: data.token,
    signedUrl: data.signedUrl,
  };

  if (cfg.pipeline === "production") {
    const host = supabaseHost();
    const endpoint = `${host}/storage/v1/upload/resumable`;
    issued.tus = {
      endpoint,
      uploadUrl: endpoint,
      useSessionToken: true,
    };
  }

  return issued;
}
