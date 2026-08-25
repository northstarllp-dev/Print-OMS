/**
 * Next.js instrumentation hook — runs once on server startup.
 *
 * The Supabase JS SDK auto-refreshes sessions and logs "Invalid Refresh Token"
 * errors when a session has expired or been revoked (e.g. user signed out
 * elsewhere, or the refresh token aged out). These are expected, harmless, and
 * not actionable — but they flood the terminal / Vercel logs.
 *
 * We patch console.error to filter out these specific noise messages while
 * keeping all other errors visible.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const originalError = console.error;
    const SUPABASE_AUTH_NOISE = [
      "Invalid Refresh Token",
      "refresh_token_not_found",
    ];

    console.error = (...args: unknown[]) => {
      const text = args
        .map((a) => (typeof a === "string" ? a : a instanceof Error ? a.message : ""))
        .join(" ");
      if (SUPABASE_AUTH_NOISE.some((needle) => text.includes(needle))) {
        return;
      }
      originalError(...args);
    };
  }
}
