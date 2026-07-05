import { createHmac, randomUUID, timingSafeEqual } from "crypto";
import { createAdminClient } from "@/utils/supabase/admin";


// ============================================================
// Portal Token Configuration
// ============================================================
// PORTAL_SECRET: Must be at least 32 bytes. Set this in production.
// PORTAL_VERSION: For future token format upgrades.
// ============================================================

const DEFAULT_SCOPES = [
  "read_order",
  "schedule_visit",
  "approve_quote",
  "approve_design",
  "chat",
  "pay",
];

function getSecret(): string {
  if (process.env.PORTAL_SECRET) return process.env.PORTAL_SECRET;
  if (process.env.PORTAL_SALT) {
    console.warn(
      "[PORTAL-TOKENS] PORTAL_SECRET not set. Falling back to PORTAL_SALT for backward compatibility. " +
        "Please set a strong PORTAL_SECRET (at least 32 random bytes) in production."
    );
    return process.env.PORTAL_SALT;
  }
  throw new Error(
    "[PORTAL-TOKENS] PORTAL_SECRET or PORTAL_SALT must be set for token signing."
  );
}

function getVersion(): string {
  return process.env.PORTAL_VERSION || "v1";
}
// ============================================================
// Types
// ============================================================
export interface PortalTokenPayload {
  customerId: string; // friendly customer_id e.g. "A012"
  orderId?: string; // friendly order_id e.g. "A012-001"
  scopes: string[];
  iat: number; // issued at, unix seconds
  exp: number; // expires at, unix seconds
  jti: string; // unique ID for revocation
}

export interface GenerateOptions {
  expiresInDays?: number; // default 30
  createdBy?: string; // default "system"
  scopes?: string[];
  metadata?: Record<string, any>;
}

export interface GenerationResult {
  token: string;
  jti: string;
  url: string;
  expiresAt: Date;
}

// ============================================================
// Core Crypto Functions
// ============================================================
function sign(payloadB64: string): string {
  return createHmac("sha256", getSecret())
    .update(`${payloadB64}.${getVersion()}`)
    .digest("base64url");
}

export function verifyPortalToken(tokenString: string): PortalTokenPayload | null {
  try {
    const parts = tokenString.split(".");
    if (parts.length !== 2) return null;

    const [payloadB64, signature] = parts;
    if (!payloadB64 || !signature) return null;

    // Verify HMAC signature (timing-safe)
    const expectedSig = sign(payloadB64);
    const sigBuf = Buffer.from(signature);
    const expectedBuf = Buffer.from(expectedSig);

    if (sigBuf.length !== expectedBuf.length) return null;
    if (!timingSafeEqual(sigBuf, expectedBuf)) return null;

    // Decode payload
    const payload: PortalTokenPayload = JSON.parse(
      Buffer.from(payloadB64, "base64url").toString("utf-8")
    );

    // Validate required fields
    if (!payload.customerId || !payload.jti) return null;
    if (!Array.isArray(payload.scopes)) return null;
    if (typeof payload.iat !== "number" || typeof payload.exp !== "number") return null;

    // Check expiry
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) return null;

    return payload;
  } catch {
    return null;
  }
}

export function generatePortalTokenSync(
  customerId: string,
  orderId?: string,
  options: { expiresInDays?: number; scopes?: string[] } = {}
): { token: string; jti: string; expiresAt: Date } {
  const jti = randomUUID();
  const now = Math.floor(Date.now() / 1000);
  const expiresInDays = options.expiresInDays ?? 30;
  const exp = now + expiresInDays * 24 * 60 * 60;

  const payload: PortalTokenPayload = {
    customerId,
    orderId,
    scopes: options.scopes ?? DEFAULT_SCOPES,
    iat: now,
    exp,
    jti,
  };

  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = sign(payloadB64);
  const token = `${payloadB64}.${signature}`;

  return { token, jti, expiresAt: new Date(exp * 1000) };
}

export function buildPortalUrl(token: string, baseUrl?: string): string {
  const envBaseUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (!baseUrl && !envBaseUrl) {
    console.warn(
      "[portal-tokens] NEXT_PUBLIC_SITE_URL is not set. Falling back to http://localhost:3000. " +
        "Set NEXT_PUBLIC_SITE_URL in .env.local (e.g., http://localhost:3001 for dev) to generate correct portal links."
    );
  }
  const resolvedBase = baseUrl || envBaseUrl || "http://localhost:3000";
  const params = new URLSearchParams({ token });
  return `${resolvedBase}/portal?${params.toString()}`;
}

// ============================================================
// Database & Flow Integration Functions
// ============================================================
export async function storePortalToken(
  supabase: any,
  jti: string,
  customerId: string,
  orderId: string | undefined,
  expiresAt: Date,
  createdBy: string = "system",
  metadata: Record<string, any> = {}
): Promise<void> {
  // Prefer service-role client: token issuance is a privileged server action and
  // must work for enquiry-time tokens (order_id is null) under tenant RLS.
  const db = createAdminClient() || supabase;
  try {
    const { error } = await db.from("portal_access_tokens").insert({
      jti,
      customer_id: customerId,
      order_id: orderId || null,
      expires_at: expiresAt.toISOString(),
      created_by: createdBy,
      metadata,
    });

    if (error) {
      console.error("[storePortalToken] Failed to store token:", error.message);
      throw new Error(`Failed to store portal token: ${error.message}`);
    }
  } catch (err: any) {
    console.error("[storePortalToken] Exception:", err.message);
    throw err;
  }
}

export async function isTokenRevoked(
  supabase: any,
  jti: string
): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from("portal_access_tokens")
      .select("revoked_at")
      .eq("jti", jti)
      .single();

    if (error) {
      if (error.code === "PGRST116") return false; // not found
      console.error("[isTokenRevoked] DB Error:", error.message);
      return true; // treat DB error as revoked/unsafe
    }

    return !!data?.revoked_at;
  } catch (err: any) {
    console.error("[isTokenRevoked] Exception:", err.message);
    return true;
  }
}

export async function revokePortalToken(
  supabase: any,
  jti: string
): Promise<void> {
  try {
    const { error } = await supabase
      .from("portal_access_tokens")
      .update({ revoked_at: new Date().toISOString() })
      .eq("jti", jti);

    if (error) {
      console.error("[revokePortalToken] Failed to revoke:", error.message);
      throw new Error(`Failed to revoke token: ${error.message}`);
    }
  } catch (err: any) {
    console.error("[revokePortalToken] Exception:", err.message);
    throw err;
  }
}

// ============================================================
// Convenience: Generate & Store in one call
// ============================================================
export async function generateAndStorePortalToken(
  supabase: any,
  customerId: string,
  orderId?: string,
  options: GenerateOptions & { baseUrl?: string } = {}
): Promise<GenerationResult> {
  const { expiresInDays = 30, createdBy = "system", metadata = {}, baseUrl } = options;

  const { token, jti, expiresAt } = generatePortalTokenSync(
    customerId,
    orderId,
    { expiresInDays }
  );

  await storePortalToken(
    supabase,
    jti,
    customerId,
    orderId,
    expiresAt,
    createdBy,
    metadata
  );

  const url = buildPortalUrl(token, baseUrl);

  return { token, jti, url, expiresAt };
}
