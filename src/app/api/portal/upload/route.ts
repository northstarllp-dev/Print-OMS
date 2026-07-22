import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/utils/rate-limiter";
import { createAdminClient } from "@/utils/supabase/admin";
import { assertPortalUploadAccess } from "@/utils/portal/portalUploadAuth";
import { uploadFileToStorageBucket } from "@/utils/supabase/serverStorageUpload";

const BUCKET = "site-visit-photos";

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

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid upload request" }, { status: 400 });
  }

  const file = formData.get("file");
  const orderId = String(formData.get("orderId") || "").trim();
  const purposeRaw = String(formData.get("purpose") || "design_resource");
  const portalToken = formData.get("portalToken");
  const purpose =
    purposeRaw === "site_visit_photo" ? "site_visit_photo" : "design_resource";
  const requiredScope =
    purpose === "design_resource" ? "approve_design" : "schedule_visit";

  if (!(file instanceof File) || !orderId) {
    return NextResponse.json({ error: "Missing file or orderId" }, { status: 400 });
  }

  try {
    const orderUuid = await assertPortalUploadAccess(
      orderId,
      requiredScope,
      typeof portalToken === "string" ? portalToken : undefined
    );

    const result = await uploadFileToStorageBucket(admin, {
      bucket: BUCKET,
      orderId: orderUuid,
      file,
      purpose,
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
