import { NextRequest, NextResponse } from "next/server";
import { verifyPortalToken } from "@/utils/portal-tokens";
import { checkRateLimit } from "@/utils/rate-limiter";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { isTokenRevoked } from "@/utils/portal-tokens";

const COOKIE_NAME = "portal_session";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { token } = body;

  if (!token || typeof token !== "string") {
    return NextResponse.json({ error: "Missing or invalid token" }, { status: 400 });
  }

  // Rate limit
  const rate = checkRateLimit(`portal-session-${token.slice(0, 16)}`);
  if (!rate.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  // Verify HMAC + expiry
  const payload = verifyPortalToken(token);
  if (!payload) {
    return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 });
  }

  // Check revocation in DB
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  let isRevoked: boolean;
  try {
    isRevoked = await isTokenRevoked(supabase, payload.jti);
  } catch {
    isRevoked = true;
  }

  if (isRevoked) {
    return NextResponse.json({ error: "Token revoked" }, { status: 403 });
  }

  // Dual auth: customer must belong to this deploy's company
  try {
    const { assertCustomerTenantAccess } = await import(
      "@/utils/portal/portalTenantAuth"
    );
    await assertCustomerTenantAccess(payload.customerId);
  } catch (err: any) {
    const msg = err?.message || "Unauthorized";
    const status = msg.includes("different client workspace") ? 403 : 401;
    return NextResponse.json({ error: msg }, { status });
  }

  // Set session cookie with HttpOnly, Secure, SameSite strict
  const cookieValue = JSON.stringify({
    customerId: payload.customerId,
    orderId: payload.orderId,
    scopes: payload.scopes,
    jti: payload.jti,
    exp: payload.exp,
  });

  const now = Math.floor(Date.now() / 1000);
  const maxAgeSeconds = Math.max(0, payload.exp - now);

  const res = NextResponse.json({ success: true, customerId: payload.customerId });
  res.cookies.set(COOKIE_NAME, cookieValue, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax", // Better for email links
    maxAge: maxAgeSeconds,
    path: "/",
  });

  return res;
}

// GET — validate session cookie and return payload (for client-side checks)
export async function GET(req: NextRequest) {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(COOKIE_NAME)?.value;

  if (!sessionCookie) {
    return NextResponse.json({ error: "No session" }, { status: 401 });
  }

  let session: any;
  try {
    session = JSON.parse(sessionCookie);
  } catch {
    return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  }

  // Check expiry
  const now = Math.floor(Date.now() / 1000);
  if (!session.exp || session.exp < now) {
    return NextResponse.json({ error: "Session expired" }, { status: 401 });
  }

  return NextResponse.json({
    customerId: session.customerId,
    orderId: session.orderId,
    scopes: session.scopes,
    jti: session.jti,
  });
}
