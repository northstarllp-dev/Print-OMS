import { readFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { loadClientConfig } from "@/config/loadClientConfig";

export const runtime = "nodejs";

/** Apple / PWA touch icon for the active client (square PNG). */
export async function GET() {
  const config = loadClientConfig();
  const iconFolder = config.faviconUrl
    ? config.faviconUrl.replace(/\/[^/]+$/, "")
    : null;
  const rel = iconFolder
    ? `${iconFolder.replace(/^\//, "")}/apple-touch-icon.png`
    : config.logoUrl?.replace(/^\//, "") || null;

  if (!rel) {
    return new NextResponse("Icon not found", { status: 404 });
  }

  try {
    const filePath = path.join(process.cwd(), "public", rel);
    const buf = await readFile(filePath);
    return new NextResponse(buf, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      },
    });
  } catch {
    return new NextResponse("Icon not found", { status: 404 });
  }
}
