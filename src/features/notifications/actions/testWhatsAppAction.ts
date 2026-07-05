"use server";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { sendWhatsAppTemplateMessage } from "@/features/notifications/whatsapp/metaClient";
import {
  isWhatsAppConfigured,
  normalizeWhatsAppPhone,
} from "@/features/notifications/whatsapp/phone";
import { isWhatsAppTestMode } from "@/features/notifications/whatsapp/testMode";

async function requireStaffUser() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
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
          } catch {
            // ignore
          }
        },
      },
    }
  );
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized: admin login required.");
  return user;
}

export type WhatsAppConfigStatus = {
  configured: boolean;
  enabled: boolean;
  testMode: boolean;
  phoneNumberId: string | null;
  wabaId: string | null;
  graphVersion: string;
  defaultTestPhone: string | null;
};

export async function getWhatsAppConfigStatusAction(): Promise<WhatsAppConfigStatus> {
  await requireStaffUser();
  return {
    configured: isWhatsAppConfigured(),
    enabled: process.env.WHATSAPP_ENABLED !== "false",
    testMode: isWhatsAppTestMode(),
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || null,
    wabaId: process.env.META_WABA_ID || null,
    graphVersion: process.env.WHATSAPP_GRAPH_API_VERSION || "v21.0",
    defaultTestPhone: process.env.WHATSAPP_TEST_PHONE || null,
  };
}

export type HelloWorldTestResult = {
  ok: boolean;
  to?: string;
  messageId?: string;
  error?: string;
  hint?: string;
};

/** Send Meta's pre-approved hello_world template to verify token + Phone Number ID. */
export async function testWhatsAppHelloWorldAction(
  phone?: string
): Promise<HelloWorldTestResult> {
  await requireStaffUser();

  if (!isWhatsAppConfigured()) {
    return {
      ok: false,
      error: "WhatsApp is not configured.",
      hint: "Set WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID in .env",
    };
  }

  if (process.env.WHATSAPP_ENABLED === "false") {
    return {
      ok: false,
      error: "WhatsApp is disabled (WHATSAPP_ENABLED=false).",
    };
  }

  const raw = phone?.trim() || process.env.WHATSAPP_TEST_PHONE || "";
  if (!raw) {
    return {
      ok: false,
      error: "No test phone configured.",
      hint:
        "Add your WhatsApp number in Meta Developer Console → WhatsApp → API Setup → To, then set WHATSAPP_TEST_PHONE in .env.local (digits only, country code included).",
    };
  }

  const normalized = normalizeWhatsAppPhone(raw);
  if (!normalized) {
    return {
      ok: false,
      error: `Invalid phone number: ${raw}`,
      hint: "Use E.164 digits only, e.g. 919876543210",
    };
  }

  const result = await sendWhatsAppTemplateMessage({
    to: normalized,
    useHelloWorld: true,
  });

  if (!result.success) {
    const err = result.error || "Send failed";
    let hint: string | undefined;
    if (/recipient|not in allowed|131030/i.test(err)) {
      hint =
        "Add this number as a test recipient in Meta Developer Console → WhatsApp → API Setup.";
    } else if (/template|132000|132001/i.test(err)) {
      hint = "hello_world should work on test WABA; check Phone Number ID and token.";
    } else if (/expired|190|OAuth/i.test(err)) {
      hint = "Access token expired — generate a new token in Meta Developer Console.";
    }
    return { ok: false, to: normalized, error: err, hint };
  }

  return {
    ok: true,
    to: normalized,
    messageId: result.messageId,
    hint: "Check WhatsApp on the recipient phone for the hello_world message.",
  };
}
