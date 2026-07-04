import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { sendWhatsAppTemplateMessage } from "@/features/notifications/whatsapp/metaClient";
import { normalizeWhatsAppPhone } from "@/features/notifications/whatsapp/phone";

/**
 * POST /api/whatsapp/test
 * Sends Meta's hello_world template to verify API credentials.
 * Auth: logged-in staff OR header x-whatsapp-test-secret matching WHATSAPP_TEST_SECRET.
 */
export async function POST(req: NextRequest) {
  const testSecret = process.env.WHATSAPP_TEST_SECRET;
  const headerSecret = req.headers.get("x-whatsapp-test-secret");

  let authorized = Boolean(testSecret && headerSecret === testSecret);

  if (!authorized) {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll() {},
        },
      }
    );
    const {
      data: { user },
    } = await supabase.auth.getUser();
    authorized = Boolean(user);
  }

  if (!authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const rawPhone =
    body.phone ||
    process.env.WHATSAPP_TEST_PHONE ||
    "15556275106";

  const phone = normalizeWhatsAppPhone(rawPhone);
  if (!phone) {
    return NextResponse.json({ error: "Invalid phone number" }, { status: 400 });
  }

  const result = await sendWhatsAppTemplateMessage({
    to: phone,
    useHelloWorld: true,
  });

  if (!result.success) {
    return NextResponse.json(
      { error: result.error, raw: result.raw },
      { status: 502 }
    );
  }

  return NextResponse.json({
    ok: true,
    to: phone,
    messageId: result.messageId,
  });
}
