import { withBasePath } from "@/lib/appBasePath";
import {
  formatGpsCoords,
  isGoogleMapsUrl,
  type MapsLatLng,
} from "@/components/maps/mapsUrl";

export type ResolvedMapsLocation = MapsLatLng & { address: string };

/**
 * Resolve a pasted Google Maps URL (short or full) to lat/lng + address.
 * Always uses the server so pin coords (!3d/!4d) are preferred over viewport.
 */
export async function resolveGoogleMapsLocation(
  input: string
): Promise<ResolvedMapsLocation | null> {
  const trimmed = input.trim();
  if (!trimmed || !isGoogleMapsUrl(trimmed)) return null;

  const res = await fetch(withBasePath("/api/maps/resolve"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: trimmed }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || typeof data.lat !== "number" || typeof data.lng !== "number") {
    return null;
  }
  const address =
    typeof data.address === "string" && data.address.trim() && !isGoogleMapsUrl(data.address)
      ? data.address.trim()
      : formatGpsCoords(data.lat, data.lng);

  return { lat: data.lat, lng: data.lng, address };
}

/** Ensure schedule payload never stores a Maps link — resolves first if needed. */
export async function ensureResolvedSiteLocation(input: {
  customerAddress: string;
  gpsLocation: string;
}): Promise<{ customerAddress: string; gpsLocation: string }> {
  const address = (input.customerAddress || "").trim();
  const gps = (input.gpsLocation || "").trim();

  if (isGoogleMapsUrl(address)) {
    const resolved = await resolveGoogleMapsLocation(address);
    if (!resolved) {
      throw new Error(
        "Could not open that Google Maps link. Paste a valid Maps URL or search for the address."
      );
    }
    return {
      customerAddress: resolved.address,
      gpsLocation: formatGpsCoords(resolved.lat, resolved.lng),
    };
  }

  return {
    customerAddress: address,
    gpsLocation: gps,
  };
}
