import { headers } from "next/headers";

/** Resolve public base URL for portal links in server actions. */
export async function getRequestBaseUrl(): Promise<string> {
  const envBase = process.env.NEXT_PUBLIC_SITE_URL;
  if (envBase) return envBase.replace(/\/$/, "");

  const headersList = await headers();
  const host = headersList.get("host") || "localhost:3000";
  const protocol =
    headersList.get("x-forwarded-proto") ||
    (host.includes("localhost") ? "http" : "https");
  return `${protocol}://${host}`;
}
