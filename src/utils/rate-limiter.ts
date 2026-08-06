/**
 * Simple in-memory rate limiter for portal token validation.
 * NOTE: For multi-instance deployments, replace with Redis or a DB-backed rate limiter.
 */

interface RateLimitEntry {
  timestamps: number[];
  blockedUntil?: number;
}

const store = new Map<string, RateLimitEntry>();

const WINDOW_MS = 60 * 1000; // 1 minute
const MAX_ATTEMPTS = 120; // portal pages refresh often (RSC + navigation)
const BLOCK_DURATION_MS = 30 * 1000; // short cool-down

function cleanup(key: string, now: number) {
  const entry = store.get(key);
  if (!entry) return;

  const windowStart = now - WINDOW_MS;
  entry.timestamps = entry.timestamps.filter((t) => t > windowStart);

  if (entry.blockedUntil && entry.blockedUntil < now) {
    entry.blockedUntil = undefined;
  }

  if (entry.timestamps.length === 0 && !entry.blockedUntil) {
    store.delete(key);
  }
}

/** First hop from X-Forwarded-For (or fallback). */
export function clientIpFromHeaders(headersList: Headers): string {
  const forwarded = headersList.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return headersList.get("x-real-ip")?.trim() || "local";
}

export function checkRateLimit(key: string): { allowed: boolean; retryAfter?: number } {
  // Local/dev: never block portal testing (HMR + rapid refresh trips the shared bucket).
  if (process.env.NODE_ENV === "development") {
    return { allowed: true };
  }

  const now = Date.now();
  cleanup(key, now);

  const entry = store.get(key) || { timestamps: [] };

  if (entry.blockedUntil && entry.blockedUntil > now) {
    const retryAfter = Math.ceil((entry.blockedUntil - now) / 1000);
    return { allowed: false, retryAfter };
  }

  const windowStart = now - WINDOW_MS;
  const attemptsInWindow = entry.timestamps.filter((t) => t > windowStart).length;

  if (attemptsInWindow >= MAX_ATTEMPTS) {
    entry.blockedUntil = now + BLOCK_DURATION_MS;
    store.set(key, entry);
    return { allowed: false, retryAfter: Math.ceil(BLOCK_DURATION_MS / 1000) };
  }

  entry.timestamps.push(now);
  store.set(key, entry);

  return { allowed: true };
}

/** Peek without recording an attempt. */
export function isRateLimited(key: string): boolean {
  if (process.env.NODE_ENV === "development") return false;

  const now = Date.now();
  cleanup(key, now);
  const entry = store.get(key);
  if (!entry) return false;
  if (entry.blockedUntil && entry.blockedUntil > now) return true;
  const windowStart = now - WINDOW_MS;
  return entry.timestamps.filter((t) => t > windowStart).length >= MAX_ATTEMPTS;
}

/** Clear one key (e.g. after fixing a shared "anonymous" bucket in prod). */
export function clearRateLimit(key: string): void {
  store.delete(key);
}

/**
 * Configurable rate limit (per-order / per-user upload quotas).
 * Independent store so it doesn't compete with the coarse global IP limiter.
 */
const customStore = new Map<string, RateLimitEntry>();

export function checkCustomRateLimit(
  key: string,
  maxAttempts: number,
  windowMs = WINDOW_MS
): { allowed: boolean; retryAfter?: number } {
  if (process.env.NODE_ENV === "development") return { allowed: true };

  const now = Date.now();
  const entry = customStore.get(key) || { timestamps: [] };
  if (entry.blockedUntil && entry.blockedUntil > now) {
    return { allowed: false, retryAfter: Math.ceil((entry.blockedUntil - now) / 1000) };
  }
  const windowStart = now - windowMs;
  entry.timestamps = entry.timestamps.filter((t) => t > windowStart);
  if (entry.timestamps.length >= maxAttempts) {
    entry.blockedUntil = now + BLOCK_DURATION_MS;
    customStore.set(key, entry);
    return { allowed: false, retryAfter: Math.ceil(BLOCK_DURATION_MS / 1000) };
  }
  entry.timestamps.push(now);
  customStore.set(key, entry);
  return { allowed: true };
}
