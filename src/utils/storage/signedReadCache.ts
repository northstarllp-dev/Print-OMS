"use client";

/**
 * In-memory cache for signed read URLs so renders don't regenerate them
 * (each new signed URL is a CDN cache miss).
 */

import { withBasePath } from "@/lib/appBasePath";

interface CacheEntry {
  url: string;
  /** epoch ms when this entry should be re-signed */
  refreshAt: number;
}

// Refresh a bit before the 1h server TTL so URLs never expire mid-view.
const REFRESH_MS = 50 * 60 * 1000;

const cache = new Map<string, CacheEntry>();

function key(bucket: string, path: string, width?: number, format?: string): string {
  return `${bucket}/${path}::${width ?? ""}::${format ?? ""}`;
}

export async function getSignedReadUrl(
  bucket: string,
  path: string,
  options?: { width?: number; height?: number; format?: "origin" }
): Promise<string> {
  const k = key(bucket, path, options?.width, options?.format);
  const hit = cache.get(k);
  const now = Date.now();
  if (hit && hit.refreshAt > now) return hit.url;

  const res = await fetch(withBasePath("/api/storage/sign-read"), {
    method: "POST",
    headers: { "content-type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      bucket,
      path,
      width: options?.width,
      height: options?.height,
      format: options?.format,
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !(json as any).url) {
    throw new Error((json as any).error || "Could not load image");
  }
  const url = (json as any).url as string;
  cache.set(k, { url, refreshAt: now + REFRESH_MS });
  return url;
}

export function clearSignedReadCache(): void {
  cache.clear();
}

/** Test helper: inspect cache size. */
export function signedReadCacheSize(): number {
  return cache.size;
}
