import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/utils/rate-limiter";
import { createAdminClient } from "@/utils/supabase/admin";
import {
  uploadBase64ToStorageBucket,
  uploadFileToStorageBucket,
} from "@/utils/supabase/serverStorageUpload";
import {
  assertUploadPayload,
  parseUploadRequest,
} from "@/utils/supabase/parseUploadRequest";
import { resolveStaffUploadUser } from "@/utils/storage/resolveStaffUploadUser";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") || "local";
  const rate = checkRateLimit(`staff-upload-${ip}`);
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

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Server not configured" }, { status: 500 });
  }

  let parsed;
  try {
    parsed = await parseUploadRequest(req, "site_visit_photo");
    assertUploadPayload(parsed);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Invalid upload request";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    const result = parsed.fileBase64
      ? await uploadBase64ToStorageBucket(admin, {
          orderId: parsed.orderId,
          purpose: parsed.purpose,
          fileBase64: parsed.fileBase64,
          fileName: parsed.fileName || "upload.jpg",
          contentType: parsed.contentType,
        })
      : await uploadFileToStorageBucket(admin, {
          orderId: parsed.orderId,
          file: parsed.file!,
          fileName: parsed.fileName,
          purpose: parsed.purpose,
        });

    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
