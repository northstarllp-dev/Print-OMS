import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import {
  generateAndStorePortalToken,
} from "@/utils/portal-tokens";

async function getSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {}
        },
      },
    }
  );
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const customerId = searchParams.get("customer_id");
  const orderId = searchParams.get("order_id");

  if (!customerId) {
    return NextResponse.json(
      { error: "customer_id is required" },
      { status: 400 }
    );
  }

  const supabase = await getSupabase();
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();
  if (userErr || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Resolve to UUIDs so portal tokens never store ambiguous friendly IDs (A004, etc.)
  let resolvedCustomerUuid: string;
  let resolvedOrderUuid: string | undefined;

  try {
    const { assertCustomerTenantAccess, assertOrderTenantAccess } = await import(
      "@/utils/portal/portalTenantAuth"
    );
    const { getCurrentUser } = await import(
      "@/features/auth/actions/authActions"
    );
    const { loadClientConfig } = await import("@/config/loadClientConfig");
    const profile = await getCurrentUser();
    if (!profile) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const config = loadClientConfig();
    if (profile.company_id && profile.company_id !== config.companyId) {
      return NextResponse.json(
        { error: "Unauthorized access. This account belongs to a different client workspace." },
        { status: 403 }
      );
    }

    const customer = await assertCustomerTenantAccess(customerId);
    resolvedCustomerUuid = customer.id;

    if (orderId) {
      const order = await assertOrderTenantAccess(orderId);
      if (order.customer_id && order.customer_id !== customer.id) {
        return NextResponse.json(
          { error: "Order does not belong to this customer." },
          { status: 403 }
        );
      }
      resolvedOrderUuid = order.id;
    }
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Unauthorized" },
      { status: 403 }
    );
  }

  const { getRequestBaseUrl } = await import(
    "@/features/notifications/whatsapp/requestBaseUrl"
  );
  const requestBaseUrl = await getRequestBaseUrl();

  try {
    const { token, url } = await generateAndStorePortalToken(
      supabase,
      resolvedCustomerUuid,
      resolvedOrderUuid,
      { expiresInDays: 30, createdBy: "api", baseUrl: requestBaseUrl }
    );
    return NextResponse.json({ token, url });
  } catch (err: any) {
    console.error("[api/portal-token] Token generation failed:", err.message);
    return NextResponse.json(
      { error: "Failed to generate portal token" },
      { status: 500 }
    );
  }
}
