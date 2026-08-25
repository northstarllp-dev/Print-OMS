import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/server";

/**
 * Resolve the signed-in staff user for storage upload APIs.
 * Prefer cookie session; fall back to Authorization Bearer when cookies
 * are missing/stale but the browser still has a valid access token.
 */
export async function resolveStaffUploadUser(
  req: NextRequest
): Promise<User | null> {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const {
    data: { user: cookieUser },
  } = await supabase.auth.getUser();
  if (cookieUser) return cookieUser;

  const header = req.headers.get("authorization") || "";
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  const token = match?.[1]?.trim();
  if (!token) return null;

  const {
    data: { user: tokenUser },
  } = await supabase.auth.getUser(token);
  return tokenUser ?? null;
}
