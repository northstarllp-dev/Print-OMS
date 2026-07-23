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

  // Authenticate caller (must be staff/admin)
  const supabase = await getSupabase();
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();
  if (userErr || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const host = request.headers.get("host") || "localhost:3000";
  const protocol = request.headers.get("x-forwarded-proto") || (host.includes("localhost") ? "http" : "https");
  const requestBaseUrl = `${protocol}://${host}`;

  let resolvedCustomerId = customerId;
  let resolvedOrderId = orderId;

  // We intentionally use UUIDs for resolvedCustomerId and resolvedOrderId if provided,
  // to prevent ambiguous multi-tenant collisions on friendly IDs like 'A002'.

  // Generate a new HMAC-signed portal token and store it for revocation tracking
  try {
    const { token, url } = await generateAndStorePortalToken(
      supabase,
      resolvedCustomerId,
      resolvedOrderId || undefined,
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
