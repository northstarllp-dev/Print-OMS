"use server";

import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { getCurrentUser } from "@/features/auth/actions/authActions";
import { resolveTicketPermission } from "@/features/service-tickets/ticketGrants";

const ALLOWED_BUCKETS = new Set([
  "site-visit-photos",
  "order-resources",
  "design-proofs",
  "production-files",
  "installation-photos",
  "service-ticket-photos",
  "service-ticket-resolution-photos",
]);

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function normalizeStoragePath(raw: string): string {
  const path = decodeURIComponent(raw).replace(/^\/+/, "").trim();
  if (!path || path.includes("..") || path.includes("\\")) {
    throw new Error("Invalid storage path");
  }
  return path;
}

async function assertPathOwnedByCompany(
  path: string,
  companyId: string
): Promise<void> {
  const first = path.split("/")[0] || "";

  // Legacy service-ticket uploads use support/…, resolution/… or public/… prefixes
  // (pre-architecture). New uploads are order-scoped ({orderUuid}/…) and fall
  // through to the order-ownership check below.
  if (first === "support" || first === "resolution" || first === "public") {
    const profile = await getCurrentUser();
    const perm = resolveTicketPermission({
      role: profile?.role,
      staff_role: profile?.staff_role ?? null,
      company_id: profile?.company_id ?? null,
    });
    if (!perm.canManage) {
      throw new Error("Forbidden: cannot delete service ticket files");
    }
    return;
  }

  // Order-scoped paths: {orderUuid}/…
  if (!UUID_RE.test(first)) {
    throw new Error("Forbidden: storage path is not order-scoped");
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {},
      },
    }
  );

  const { data: order, error } = await supabase
    .from("orders")
    .select("id, company_id")
    .eq("id", first)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!order || order.company_id !== companyId) {
    throw new Error("Forbidden: file does not belong to your company");
  }
}

/**
 * Securely deletes files from a Supabase Storage bucket using the Service Role Key.
 * Requires staff/admin, allowlisted bucket, and path ownership (order company or ticket manage).
 */
export async function deleteStorageFilesAction(bucket: string, paths: string[]) {
  if (!paths || paths.length === 0) return;

  if (!ALLOWED_BUCKETS.has(bucket)) {
    throw new Error("Forbidden: bucket is not allowed");
  }

  const profile = await getCurrentUser();
  if (!profile) {
    throw new Error("Unauthorized to delete files");
  }
  if (profile.role !== "admin" && profile.role !== "staff") {
    throw new Error("Forbidden: staff or admin access required");
  }
  if (!profile.company_id) {
    throw new Error("Company context missing");
  }

  const normalized = paths.map(normalizeStoragePath);
  for (const path of normalized) {
    await assertPathOwnedByCompany(path, profile.company_id as string);
  }

  const adminSupabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { error } = await adminSupabase.storage.from(bucket).remove(normalized);
  if (error) {
    console.error(`Failed to delete files from bucket '${bucket}':`, error);
    throw new Error(error.message);
  }
}
