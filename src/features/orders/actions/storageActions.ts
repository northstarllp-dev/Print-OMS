"use server";

import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

/**
 * Securely deletes files from a Supabase Storage bucket using the Service Role Key.
 * Bypasses restrictive RLS DELETE policies but verifies user authentication first.
 */
export async function deleteStorageFilesAction(bucket: string, paths: string[]) {
  if (!paths || paths.length === 0) return;

  const cookieStore = await cookies();
  const authSupabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {
          // ignore inside server action
        },
      },
    }
  );

  // 1. Verify user is authenticated
  const { data: { user } } = await authSupabase.auth.getUser();
  if (!user) {
    throw new Error("Unauthorized to delete files");
  }

  // 2. Use Service Role Key to bypass RLS and guarantee deletion
  const adminSupabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { error } = await adminSupabase.storage.from(bucket).remove(paths);
  if (error) {
    console.error(`Failed to delete files from bucket '${bucket}':`, error);
    throw new Error(error.message);
  }
}
