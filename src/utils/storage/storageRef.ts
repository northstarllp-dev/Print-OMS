/**
 * Stored-reference helpers. The app now stores "bucket/path" refs for new
 * uploads; legacy rows still hold full public URLs.
 */

const PUBLIC_OBJECT_RE = /\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/;
const BUCKET_RE = /^[a-z0-9][a-z0-9-]*$/;

/** Parse a stored reference (public URL or "bucket/path") into {bucket, path}. */
export function parseStoredRef(src: string): { bucket: string; path: string } | null {
  if (!src) return null;
  const pub = src.match(PUBLIC_OBJECT_RE);
  if (pub) return { bucket: pub[1], path: decodeURIComponent(pub[2].split("?")[0]) };
  if (/^https?:\/\//.test(src)) return null; // other absolute URL (e.g. signed)
  const slash = src.indexOf("/");
  if (slash > 0) {
    const bucket = src.slice(0, slash);
    const path = src.slice(slash + 1);
    if (BUCKET_RE.test(bucket) && path && !path.includes("..")) {
      return { bucket, path };
    }
  }
  return null;
}

/** Build a "bucket/path" stored ref. */
export function toStoredRef(bucket: string, path: string): string {
  return `${bucket}/${path}`;
}

export function appendPhotoUrls(existing: string[], uploaded: string[]): string[] {
  return [...existing, ...uploaded];
}

export function removePhotoUrl(existing: string[], ref: string): string[] {
  return existing.filter((u) => u !== ref);
}
