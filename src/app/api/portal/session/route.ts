import { NextRequest, NextResponse } from "next/server";
import { resolvePortalToken } from "@/utils/portal-tokens";
import { checkRateLimit } from "@/utils/rate-limiter";
import { cookies } from "next/headers";

const COOKIE_NAME = "portal_session";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { token } = body;

  if (!token || typeof token !== "string") {
    return NextResponse.json({ error: "Missing or invalid token" }, { status: 400 });
  }

  const rate = checkRateLimit(`portal-session-${token.slice(0, 16)}`);
  if (!rate.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const payload = await resolvePortalToken(token);
  if (!payload) {
    return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 });
  }

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
    sameSite: "lax",
    maxAge: maxAgeSeconds,
    path: "/",
  });

  return res;
}

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
