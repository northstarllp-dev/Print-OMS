"use client";

/**
 * Client-side upload engine.
 * - Images: compress → signed-upload URL → direct XHR upload (progress) → returns path.
 * - Production files: TUS resumable upload (6MB chunks) when tus-js-client is present,
 *   otherwise falls back to the signed URL direct upload.
 */

import type { StorageUploadPurpose } from "@/utils/supabase/serverStorageUpload";
import { compressImageFile } from "@/utils/storage/compressImage";
import { runQueue, TUS_CHUNK_SIZE, type QueueProgress } from "@/utils/storage/uploadQueue";
import { withBasePath } from "@/lib/appBasePath";

export interface UploadOutcome {
  bucket: string;
  path: string;
  fileName: string;
  wasCompressed: boolean;
}

export interface PerFileProgress {
  index: number;
  fileName: string;
  loaded: number;
  total: number;
  percent: number;
  stage: "compressing" | "uploading" | "done" | "error";
  error?: string;
}

export interface UploadFilesOptions {
  orderId: string;
  purpose: StorageUploadPurpose;
  /** "staff" uses /api/storage/sign-upload; "portal" uses /api/portal/sign-upload. */
  channel: "staff" | "portal";
  portalToken?: string;
  concurrency?: number;
  onFileProgress?: (p: PerFileProgress) => void;
  onQueueProgress?: (p: QueueProgress) => void;
  signal?: AbortSignal;
  compress?: boolean;
}

interface SignUploadResponse {
  bucket: string;
  path: string;
  token?: string;
  signedUrl?: string;
  tus?: { endpoint: string; uploadUrl: string; useSessionToken: boolean };
}

async function getStaffAccessToken(): Promise<string | null> {
  try {
    const { createClient } = await import("@/utils/supabase/client");
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    let accessToken = session?.access_token ?? null;

    // Refresh when missing or near expiry so sign-upload cookies/Bearer stay valid.
    const expiresAtMs = session?.expires_at ? session.expires_at * 1000 : 0;
    const needsRefresh = !accessToken || (expiresAtMs > 0 && expiresAtMs <= Date.now() + 60_000);
    if (needsRefresh) {
      const { data: refreshed, error } = await supabase.auth.refreshSession();
      if (!error && refreshed.session?.access_token) {
        accessToken = refreshed.session.access_token;
      }
    }
    return accessToken;
  } catch {
    return null;
  }
}

async function requestSignedUpload(
  channel: "staff" | "portal",
  body: Record<string, unknown>
): Promise<SignUploadResponse> {
  const endpoint =
    channel === "portal" ? "/api/portal/sign-upload" : "/api/storage/sign-upload";

  const headers: Record<string, string> = { "content-type": "application/json" };
  if (channel === "staff") {
    const token = await getStaffAccessToken();
    if (token) headers.authorization = `Bearer ${token}`;
  }

  const res = await fetch(withBasePath(endpoint), {
    method: "POST",
    headers,
    credentials: "include",
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (json as { error?: string }).error || "Could not start upload";
    if (res.status === 401) {
      throw new Error(
        msg.includes("log in")
          ? msg
          : "Session expired. Please log in again and retry the upload."
      );
    }
    throw new Error(msg);
  }
  return json as SignUploadResponse;
}

function xhrUpload(
  url: string,
  file: File | Blob,
  contentType: string,
  headers: Record<string, string>,
  onProgress: (loaded: number, total: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url, true);
    xhr.setRequestHeader("content-type", contentType);
    for (const [k, v] of Object.entries(headers)) {
      if (k.toLowerCase() !== "authorization") xhr.setRequestHeader(k, v);
    }
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded, e.total);
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(`Upload failed (${xhr.status})`));
    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.onabort = () => reject(new Error("Upload aborted"));
    xhr.send(file);
  });
}

async function tryTusUpload(
  signed: SignUploadResponse,
  file: File,
  onProgress: (loaded: number, total: number) => void,
  signal?: AbortSignal
): Promise<boolean> {
  try {
    const tus = await import("tus-js-client").catch(() => null as any);
    if (!tus?.Upload) return false;

    // TUS needs a live user JWT for private buckets. Prefer signed-URL fallback
    // when the session is gone instead of failing with a vague Unauthorized.
    const accessToken = await getStaffAccessToken();
    if (!accessToken) return false;

    await new Promise<void>((resolve, reject) => {
      const upload = new tus.Upload(file, {
        endpoint: signed.tus!.endpoint,
        chunkSize: TUS_CHUNK_SIZE,
        retryDelays: [0, 3000, 5000, 10000, 20000],
        headers: {
          authorization: `Bearer ${accessToken}`,
          "x-upsert": "false",
        },
        metadata: {
          bucketName: signed.bucket,
          objectName: signed.path,
          contentType: file.type || "application/octet-stream",
          cacheControl: "3600",
        },
        removeFingerprintOnSuccess: true,
        onProgress: (bytesUploaded: number, bytesTotal: number) =>
          onProgress(bytesUploaded, bytesTotal),
        onSuccess: () => resolve(),
        onError: (error: Error) => reject(error),
      } as any);
      if (signal) {
        if (signal.aborted) {
          upload.abort();
          reject(new Error("Upload aborted"));
          return;
        }
        signal.addEventListener("abort", () => upload.abort());
      }
      upload.start();
    });
    return true;
  } catch (tusErr) {
    // Log the TUS error so it's debuggable, then fall back to signed URL upload.
    console.warn("TUS upload failed, falling back to signed URL:", tusErr);
    return false;
  }
}

async function uploadOne(
  file: File,
  index: number,
  opts: UploadFilesOptions
): Promise<UploadOutcome> {
  const report = (p: Partial<PerFileProgress>) =>
    opts.onFileProgress?.({
      index,
      fileName: file.name,
      loaded: 0,
      total: file.size,
      percent: 0,
      stage: "uploading",
      ...p,
    });

  let toUpload: File = file;
  let wasCompressed = false;
  if (opts.compress !== false) {
    report({ stage: "compressing" });
    const result = await compressImageFile(file);
    toUpload = result.file;
    wasCompressed = result.wasCompressed;
  }

  const signed = await requestSignedUpload(opts.channel, {
    orderId: opts.orderId,
    purpose: opts.purpose,
    portalToken: opts.portalToken,
    fileName: toUpload.name,
    size: toUpload.size,
    mime: toUpload.type,
  });

  report({ stage: "uploading" });

  // Prefer TUS for production files; fall back to signed single-shot upload.
  if (signed.tus) {
    const ok = await tryTusUpload(
      signed,
      toUpload,
      (loaded, total) =>
        report({ loaded, total, percent: Math.round((loaded / total) * 100) }),
      opts.signal
    );
    if (ok) {
      report({ stage: "done", loaded: toUpload.size, total: toUpload.size, percent: 100 });
      return { bucket: signed.bucket, path: signed.path, fileName: toUpload.name, wasCompressed };
    }
    // Fall through to signed upload if tus is unavailable / fails to start.
  }

  // Preferred: SDK uploadToSignedUrl (handles auth token correctly).
  if (signed.token) {
    try {
      const { createClient } = await import("@/utils/supabase/client");
      const supabase = createClient();
      const { error } = await supabase.storage
        .from(signed.bucket)
        .uploadToSignedUrl(signed.path, signed.token, toUpload, {
          contentType: toUpload.type || "application/octet-stream",
          upsert: false,
        });
      if (error) throw new Error(error.message);
      report({ stage: "done", loaded: toUpload.size, total: toUpload.size, percent: 100 });
      return { bucket: signed.bucket, path: signed.path, fileName: toUpload.name, wasCompressed };
    } catch (sdkErr) {
      // Fall through to XHR against signedUrl when SDK path fails (e.g. progress needed).
      if (!signed.signedUrl) throw sdkErr;
    }
  }

  if (!signed.signedUrl) {
    throw new Error("Missing signed upload URL");
  }

  await xhrUpload(
    signed.signedUrl,
    toUpload,
    toUpload.type || "application/octet-stream",
    {},
    (loaded, total) =>
      report({ loaded, total, percent: Math.round((loaded / total) * 100) })
  );

  report({ stage: "done", loaded: toUpload.size, total: toUpload.size, percent: 100 });
  return { bucket: signed.bucket, path: signed.path, fileName: toUpload.name, wasCompressed };
}

/** Upload many files with a concurrency-capped queue. */
export async function uploadFiles(
  files: File[],
  opts: UploadFilesOptions
): Promise<{ ok: UploadOutcome[]; failed: { index: number; fileName: string; error: string }[] }> {
  const results = await runQueue(
    files,
    (file, index) => uploadOne(file, index, opts),
    {
      concurrency: opts.concurrency ?? 3,
      onProgress: opts.onQueueProgress,
      signal: opts.signal,
    }
  );

  const ok: UploadOutcome[] = [];
  const failed: { index: number; fileName: string; error: string }[] = [];
  for (const r of results) {
    if (r?.ok && r.value) ok.push(r.value);
    else
      failed.push({
        index: r?.index ?? 0,
        fileName: files[r?.index ?? 0]?.name || "file",
        error:
          r?.error instanceof Error ? r.error.message : "Upload failed",
      });
  }
  return { ok, failed };
}
