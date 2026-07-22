import { withBasePath } from "@/lib/appBasePath";
import type { StorageUploadPurpose } from "@/utils/supabase/serverStorageUpload";

const MIME_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
  gif: "image/gif",
  pdf: "application/pdf",
  svg: "image/svg+xml",
};

function guessContentType(fileName: string, mimeType?: string): string {
  if (mimeType) return mimeType;
  const ext = fileName.split(".").pop()?.toLowerCase() || "";
  return MIME_BY_EXT[ext] || "image/jpeg";
}

function toUploadFile(file: File | Blob, fileName: string): File {
  if (file instanceof File && file.name) return file;
  if (file instanceof File) {
    return new File([file], fileName, { type: file.type || guessContentType(fileName) });
  }
  return new File([file], fileName, { type: file.type || guessContentType(fileName) });
}

function assertNonEmptyFile(file: File | Blob): void {
  if (!file || file.size === 0) {
    throw new Error("Selected file is empty. Please choose another photo.");
  }
}

/** FileReader arrayBuffer — reliable on iOS Safari when file.arrayBuffer() returns empty. */
function readFileViaFileReader(file: File | Blob): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (!(result instanceof ArrayBuffer) || !result.byteLength) {
        reject(new Error("Could not read photo data. Please try again."));
        return;
      }
      resolve(result);
    };
    reader.onerror = () => reject(new Error("Could not read photo data. Please try again."));
    reader.readAsArrayBuffer(file);
  });
}

async function readUploadFile(file: File | Blob, fileName: string): Promise<File> {
  assertNonEmptyFile(file);
  const uploadFile = toUploadFile(file, fileName);
  const contentType = guessContentType(uploadFile.name, uploadFile.type || undefined);

  let buffer: ArrayBuffer;
  try {
    buffer = await uploadFile.arrayBuffer();
    if (!buffer.byteLength) {
      buffer = await readFileViaFileReader(uploadFile);
    }
  } catch {
    buffer = await readFileViaFileReader(uploadFile);
  }

  if (!buffer.byteLength) {
    throw new Error("Could not read photo data. Please try again.");
  }

  return new File([buffer], uploadFile.name || fileName, { type: contentType });
}

async function postMultipartUpload(
  endpoint: string,
  preparedFile: File,
  orderId: string,
  purpose: StorageUploadPurpose,
  portalToken?: string
): Promise<{ url: string; name: string }> {
  const formData = new FormData();
  formData.append("file", preparedFile, preparedFile.name);
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

  return { url: data.url, name: data.name || preparedFile.name };
}

async function postBase64Upload(
  endpoint: string,
  preparedFile: File,
  orderId: string,
  purpose: StorageUploadPurpose,
  portalToken?: string
): Promise<{ url: string; name: string }> {
  const buffer = await preparedFile.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  const fileBase64 = btoa(binary);

  const res = await fetch(withBasePath(endpoint), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      orderId,
      purpose,
      portalToken,
      fileBase64,
      fileName: preparedFile.name,
      contentType: preparedFile.type,
    }),
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

  return { url: data.url, name: data.name || preparedFile.name };
}

async function postFileUpload(
  endpoint: string,
  file: File | Blob,
  orderId: string,
  purpose: StorageUploadPurpose,
  fileName?: string,
  portalToken?: string
): Promise<{ url: string; name: string }> {
  const resolvedName =
    fileName ||
    (file instanceof File ? file.name : "") ||
    "upload.jpg";
  const preparedFile = await readUploadFile(file, resolvedName);

  try {
    return await postMultipartUpload(
      endpoint,
      preparedFile,
      orderId,
      purpose,
      portalToken
    );
  } catch (multipartError) {
    const message =
      multipartError instanceof Error ? multipartError.message : "";
    if (
      message.includes("No content provided") ||
      message.includes("Missing file") ||
      message.includes("empty")
    ) {
      return postBase64Upload(
        endpoint,
        preparedFile,
        orderId,
        purpose,
        portalToken
      );
    }
    throw multipartError;
  }
}

/** Server-side upload for customer portal — reliable on iOS Safari. */
export async function uploadFileViaPortalApi(
  file: File | Blob,
  orderId: string,
  purpose: StorageUploadPurpose,
  portalToken?: string,
  fileName?: string
): Promise<{ url: string; name: string }> {
  return postFileUpload("/api/portal/upload", file, orderId, purpose, fileName, portalToken);
}

/** Server-side upload for authenticated staff — reliable on iOS Safari. */
export async function uploadFileViaStaffApi(
  file: File | Blob,
  orderId: string,
  purpose: StorageUploadPurpose = "site_visit_photo",
  fileName?: string
): Promise<{ url: string; name: string }> {
  return postFileUpload("/api/storage/upload", file, orderId, purpose, fileName);
}
