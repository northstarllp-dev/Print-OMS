import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { createAdminClient } from "@/utils/supabase/admin";
import { APP_BASE_PATH } from "@/lib/appBasePath";

// ============================================================
// Portal Token Configuration
// ============================================================
// Short opaque codes (12 chars) are stored as `jti` and look up claims in DB.
// Ideal as WhatsApp template URL-button variables (Meta prefers short suffixes).
// Legacy HMAC tokens (payload.sig) are still accepted until they expire.
// ============================================================

/** Short code length fits WhatsApp CTA URL button dynamic params. */
export const PORTAL_TOKEN_LENGTH = 12;

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
  customerId: string;
  orderId?: string;
  scopes: string[];
  iat: number;
  exp: number;
  jti: string;
}

export interface GenerateOptions {
  expiresInDays?: number;
  createdBy?: string;
  scopes?: string[];
  metadata?: Record<string, any>;
}

export interface GenerationResult {
  token: string;
  jti: string;
  url: string;
  expiresAt: Date;
}

function isShortOpaqueToken(token: string): boolean {
  return /^[A-Za-z0-9_-]{8,32}$/.test(token) && !token.includes(".");
}

function generateShortCode(): string {
  // 9 bytes → 12 base64url chars
  return randomBytes(9).toString("base64url").slice(0, PORTAL_TOKEN_LENGTH);
}

// ============================================================
// Legacy HMAC (read-only for old links)
// ============================================================
function sign(payloadB64: string): string {
  return createHmac("sha256", getSecret())
    .update(`${payloadB64}.${getVersion()}`)
    .digest("base64url");
}

function verifyLegacyHmacToken(tokenString: string): PortalTokenPayload | null {
  try {
    const parts = tokenString.split(".");
    if (parts.length !== 2) return null;

    const [payloadB64, signature] = parts;
    if (!payloadB64 || !signature) return null;

    const expectedSig = sign(payloadB64);
    const sigBuf = Buffer.from(signature);
    const expectedBuf = Buffer.from(expectedSig);

    if (sigBuf.length !== expectedBuf.length) return null;
    if (!timingSafeEqual(sigBuf, expectedBuf)) return null;

    const payload: PortalTokenPayload = JSON.parse(
      Buffer.from(payloadB64, "base64url").toString("utf-8")
    );

    if (!payload.customerId || !payload.jti) return null;
    if (!Array.isArray(payload.scopes)) return null;
    if (typeof payload.iat !== "number" || typeof payload.exp !== "number") return null;

    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) return null;

    return payload;
  } catch {
    return null;
  }
}

/**
 * @deprecated Prefer resolvePortalToken(). Sync HMAC-only check for legacy tokens.
 */
export function verifyPortalToken(tokenString: string): PortalTokenPayload | null {
  if (isShortOpaqueToken(tokenString)) {
    // Short tokens require DB lookup cannot verify sync.
    return null;
  }
  return verifyLegacyHmacToken(tokenString);
}

/**
 * Resolve a portal token (short opaque or legacy HMAC) to its payload.
 * Short tokens are looked up by `jti` in portal_access_tokens.
 */
export async function resolvePortalToken(
  tokenString: string
): Promise<PortalTokenPayload | null> {
  if (!tokenString) return null;

  if (isShortOpaqueToken(tokenString)) {
    const db = createAdminClient();
    if (!db) return null;

    const { data, error } = await db
      .from("portal_access_tokens")
      .select("jti, customer_id, order_id, issued_at, expires_at, revoked_at, metadata")
      .eq("jti", tokenString)
      .maybeSingle();

    if (error || !data) return null;
    if (data.revoked_at) return null;

    const expiresAt = new Date(data.expires_at).getTime();
    if (Number.isNaN(expiresAt) || expiresAt < Date.now()) return null;

    const scopes =
      Array.isArray(data.metadata?.scopes) && data.metadata.scopes.length > 0
        ? (data.metadata.scopes as string[])
        : DEFAULT_SCOPES;

    const issuedMs = data.issued_at ? new Date(data.issued_at).getTime() : Date.now();

    return {
      customerId: data.customer_id,
      orderId: data.order_id || undefined,
      scopes,
      iat: Math.floor(issuedMs / 1000),
      exp: Math.floor(expiresAt / 1000),
      jti: data.jti,
    };
  }

  const legacy = verifyLegacyHmacToken(tokenString);
  if (!legacy) return null;

  // Still honor revocation for legacy links
  const revoked = await isTokenRevoked(createAdminClient(), legacy.jti);
  if (revoked) return null;
  return legacy;
}

/** Generate a short opaque portal code (also used as jti). */
export function generatePortalTokenSync(
  customerId: string,
  orderId?: string,
  options: { expiresInDays?: number; scopes?: string[] } = {}
): { token: string; jti: string; expiresAt: Date; scopes: string[] } {
  const jti = generateShortCode();
  const now = Math.floor(Date.now() / 1000);
  const expiresInDays = options.expiresInDays ?? 30;
  const exp = now + expiresInDays * 24 * 60 * 60;
  const scopes = options.scopes ?? DEFAULT_SCOPES;

  return {
    token: jti,
    jti,
    expiresAt: new Date(exp * 1000),
    scopes,
  };
}

export function buildPortalUrl(token: string, baseUrl?: string): string {
  if (!baseUrl) {
    throw new Error(
      "buildPortalUrl requires baseUrl from getRequestBaseUrl() (request host)."
    );
  }
  const resolvedBase = baseUrl.replace(/\/$/, "");
  const params = new URLSearchParams({ token });
  return `${resolvedBase}${APP_BASE_PATH}/portal?${params.toString()}`;
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
  const db = createAdminClient() || supabase;
  if (!db) return true;
  try {
    const { data, error } = await db
      .from("portal_access_tokens")
      .select("revoked_at")
      .eq("jti", jti)
      .maybeSingle();

    if (error) {
      console.error("[isTokenRevoked] DB Error:", error.message);
      return true;
    }
    if (!data) return false; // legacy HMAC jti may not be stored
    return !!data.revoked_at;
  } catch (err: any) {
    console.error("[isTokenRevoked] Exception:", err.message);
    return true;
  }
}

export async function revokePortalToken(
  supabase: any,
  jti: string
): Promise<void> {
  const db = createAdminClient() || supabase;
  try {
    const { error } = await db
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

export async function generateAndStorePortalToken(
  supabase: any,
  customerId: string,
  orderId?: string,
  options: GenerateOptions & { baseUrl?: string } = {}
): Promise<GenerationResult> {
  const {
    expiresInDays = 30,
    createdBy = "system",
    metadata = {},
    baseUrl,
    scopes,
  } = options;

  // Retry on rare jti collision
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    const { token, jti, expiresAt, scopes: resolvedScopes } =
      generatePortalTokenSync(customerId, orderId, { expiresInDays, scopes });

    try {
      await storePortalToken(
        supabase,
        jti,
        customerId,
        orderId,
        expiresAt,
        createdBy,
        { ...metadata, scopes: resolvedScopes }
      );

      const url = buildPortalUrl(token, baseUrl);
      return { token, jti, url, expiresAt };
    } catch (err: any) {
      lastError = err;
      // unique violation on jti → retry
      if (String(err?.message || "").includes("portal_access_tokens_jti_key")) {
        continue;
      }
      throw err;
    }
  }

  throw lastError || new Error("Failed to generate portal token");
}
