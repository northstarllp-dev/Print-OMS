import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/utils/rate-limiter";
import { createAdminClient } from "@/utils/supabase/admin";
import { assertPortalUploadAccess } from "@/utils/portal/portalUploadAuth";
import {
  uploadBase64ToStorageBucket,
  uploadFileToStorageBucket,
} from "@/utils/supabase/serverStorageUpload";
import {
  assertUploadPayload,
  parseUploadRequest,
  portalScopeForPurpose,
} from "@/utils/supabase/parseUploadRequest";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") || "local";
  const rate = checkRateLimit(`portal-upload-${ip}`);
  if (!rate.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Server not configured" }, { status: 500 });
  }

  let parsed;
  try {
    parsed = await parseUploadRequest(req, "design_resource");
    assertUploadPayload(parsed);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Invalid upload request";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    const orderUuid = await assertPortalUploadAccess(
      parsed.orderId,
      portalScopeForPurpose(parsed.purpose),
      parsed.portalToken
    );

    const result = parsed.fileBase64
      ? await uploadBase64ToStorageBucket(admin, {
          orderId: orderUuid,
          purpose: parsed.purpose,
          fileBase64: parsed.fileBase64,
          fileName: parsed.fileName || "upload.jpg",
          contentType: parsed.contentType,
        })
      : await uploadFileToStorageBucket(admin, {
          orderId: orderUuid,
          file: parsed.file!,
          fileName: parsed.fileName,
          purpose: parsed.purpose,
        });

    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Upload failed";
    const status =
      message === "Unauthorized" || message.toLowerCase().includes("unauthorized")
        ? 401
        : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
