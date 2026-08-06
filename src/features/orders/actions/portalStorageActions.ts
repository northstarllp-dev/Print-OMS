"use server";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { assertPortalUploadAccess } from "@/utils/portal/portalUploadAuth";
import { parseStoredRef } from "@/utils/storage/storageRef";

const PORTAL_DELETE_BUCKETS = new Set(["order-resources", "design-proofs"]);

/**
 * Portal-safe storage delete: validates portal token + scope, then removes via service role.
 * Private buckets cannot be deleted from the browser anon client.
 */
export async function deletePortalStorageFileAction(input: {
  orderId: string;
  portalToken?: string;
  /** Full public URL or "bucket/path" ref. */
  refOrUrl: string;
}): Promise<void> {
  const parsed = parseStoredRef(input.refOrUrl);
  if (!parsed) return;
  if (!PORTAL_DELETE_BUCKETS.has(parsed.bucket)) {
    throw new Error("Forbidden: bucket is not allowed");
  }

  const orderUuid = await assertPortalUploadAccess(
    input.orderId,
    "approve_design",
    input.portalToken
  );

  const first = parsed.path.split("/")[0] || "";
  if (first !== orderUuid) {
    throw new Error("Forbidden: file does not belong to this order");
  }

  const admin = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const { error } = await admin.storage.from(parsed.bucket).remove([parsed.path]);
  if (error) throw new Error(error.message);
}
