import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Browser Supabase client — must be a singleton.
 * Creating a new client per call/render opens extra Realtime sockets and
 * breaks postgres_changes subscriptions (common with @supabase/ssr).
 */
let browserClient: SupabaseClient | null = null;
let authListenerAttached = false;

export function createClient(): SupabaseClient {
  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Supabase environment variables are missing");
  }
  if (!browserClient) {
    browserClient = createBrowserClient(supabaseUrl, supabaseKey);
  }
  if (!authListenerAttached) {
    authListenerAttached = true;
    browserClient.auth.onAuthStateChange((_event, session) => {
      const token = session?.access_token;
      if (token) {
        void browserClient!.realtime.setAuth(token);
      }
    });
  }
  return browserClient;
}
