import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/utils/rate-limiter";
import { signReadUrl } from "@/utils/supabase/storageSignRead";

export const runtime = "nodejs";

/**
 * Resolve a stored object reference to a browser-loadable URL.
 * Public buckets return the public URL; private buckets return a signed URL.
 * Accepts POST { bucket, path, width?, format? }.
 */
export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") || "local";
  const rate = checkRateLimit(`storage-sign-read-${ip}`);
  if (!rate.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  let body: {
    bucket?: string;
    path?: string;
    width?: number;
    height?: number;
    format?: "origin";
    quality?: number;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const bucket = String(body.bucket || "").trim();
  const path = String(body.path || "").trim();
  if (!bucket || !path || path.includes("..")) {
    return NextResponse.json({ error: "Invalid bucket or path" }, { status: 400 });
  }

  try {
    const url = await signReadUrl(bucket, path, {
      width: body.width,
      height: body.height,
      format: body.format,
      quality: body.quality,
    });
    return NextResponse.json({ url });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Could not sign URL";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
