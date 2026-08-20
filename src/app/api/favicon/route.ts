import { readFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { loadClientConfig } from "@/config/loadClientConfig";

export const runtime = "nodejs";

/**
 * Serves the active client's favicon so Vercel (and browsers hitting /favicon.ico
 * outside basePath) can resolve a real brand icon instead of the default "N".
 */
export async function GET() {
  const config = loadClientConfig();
  const rel =
    config.faviconUrl?.replace(/^\//, "") ||
    "clients/printoms/favicon_io/favicon.ico";

  try {
    const filePath = path.join(process.cwd(), "public", rel);
    const buf = await readFile(filePath);
    return new NextResponse(buf, {
      headers: {
        "Content-Type": "image/x-icon",
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      },
    });
  } catch {
    return new NextResponse("Favicon not found", { status: 404 });
  }
}
