import { NextRequest } from "next/server";
import type { StorageUploadPurpose } from "@/utils/supabase/serverStorageUpload";

export const VALID_PURPOSES = new Set<StorageUploadPurpose>([
  "design_resource",
  "design_proof",
  "production_asset",
  "site_visit_photo",
  "installation_photo",
  "service_ticket_photo",
  "service_ticket_resolution_photo",
]);

export interface ParsedUploadRequest {
  orderId: string;
  purpose: StorageUploadPurpose;
  portalToken?: string;
  fileBase64?: string;
  fileName?: string;
  contentType?: string;
  file?: File | Blob;
}

function normalizePurpose(raw: string, fallback: StorageUploadPurpose): StorageUploadPurpose {
  if (VALID_PURPOSES.has(raw as StorageUploadPurpose)) {
    return raw as StorageUploadPurpose;
  }
  return fallback;
}

export async function parseUploadRequest(
  req: NextRequest,
  defaultPurpose: StorageUploadPurpose
): Promise<ParsedUploadRequest> {
  const contentType = req.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const orderId = String(body.orderId || "").trim();
    const purpose = normalizePurpose(String(body.purpose || defaultPurpose), defaultPurpose);
    const portalToken =
      typeof body.portalToken === "string" ? body.portalToken : undefined;
    const fileBase64 =
      typeof body.fileBase64 === "string" ? body.fileBase64 : undefined;
    const fileName =
      typeof body.fileName === "string" ? body.fileName : undefined;
    const mimeType =
      typeof body.contentType === "string" ? body.contentType : undefined;

    return { orderId, purpose, portalToken, fileBase64, fileName, contentType: mimeType };
  }

  const formData = await req.formData();
  const file = formData.get("file");
  const orderId = String(formData.get("orderId") || "").trim();
  const purpose = normalizePurpose(
    String(formData.get("purpose") || defaultPurpose),
    defaultPurpose
  );
  const portalToken = formData.get("portalToken");
  const fileName = formData.get("fileName");

  return {
    orderId,
    purpose,
    portalToken: typeof portalToken === "string" ? portalToken : undefined,
    file:
      file instanceof Blob && file.size > 0
        ? file
        : undefined,
    fileName:
      typeof fileName === "string"
        ? fileName
        : file instanceof File
          ? file.name
          : undefined,
    contentType: file instanceof Blob && file.type ? file.type : undefined,
  };
}

export function portalScopeForPurpose(purpose: StorageUploadPurpose): string {
  if (
    purpose === "design_resource" ||
    purpose === "design_proof" ||
    purpose === "production_asset"
  ) {
    return "approve_design";
  }
  return "schedule_visit";
}

export function assertUploadPayload(parsed: ParsedUploadRequest): void {
  if (!parsed.orderId) {
    throw new Error("Missing orderId");
  }
  if (!parsed.fileBase64 && !parsed.file) {
    throw new Error("Missing file data");
  }
}
