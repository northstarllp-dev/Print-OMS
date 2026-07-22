import { withBasePath } from "@/lib/appBasePath";

const MIME_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
  gif: "image/gif",
};

function guessContentType(file: File): string {
  if (file.type) return file.type;
  const ext = file.name.split(".").pop()?.toLowerCase() || "";
  return MIME_BY_EXT[ext] || "image/jpeg";
}

function assertNonEmptyFile(file: File): void {
  if (!file || file.size === 0) {
    throw new Error("Selected file is empty. Please choose another photo.");
  }
}

/** Read a browser File as ArrayBuffer — used for direct Supabase client uploads (desktop). */
export async function readFileForStorageUpload(file: File): Promise<{
  body: ArrayBuffer;
  contentType: string;
  ext: string;
}> {
  assertNonEmptyFile(file);

  const body = await file.arrayBuffer();
  if (!body.byteLength) {
    throw new Error("Could not read photo data. Please try again.");
  }

  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  return {
    body,
    contentType: guessContentType(file),
    ext,
  };
}

export type StorageUploadPurpose = "design_resource" | "site_visit_photo";

async function postFileUpload(
  endpoint: string,
  file: File,
  orderId: string,
  purpose: StorageUploadPurpose,
  portalToken?: string
): Promise<{ url: string; name: string }> {
  assertNonEmptyFile(file);

  const formData = new FormData();
  formData.append("file", file, file.name || "upload.jpg");
  formData.append("orderId", orderId);
  formData.append("purpose", purpose);
  if (portalToken) formData.append("portalToken", portalToken);

  const res = await fetch(withBasePath(endpoint), {
    method: "POST",
    body: formData,
    credentials: "include",
  });

  const data = (await res.json().catch(() => ({}))) as {
    url?: string;
    name?: string;
    error?: string;
  };

  if (!res.ok) {
    throw new Error(data.error || `Upload failed (${res.status})`);
  }
  if (!data.url) {
    throw new Error("Upload failed: no URL returned");
  }

  return { url: data.url, name: data.name || file.name };
}

/** Server-side upload for customer portal — reliable on iOS Safari. */
export async function uploadFileViaPortalApi(
  file: File,
  orderId: string,
  purpose: StorageUploadPurpose,
  portalToken?: string
): Promise<{ url: string; name: string }> {
  return postFileUpload("/api/portal/upload", file, orderId, purpose, portalToken);
}

/** Server-side upload for authenticated staff — reliable on iOS Safari. */
export async function uploadFileViaStaffApi(
  file: File,
  orderId: string,
  purpose: StorageUploadPurpose = "site_visit_photo"
): Promise<{ url: string; name: string }> {
  return postFileUpload("/api/storage/upload", file, orderId, purpose);
}
