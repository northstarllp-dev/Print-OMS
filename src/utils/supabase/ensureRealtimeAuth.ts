import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Realtime opens a separate WebSocket that often connects as `anon` before
 * the browser session is applied (common with @supabase/ssr). RLS then
 * silently drops INSERT/UPDATE events while DELETE may still arrive.
 * Always push the access token onto the realtime client before subscribe().
 */
export async function ensureRealtimeAuth(
  supabase: SupabaseClient
): Promise<void> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (token) {
    await supabase.realtime.setAuth(token);
  }
}
