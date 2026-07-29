import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/utils/rate-limiter";
import { createAdminClient } from "@/utils/supabase/admin";
import { getDeployCompanyId } from "@/config/loadClientConfig";

function normalizePhone(raw: string): string {
  return raw.replace(/\s+/g, "").trim();
}

export async function POST(req: NextRequest) {
  const rate = checkRateLimit(`service-ticket-lookup-${req.headers.get("x-forwarded-for") || "local"}`);
  if (!rate.allowed) {
    return NextResponse.json({ error: "Too many requests. Please try again shortly." }, { status: 429 });
  }

  const body = await req.json().catch(() => ({}));
  const phone = normalizePhone(typeof body.phone === "string" ? body.phone : "");
  let companyId: string;
  try {
    companyId = getDeployCompanyId();
  } catch {
    return NextResponse.json({ customer: null, orders: [] });
  }

  if (!phone) {
    return NextResponse.json({ customer: null, orders: [] });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Unable to look up orders right now. Please try again." }, { status: 500 });
  }

  const { data: customer, error: customerError } = await admin
    .from("customers")
    .select("id, name, phone, whatsapp")
    .eq("company_id", companyId)
    .or(`phone.eq.${phone},whatsapp.eq.${phone}`)
    .limit(1)
    .maybeSingle();

  if (customerError) {
    console.error("[service-ticket/lookup] customer query failed:", customerError.message);
    return NextResponse.json({ customer: null, orders: [] });
  }
  if (!customer) {
    return NextResponse.json({ customer: null, orders: [] });
  }

  const { data: orders, error: ordersError } = await admin
    .from("orders")
    .select("id, order_id, client_name, business_name, stage, date_created, product_type")
    .eq("company_id", companyId)
    .eq("customer_id", customer.id)
    .order("date_created", { ascending: false });

  if (ordersError) {
    console.error("[service-ticket/lookup] orders query failed:", ordersError.message);
    return NextResponse.json({ customer: null, orders: [] });
  }

  return NextResponse.json({
    customer: {
      id: customer.id,
      name: customer.name || "",
      businessName: (orders?.[0]?.business_name as string | undefined) || "",
    },
    orders: (orders || []).map((order) => ({
      id: order.id,
      orderId: order.order_id,
      label: [order.order_id, order.business_name, order.client_name].filter(Boolean).join(" - ") || order.order_id || "Order",
      stage: order.stage,
      productType: order.product_type,
      dateCreated: order.date_created,
    })),
  });
}
