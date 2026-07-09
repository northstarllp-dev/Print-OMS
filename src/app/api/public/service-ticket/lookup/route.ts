import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/utils/rate-limiter";
import { createAdminClient } from "@/utils/supabase/admin";

function normalizePhone(raw: string): string {
  return raw.replace(/\s+/g, "").trim();
}

export async function POST(req: NextRequest) {
  const rate = checkRateLimit(`service-ticket-lookup-${req.headers.get("x-forwarded-for") || "local"}`);
  if (!rate.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const body = await req.json().catch(() => ({}));
  const companyId = typeof body.companyId === "string" ? body.companyId : "";
  const phone = normalizePhone(typeof body.phone === "string" ? body.phone : "");

  if (!companyId || !phone) {
    return NextResponse.json({ error: "Missing companyId or phone" }, { status: 400 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Server not configured" }, { status: 500 });
  }

  const { data: customer, error: customerError } = await admin
    .from("customers")
    .select("id, name, phone, whatsapp")
    .eq("company_id", companyId)
    .or(`phone.eq.${phone},whatsapp.eq.${phone}`)
    .limit(1)
    .maybeSingle();

  if (customerError) {
    return NextResponse.json({ error: customerError.message }, { status: 500 });
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
    return NextResponse.json({ error: ordersError.message }, { status: 500 });
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
      label: `${order.order_id} - ${order.client_name || order.business_name || "Order"}`,
      stage: order.stage,
      productType: order.product_type,
      dateCreated: order.date_created,
    })),
  });
}

