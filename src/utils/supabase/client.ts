import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Browser Supabase client must be a singleton.
 * Creating a new client per call/render opens extra Realtime sockets and
 * breaks postgres_changes subscriptions (common with @supabase/ssr).
 */
let browserClient: SupabaseClient | null = null;
let authListenerAttached = false;

function attachRealtimeAuthSync(client: SupabaseClient) {
  if (authListenerAttached) return;
  authListenerAttached = true;

  // Keep the Realtime WebSocket JWT in sync when Auth refreshes the session.
  // Without this, a backgrounded tab can keep an expired token on the socket
  // → InvalidJWTToken → socket closed: 1006.
  client.auth.onAuthStateChange((event, session) => {
    if (event === "TOKEN_REFRESHED" || event === "SIGNED_IN") {
      const token = session?.access_token;
      if (token) {
        void client.realtime.setAuth(token);
      }
      return;
    }
    if (event === "SIGNED_OUT") {
      // Re-auth Realtime as anon so the socket does not keep a dead JWT.
      if (supabaseKey) {
        void client.realtime.setAuth(supabaseKey);
      }
    }
  });
}

export function createClient(): SupabaseClient {
  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Supabase environment variables are missing");
  }
  if (!browserClient) {
    browserClient = createBrowserClient(supabaseUrl, supabaseKey);
    attachRealtimeAuthSync(browserClient);
  }
  return browserClient;
}
