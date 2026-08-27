import { NextRequest, NextResponse } from "next/server";
import { checkCustomRateLimit, checkRateLimit } from "@/utils/rate-limiter";
import { issueSignedUpload } from "@/utils/supabase/storageIssue";
import { VALID_PURPOSES } from "@/utils/supabase/parseUploadRequest";
import type { StorageUploadPurpose } from "@/utils/supabase/serverStorageUpload";
import { resolveStaffUploadUser } from "@/utils/storage/resolveStaffUploadUser";

export const runtime = "nodejs";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Staff: issue credentials for a direct client→Storage upload. */
export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") || "local";
  const rate = checkRateLimit(`staff-sign-upload-${ip}`);
  if (!rate.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const user = await resolveStaffUploadUser(req);
  if (!user) {
    return NextResponse.json(
      { error: "Session expired. Please log in again and retry the upload." },
      { status: 401 }
    );
  }

  let body: {
    orderId?: string;
    itemId?: string;
    purpose?: string;
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
  const itemId = String(body.itemId || "").trim() || undefined;
  const purpose = (body.purpose || "site_visit_photo") as StorageUploadPurpose;
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
    const issued = await issueSignedUpload(purpose, orderId, {
      fileName,
      size,
      mime: body.mime,
      itemId,
    });
    return NextResponse.json(issued);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Could not issue upload";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
