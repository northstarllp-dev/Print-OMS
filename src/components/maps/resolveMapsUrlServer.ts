import {
  isGoogleMapsUrl,
  parsePlacePinCoordsFromMapsUrl,
  parsePlaceQueryFromMapsUrl,
  parseViewportCoordsFromMapsUrl,
  type MapsLatLng,
} from "@/components/maps/mapsUrl";

export type ResolvedMapsLocation = MapsLatLng & {
  address: string;
  resolvedUrl?: string;
};

async function followMapsRedirect(url: string): Promise<string> {
  const normalized = /^https?:\/\//i.test(url) ? url : `https://${url}`;
  let res = await fetch(normalized, {
    method: "HEAD",
    redirect: "follow",
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; PrintOMS/1.0; +https://printoms.thepolarislabs.com)",
      Accept: "text/html,application/xhtml+xml",
    },
  });
  if (!res.url || res.url === normalized) {
    res = await fetch(normalized, {
      method: "GET",
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; PrintOMS/1.0; +https://printoms.thepolarislabs.com)",
        Accept: "text/html,application/xhtml+xml",
      },
    });
  }
  return res.url || normalized;
}

type CachedGeocode = {
  address: string;
  expiresAt: number;
};

const GEOCODE_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const geocodeMemoryCache = new Map<string, CachedGeocode>();

function getGeocodeCacheKey(lat: number, lng: number): string {
  // 4 decimal places = ~11m precision (building/address level)
  return `${lat.toFixed(4)},${lng.toFixed(4)}`;
}

/** Reverse-geocode exact coordinates (never unbound place-name search). Cached for 24h. */
async function reverseGeocode(
  lat: number,
  lng: number
): Promise<string | null> {
  const cacheKey = getGeocodeCacheKey(lat, lng);
  const cached = geocodeMemoryCache.get(cacheKey);
  const now = Date.now();
  if (cached && cached.expiresAt > now) {
    return cached.address;
  }

  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!key) return null;
  const endpoint = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  endpoint.searchParams.set("latlng", `${lat},${lng}`);
  endpoint.searchParams.set("key", key);
  const res = await fetch(endpoint.toString(), {
    next: { revalidate: 86400 },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    status: string;
    results?: Array<{ formatted_address?: string }>;
  };
  if (data.status !== "OK" || !data.results?.[0]?.formatted_address) return null;
  const address = data.results[0].formatted_address;

  if (geocodeMemoryCache.size > 1000) {
    const oldestKey = geocodeMemoryCache.keys().next().value;
    if (oldestKey) geocodeMemoryCache.delete(oldestKey);
  }
  geocodeMemoryCache.set(cacheKey, {
    address,
    expiresAt: now + GEOCODE_CACHE_TTL_MS,
  });

  return address;
}

/**
 * Resolve a Google Maps share/search URL to coordinates + a human address.
 *
 * Prefers the place pin (`!3d/!4d`) over camera center (`@lat,lng`), which is often
 * slightly offset from the shared pin. Never returns the pasted Maps URL as the address.
 */
export async function resolveMapsUrlToLocation(
  url: string
): Promise<ResolvedMapsLocation | null> {
  const trimmed = url.trim();
  if (!trimmed || !isGoogleMapsUrl(trimmed)) return null;

  let finalUrl = trimmed;
  if (/maps\.app\.goo\.gl/i.test(trimmed) || /goo\.gl\/maps/i.test(trimmed)) {
    finalUrl = await followMapsRedirect(trimmed);
  }

  const placeName = parsePlaceQueryFromMapsUrl(finalUrl);
  const viewport = parseViewportCoordsFromMapsUrl(finalUrl);
  const pin = parsePlacePinCoordsFromMapsUrl(finalUrl);

  // Prefer place pin (!3d/!4d) — exact drop pin. @lat,lng is camera center and often nearby-only.
  const coords: MapsLatLng | null = pin || viewport;
  if (!coords) return null;

  const street = await reverseGeocode(coords.lat, coords.lng);
  let address: string;
  if (street && placeName) {
    address = street.toLowerCase().includes(placeName.toLowerCase())
      ? street
      : `${placeName}, ${street}`;
  } else {
    address =
      street ||
      placeName ||
      `${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}`;
  }

  if (isGoogleMapsUrl(address)) {
    address = placeName || `${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}`;
  }

  return {
    lat: coords.lat,
    lng: coords.lng,
    address,
    resolvedUrl: finalUrl,
  };
}
