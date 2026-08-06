import { NextRequest, NextResponse } from "next/server";
import { checkCustomRateLimit, checkRateLimit } from "@/utils/rate-limiter";
import { assertPortalUploadAccess } from "@/utils/portal/portalUploadAuth";
import { issueSignedUpload } from "@/utils/supabase/storageIssue";
import { VALID_PURPOSES, portalScopeForPurpose } from "@/utils/supabase/parseUploadRequest";
import type { StorageUploadPurpose } from "@/utils/supabase/serverStorageUpload";

export const runtime = "nodejs";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Portal: issue credentials for a direct client→Storage upload (token-scoped). */
export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") || "local";
  const rate = checkRateLimit(`portal-sign-upload-${ip}`);
  if (!rate.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  let body: {
    orderId?: string;
    purpose?: string;
    portalToken?: string;
    fileName?: string;
    size?: number;
    mime?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const orderId = String(body.orderId || "").trim();
  const purpose = (body.purpose || "design_resource") as StorageUploadPurpose;
  const fileName = String(body.fileName || "upload").trim() || "upload";
  const size = Number(body.size || 0);

  if (!UUID_RE.test(orderId)) {
    return NextResponse.json({ error: "Invalid orderId" }, { status: 400 });
  }
  if (!VALID_PURPOSES.has(purpose)) {
    return NextResponse.json({ error: "Invalid purpose" }, { status: 400 });
  }

  // Per-order upload quota: 60 signed uploads / order / minute.
  const orderQuota = checkCustomRateLimit(`sign-upload-order-${orderId}`, 60);
  if (!orderQuota.allowed) {
    return NextResponse.json(
      { error: "Too many uploads for this order. Slow down." },
      { status: 429 }
    );
  }

  try {
    // Tenant + scope check before issuing any storage credential.
    const orderUuid = await assertPortalUploadAccess(
      orderId,
      portalScopeForPurpose(purpose),
      body.portalToken
    );
    const issued = await issueSignedUpload(purpose, orderUuid, {
      fileName,
      size,
      mime: body.mime,
    });
    return NextResponse.json(issued);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Could not issue upload";
    const status = message === "Unauthorized" ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
