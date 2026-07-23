import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/utils/rate-limiter";
import { createAdminClient } from "@/utils/supabase/admin";
import { resolvePublicCompanyId } from "@/features/service-tickets/resolvePublicCompanyId";

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

  const contentType = req.headers.get("content-type") || "";
  let companyId = "";
  let customerId = "";
  let orderId = "";
  let description = "";
  let phone = "";
  const photos: Array<{ url: string; name: string; uploadedBy: string; createdAt: string }> = [];

  if (contentType.includes("multipart/form-data")) {
    const formData = await req.formData();
    companyId = String(formData.get("companyId") || "");
    customerId = String(formData.get("customerId") || "");
    orderId = String(formData.get("orderId") || "");
    description = String(formData.get("description") || "");
    phone = normalizePhone(String(formData.get("phone") || ""));

    const files = formData.getAll("photos").filter(f => f instanceof File) as File[];
    try {
      const uploadedPhotos = await Promise.all(files.map(async (fileValue) => {
        const ext = fileValue.name.split(".").pop() || "jpg";
        const path = `public/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const fileBuffer = Buffer.from(await fileValue.arrayBuffer());
        
        const { error: uploadError } = await admin.storage
          .from("service-ticket-photos")
          .upload(path, fileBuffer, {
            contentType: fileValue.type,
            upsert: false,
          });
          
        if (uploadError) {
          throw new Error(uploadError.message);
        }
        
        const { data } = admin.storage.from("service-ticket-photos").getPublicUrl(path);
        return {
          url: data.publicUrl,
          name: fileValue.name,
          uploadedBy: "Customer",
          createdAt: new Date().toISOString(),
        };
      }));
      photos.push(...uploadedPhotos);
    } catch (uploadError: any) {
      console.error("[service-ticket] photo upload failed:", uploadError?.message);
      return NextResponse.json({ error: "Unable to upload photos. Please try again." }, { status: 500 });
    }
  } else {
    const body = await req.json().catch(() => ({}));
    companyId = typeof body.companyId === "string" ? body.companyId : "";
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

  const resolvedCompanyId = resolvePublicCompanyId(companyId);
  if (!resolvedCompanyId || !customerId || !orderId || !description || !phone) {
    return NextResponse.json({ error: "Please complete all required fields." }, { status: 400 });
  }

  const { data: order, error: orderError } = await admin
    .from("orders")
    .select("id, customer_id, company_id")
    .eq("id", orderId)
    .eq("company_id", resolvedCompanyId)
    .maybeSingle();
  if (orderError || !order) {
    return NextResponse.json({ error: "Selected order was not found. Please try again." }, { status: 400 });
  }
  if (order.customer_id !== customerId) {
    return NextResponse.json({ error: "Selected order does not match this mobile number." }, { status: 400 });
  }

  const { data: created, error: createError } = await admin
    .from("service_tickets")
    .insert({
      company_id: resolvedCompanyId,
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
    console.error("[service-ticket] create failed:", createError?.message);
    return NextResponse.json({ error: "Unable to submit ticket. Please try again." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, ticketId: created.ticket_id });
}

