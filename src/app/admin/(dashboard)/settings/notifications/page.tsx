import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { WhatsAppTestPanel } from "@/features/settings/components/WhatsAppTestPanel";
import { isWhatsAppConfigured } from "@/features/notifications/whatsapp/phone";
import { isWhatsAppTestMode } from "@/features/notifications/whatsapp/testMode";

export default async function NotificationsSettingsPage() {
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
  if (!user) redirect("/admin/login");

  const initialStatus = {
    configured: isWhatsAppConfigured(),
    enabled: process.env.WHATSAPP_ENABLED !== "false",
    testMode: isWhatsAppTestMode(),
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || null,
    wabaId: process.env.META_WABA_ID || null,
    graphVersion: process.env.WHATSAPP_GRAPH_API_VERSION || "v21.0",
    defaultTestPhone: process.env.WHATSAPP_TEST_PHONE || null,
  };

  return <WhatsAppTestPanel initialStatus={initialStatus} />;
}
