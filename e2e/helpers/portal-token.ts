import { createClient } from "@supabase/supabase-js";
import { getServiceClient, PRINTOMS_COMPANY_ID } from "./db";

const DEFAULT_SCOPES = [
  "read_order",
  "schedule_visit",
  "approve_quote",
  "approve_design",
  "chat",
  "pay",
];

function randomJti(length = 12): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < length; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

/**
 * Mint a portal token the same way production does (portal_access_tokens row),
 * without needing a staff browser session.
 */
export async function mintPortalToken(opts: {
  customerId: string;
  orderId?: string;
  expiresInDays?: number;
}): Promise<{ token: string; url: string }> {
  const db = getServiceClient();
  const token = randomJti(12);
  const expires = new Date();
  expires.setDate(expires.getDate() + (opts.expiresInDays ?? 30));

  const { error } = await db.from("portal_access_tokens").insert({
    jti: token,
    customer_id: opts.customerId,
    order_id: opts.orderId ?? null,
    expires_at: expires.toISOString(),
    created_by: "e2e",
    metadata: { scopes: DEFAULT_SCOPES },
  });
  if (error) throw new Error(`mintPortalToken: ${error.message}`);

  const origin = process.env.PLAYWRIGHT_ORIGIN || "http://localhost:3001";
  const url = `${origin}/printoms/portal?token=${token}`;
  return { token, url };
}

/** Sign in via password grant and return cookie-ready storage-like session. */
export async function passwordSession(email: string, password: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) throw new Error("Missing Supabase URL/anon key");

  const client = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.signInWithPassword({
    email,
    password,
  });
  if (error || !data.session) {
    throw new Error(`passwordSession failed: ${error?.message || "no session"}`);
  }
  return data.session;
}

export { PRINTOMS_COMPANY_ID };
