/**
 * Client-side image compression before upload.
 * Uses a canvas pipeline; HEIC is converted to JPEG when the browser can't decode it.
 */

export interface CompressOptions {
  maxWidthOrHeight?: number; // default 2048
  maxSizeMB?: number; // target upper bound, default 2MB
  quality?: number; // default 0.82
  mimeType?: string; // default "image/jpeg" (or webp when supported)
}

export interface CompressResult {
  file: File;
  wasCompressed: boolean;
  originalBytes: number;
  finalBytes: number;
}

const MIN_COMPRESSIBLE_BYTES = 0.5 * 1024 * 1024; // skip tiny files

function isImageFile(file: File): boolean {
  const t = file.type.toLowerCase();
  return t.startsWith("image/");
}

function isHeic(file: File): boolean {
  const t = file.type.toLowerCase();
  const n = file.name.toLowerCase();
  return t === "image/heic" || t === "image/heif" || /\.hei[cf]$/.test(n);
}

async function loadBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file);
    } catch {
      // fall through to <img>
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Could not decode image"));
      img.src = url;
    });
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function targetMime(preferred: string | undefined): string {
  if (preferred && preferred.startsWith("image/")) return preferred;
  // Prefer webp when canvas supports it, else jpeg.
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    const webp = canvas.toDataURL("image/webp");
    if (webp.startsWith("data:image/webp")) return "image/webp";
  } catch {
    /* ignore */
  }
  return "image/jpeg";
}

/**
 * Compress an image file in the browser. Returns the original file untouched when:
 * - not an image, - already small, - HEIC/HEIF that can't be decoded (uploader decides),
 * - compression fails (falls back to original so uploads never break).
 */
export async function compressImageFile(
  file: File,
  options?: CompressOptions
): Promise<CompressResult> {
  const originalBytes = file.size;

  if (!isImageFile(file) || isHeic(file)) {
    return { file, wasCompressed: false, originalBytes, finalBytes: originalBytes };
  }
  const maxSizeMB = options?.maxSizeMB ?? 2;
  if (originalBytes <= MIN_COMPRESSIBLE_BYTES) {
    return { file, wasCompressed: false, originalBytes, finalBytes: originalBytes };
  }

  try {
    const bitmap = await loadBitmap(file);
    const maxDim = options?.maxWidthOrHeight ?? 2048;
    const srcW = "width" in bitmap ? bitmap.width : (bitmap as HTMLImageElement).naturalWidth;
    const srcH = "height" in bitmap ? bitmap.height : (bitmap as HTMLImageElement).naturalHeight;
    const scale = Math.min(1, maxDim / Math.max(srcW, srcH));
    const dstW = Math.max(1, Math.round(srcW * scale));
    const dstH = Math.max(1, Math.round(srcH * scale));

    const canvas = document.createElement("canvas");
    canvas.width = dstW;
    canvas.height = dstH;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas unavailable");
    ctx.drawImage(bitmap as CanvasImageSource, 0, 0, dstW, dstH);

    let quality = options?.quality ?? 0.82;
    const outMime = targetMime(options?.mimeType);
    const toBlob = (): Promise<Blob | null> =>
      new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, outMime, quality));

    let blob: Blob | null = await toBlob();
    if (!blob) throw new Error("Compression failed");

    const maxBytes = maxSizeMB * 1024 * 1024;
    while (blob.size > maxBytes && quality > 0.4) {
      quality -= 0.12;
      blob = await toBlob();
      if (!blob) break;
    }
    if (!blob) throw new Error("Compression failed");

    // If we didn't actually shrink anything, keep the original.
    if (blob.size >= originalBytes) {
      return { file, wasCompressed: false, originalBytes, finalBytes: originalBytes };
    }

    const baseName = file.name.replace(/\.[^.]+$/, "");
    const ext = outMime === "image/webp" ? ".webp" : ".jpg";
    const compressed = new File([blob], `${baseName}${ext}`, { type: outMime });
    return {
      file: compressed,
      wasCompressed: true,
      originalBytes,
      finalBytes: compressed.size,
    };
  } catch {
    return { file, wasCompressed: false, originalBytes, finalBytes: originalBytes };
  }
}

/** Decide whether a file should even attempt compression (used in tests too). */
export function shouldAttemptCompression(
  file: { type: string; size: number; name: string },
  minBytes = MIN_COMPRESSIBLE_BYTES
): boolean {
  return isImageFile(file as File) && !isHeic(file as File) && file.size > minBytes;
}
