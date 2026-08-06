import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/utils/rate-limiter";
import { createAdminClient } from "@/utils/supabase/admin";
import { getDeployCompanyId } from "@/config/loadClientConfig";
import {
  buildOrderObjectPath,
  extFromNameOrMime,
  isValidOrderScopedPath,
  validateUploadForPurpose,
} from "@/utils/supabase/storageConfig";

const MAX_PHOTOS = 12;
const PHOTO_MAX_BYTES = 50 * 1024 * 1024;

function normalizePhone(raw: string): string {
  return raw.replace(/\s+/g, "").trim();
}

export async function POST(req: NextRequest) {
  const rate = checkRateLimit(`service-ticket-submit-${req.headers.get("x-forwarded-for") || "local"}`);
  if (!rate.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Server not configured" }, { status: 500 });
  }

  let companyId: string;
  try {
    companyId = getDeployCompanyId();
  } catch {
    return NextResponse.json({ error: "Server not configured" }, { status: 500 });
  }

  const contentType = req.headers.get("content-type") || "";
  let customerId = "";
  let orderId = "";
  let description = "";
  let phone = "";
  const photos: Array<{ url: string; name: string; uploadedBy: string; createdAt: string }> = [];
  // Track uploaded objects so we can roll back on DB failure.
  const uploadedObjects: Array<{ bucket: string; path: string }> = [];

  async function rollbackUploads() {
    for (const obj of uploadedObjects) {
      try {
        await admin.storage.from(obj.bucket).remove([obj.path]);
      } catch (e) {
        console.error("[service-ticket] rollback delete failed:", e);
      }
    }
  }

  if (contentType.includes("multipart/form-data")) {
    const formData = await req.formData();
    customerId = String(formData.get("customerId") || "");
    orderId = String(formData.get("orderId") || "");
    description = String(formData.get("description") || "");
    phone = normalizePhone(String(formData.get("phone") || ""));

    const files = formData.getAll("photos").filter(f => f instanceof File) as File[];
    if (files.length > MAX_PHOTOS) {
      return NextResponse.json(
        { error: `You can upload at most ${MAX_PHOTOS} photos.` },
        { status: 400 }
      );
    }
    try {
      for (const fileValue of files) {
        const validation = validateUploadForPurpose("service_ticket_photo", {
          fileName: fileValue.name,
          size: fileValue.size,
          mime: fileValue.type || undefined,
        });
        if (!validation.ok) {
          throw new Error(validation.message);
        }
        const ext = extFromNameOrMime(fileValue.name, fileValue.type || undefined);
        const path = buildOrderObjectPath(orderId, ext);
        if (!isValidOrderScopedPath(orderId, path)) {
          throw new Error("Invalid upload path");
        }
        const fileBuffer = Buffer.from(await fileValue.arrayBuffer());

        const { error: uploadError } = await admin.storage
          .from("service-ticket-photos")
          .upload(path, fileBuffer, {
            contentType: fileValue.type || "application/octet-stream",
            upsert: false,
          });

        if (uploadError) {
          throw new Error(uploadError.message);
        }
        uploadedObjects.push({ bucket: "service-ticket-photos", path });

        photos.push({
          url: `service-ticket-photos/${path}`,
          name: fileValue.name,
          uploadedBy: "Customer",
          createdAt: new Date().toISOString(),
        });
      }
    } catch (uploadError: any) {
      await rollbackUploads();
      console.error("[service-ticket] photo upload failed:", uploadError?.message);
      return NextResponse.json({ error: uploadError?.message || "Unable to upload photos. Please try again." }, { status: 400 });
    }
  } else {
    const body = await req.json().catch(() => ({}));
    customerId = typeof body.customerId === "string" ? body.customerId : "";
    orderId = typeof body.orderId === "string" ? body.orderId : "";
    description = typeof body.description === "string" ? body.description : "";
    phone = normalizePhone(typeof body.phone === "string" ? body.phone : "");
    const bodyPhotos = Array.isArray(body.photos) ? body.photos : [];
    for (const item of bodyPhotos) {
      if (!item || typeof item !== "object" || typeof item.url !== "string") continue;
      photos.push({
        url: item.url,
        name: typeof item.name === "string" ? item.name : "photo",
        uploadedBy: "Customer",
        createdAt: new Date().toISOString(),
      });
    }
  }

  if (!customerId || !orderId || !description || !phone) {
    await rollbackUploads();
    return NextResponse.json({ error: "Please complete all required fields." }, { status: 400 });
  }

  const { data: order, error: orderError } = await admin
    .from("orders")
    .select("id, customer_id, company_id")
    .eq("id", orderId)
    .eq("company_id", companyId)
    .maybeSingle();
  if (orderError || !order) {
    await rollbackUploads();
    return NextResponse.json({ error: "Selected order was not found. Please try again." }, { status: 400 });
  }
  if (order.customer_id !== customerId) {
    await rollbackUploads();
    return NextResponse.json({ error: "Selected order does not match this mobile number." }, { status: 400 });
  }

  const { data: created, error: createError } = await admin
    .from("service_tickets")
    .insert({
      company_id: companyId,
      customer_id: customerId,
      order_id: orderId,
      phone,
      description: description.trim(),
      photos,
      source: "public_link",
      status: "open",
      created_by: null,
    })
    .select("id, ticket_id")
    .single();

  if (createError || !created) {
    await rollbackUploads();
    console.error("[service-ticket] create failed:", createError?.message);
    return NextResponse.json({ error: "Unable to submit ticket. Please try again." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, ticketId: created.ticket_id });
}

