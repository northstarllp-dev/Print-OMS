import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Realtime opens a separate WebSocket that often connects as `anon` before
 * the browser session is applied (common with @supabase/ssr). RLS then
 * silently drops INSERT/UPDATE events while DELETE may still arrive.
 *
 * Always push a *valid* access token onto the realtime client before subscribe().
 * Stale JWTs produce `InvalidJWTToken` and close the socket with code 1006.
 */
export async function ensureRealtimeAuth(
  supabase: SupabaseClient
): Promise<void> {
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const { data } = await supabase.auth.getSession();
  let session = data.session;

  // getSession() can return an expired JWT from storage (tab slept / refresh missed).
  if (session?.expires_at) {
    const expiresAtMs = session.expires_at * 1000;
    if (expiresAtMs <= Date.now() + 30_000) {
      const { data: refreshed, error } = await supabase.auth.refreshSession();
      if (!error && refreshed.session) {
        session = refreshed.session;
      } else if (expiresAtMs <= Date.now()) {
        // Token already dead and refresh failed — fall back to anon rather than
        // feeding Realtime an expired JWT (which triggers InvalidJWTToken / 1006).
        session = null;
      }
    }
  }

  const token = session?.access_token || anonKey;
  if (token) {
    await supabase.realtime.setAuth(token);
  }
}
