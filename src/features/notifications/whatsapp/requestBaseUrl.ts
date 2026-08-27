import { headers } from "next/headers";

/**
 * Resolve the public base URL from the incoming request host.
 * Do not use NEXT_PUBLIC_SITE_URL it gets baked at build time and
 * breaks preview deployments when set to localhost.
 */
export async function getRequestBaseUrl(): Promise<string> {
  const headersList = await headers();
  const host =
    headersList.get("x-forwarded-host")?.split(",")[0]?.trim() ||
    headersList.get("host") ||
    "localhost:3001";
  const protocol =
    headersList.get("x-forwarded-proto")?.split(",")[0]?.trim() ||
    (host.includes("localhost") || host.startsWith("127.") ? "http" : "https");
  return `${protocol}://${host}`;
}
