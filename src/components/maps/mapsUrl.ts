export type MapsLatLng = { lat: number; lng: number };

/** True when the text looks like a Google Maps share/search URL (not a normal address). */
export function isGoogleMapsUrl(value: string): boolean {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return false;
  return (
    trimmed.includes("maps.app.goo.gl") ||
    trimmed.includes("goo.gl/maps") ||
    trimmed.includes("google.com/maps") ||
    trimmed.includes("maps.google.") ||
    /(?:maps\.google\.[a-z.]+)/.test(trimmed)
  );
}

function validCoord(lat: number, lng: number): MapsLatLng | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

function firstMatch(url: string, patterns: RegExp[]): MapsLatLng | null {
  for (const re of patterns) {
    const m = url.match(re);
    if (!m) continue;
    const hit = validCoord(parseFloat(m[1]), parseFloat(m[2]));
    if (hit) return hit;
  }
  return null;
}

/** Place pin from Google data params more accurate than map viewport `@lat,lng`. */
export function parsePlacePinCoordsFromMapsUrl(rawUrl: string): MapsLatLng | null {
  let url: string;
  try {
    url = decodeURIComponent(rawUrl.trim());
  } catch {
    url = rawUrl.trim();
  }
  return firstMatch(url, [
    /!3d(-?\d+\.?\d*)!4d(-?\d+\.?\d*)/,
    /[?&]q=(-?\d+\.?\d*),\s*(-?\d+\.?\d*)/,
    /[?&]ll=(-?\d+\.?\d*),\s*(-?\d+\.?\d*)/,
    /[?&]query=(-?\d+\.?\d*),\s*(-?\d+\.?\d*)/,
  ]);
}

/** Map camera center fallback only when no place pin exists. */
export function parseViewportCoordsFromMapsUrl(rawUrl: string): MapsLatLng | null {
  let url: string;
  try {
    url = decodeURIComponent(rawUrl.trim());
  } catch {
    url = rawUrl.trim();
  }
  return firstMatch(url, [
    /@(-?\d+\.?\d*),\s*(-?\d+\.?\d*)/,
    /\/search\/(-?\d+\.?\d*),\s*(-?\d+\.?\d*)/,
  ]);
}

/**
 * Extract lat/lng from common Google Maps URL shapes (full or already-resolved).
 * Prefers the place pin (`!3d/!4d`) over map camera center (`@lat,lng`).
 */
export function parseCoordsFromMapsUrl(rawUrl: string): MapsLatLng | null {
  return (
    parsePlacePinCoordsFromMapsUrl(rawUrl) ||
    parseViewportCoordsFromMapsUrl(rawUrl)
  );
}

/** Best-effort place name from a maps URL when coords are missing. */
export function parsePlaceQueryFromMapsUrl(rawUrl: string): string | null {
  try {
    const withProto = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
    const u = new URL(withProto);
    const placeMatch = u.pathname.match(/\/maps\/place\/([^/@]+)/);
    if (placeMatch?.[1]) {
      return decodeURIComponent(placeMatch[1].replace(/\+/g, " "));
    }
    const q = u.searchParams.get("q") || u.searchParams.get("query");
    if (q && !/^-?\d+\.?\d*,\s*-?\d+\.?\d*$/.test(q)) return q;
  } catch {
    /* ignore */
  }
  return null;
}

/** Normalize GPS storage to plain "lat, lng" (6 dp). */
export function formatGpsCoords(lat: number, lng: number): string {
  return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
}
