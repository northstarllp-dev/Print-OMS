import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { checkRateLimit } from "@/utils/rate-limiter";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { uploadFileToStorageBucket } from "@/utils/supabase/serverStorageUpload";

const BUCKET = "site-visit-photos";

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") || "local";
  const rate = checkRateLimit(`staff-upload-${ip}`);
  if (!rate.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
  const purposeRaw = String(formData.get("purpose") || "site_visit_photo");
  const purpose =
    purposeRaw === "design_resource" ? "design_resource" : "site_visit_photo";

  if (!(file instanceof File) || !orderId) {
    return NextResponse.json({ error: "Missing file or orderId" }, { status: 400 });
  }

  try {
    const result = await uploadFileToStorageBucket(admin, {
      bucket: BUCKET,
      orderId,
      file,
      purpose,
    });

    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
