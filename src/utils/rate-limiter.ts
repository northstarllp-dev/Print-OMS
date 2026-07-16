/**
 * Simple in-memory rate limiter for portal token validation.
 * NOTE: For multi-instance deployments, replace with Redis or a DB-backed rate limiter.
 */

interface RateLimitEntry {
  timestamps: number[]; // timestamps of attempts
  blockedUntil?: number;
}

const store = new Map<string, RateLimitEntry>();

const WINDOW_MS = 60 * 1000; // 1 minute
const MAX_ATTEMPTS = 60; // max 60 attempts per window
const BLOCK_DURATION_MS = 60 * 1000; // block for 1 minute after exceeding limit

function cleanup(key: string, now: number) {
  const entry = store.get(key);
  if (!entry) return;

  // Remove old timestamps outside the window
  const windowStart = now - WINDOW_MS;
  entry.timestamps = entry.timestamps.filter((t) => t > windowStart);

  // Check if block has expired
  if (entry.blockedUntil && entry.blockedUntil < now) {
    entry.blockedUntil = undefined;
  }

  // Clean up empty entries
  if (entry.timestamps.length === 0 && !entry.blockedUntil) {
    store.delete(key);
  }
}

export function checkRateLimit(key: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  cleanup(key, now);

  const entry = store.get(key) || { timestamps: [] };

  // Check if currently blocked
  if (entry.blockedUntil && entry.blockedUntil > now) {
    const retryAfter = Math.ceil((entry.blockedUntil - now) / 1000);
    return { allowed: false, retryAfter };
  }

  // Count attempts in the current window
  const windowStart = now - WINDOW_MS;
  const attemptsInWindow = entry.timestamps.filter((t) => t > windowStart).length;

  if (attemptsInWindow >= MAX_ATTEMPTS) {
    // Block this key
    entry.blockedUntil = now + BLOCK_DURATION_MS;
    store.set(key, entry);
    return { allowed: false, retryAfter: BLOCK_DURATION_MS / 1000 };
  }

  // Record this attempt
  entry.timestamps.push(now);
  store.set(key, entry);

  return { allowed: true };
}

export function isRateLimited(key: string): boolean {
  return !checkRateLimit(key).allowed;
}
