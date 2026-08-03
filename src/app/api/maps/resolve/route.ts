import { NextRequest, NextResponse } from "next/server";
import { isGoogleMapsUrl } from "@/components/maps/mapsUrl";
import { resolveMapsUrlToLocation } from "@/components/maps/resolveMapsUrlServer";

export const dynamic = "force-dynamic";

/**
 * Resolve a Google Maps share/search URL (including maps.app.goo.gl short links)
 * to pin coordinates + formatted address (never returns the pasted link as address).
 */
export async function POST(request: NextRequest) {
  let body: { url?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const url = typeof body.url === "string" ? body.url.trim() : "";
  if (!url || !isGoogleMapsUrl(url)) {
    return NextResponse.json(
      { error: "A Google Maps URL is required" },
      { status: 400 }
    );
  }

  try {
    const resolved = await resolveMapsUrlToLocation(url);
    if (!resolved) {
      return NextResponse.json(
        { error: "Could not find coordinates in that Maps link" },
        { status: 422 }
      );
    }
    return NextResponse.json({
      lat: resolved.lat,
      lng: resolved.lng,
      address: resolved.address,
      resolvedUrl: resolved.resolvedUrl,
    });
  } catch (err: any) {
    console.error("[api/maps/resolve]", err?.message || err);
    return NextResponse.json(
      { error: "Failed to resolve Maps link" },
      { status: 500 }
    );
  }
}
