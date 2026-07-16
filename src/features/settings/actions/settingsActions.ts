"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import {
  EMPTY_INVOICE_PROFILE,
  normalizeInvoiceProfile,
  type InvoiceProfile,
} from "@/features/quotations/types/invoiceProfile";

export interface AppSettings {
  siteVisitSchedulingEnabled: boolean;
  installationSchedulingEnabled: boolean;
  invoiceProfile: InvoiceProfile;
}

const DEFAULT_SETTINGS: AppSettings = {
  siteVisitSchedulingEnabled: true,
  installationSchedulingEnabled: true,
  invoiceProfile: EMPTY_INVOICE_PROFILE,
};

function mapRow(data: {
  site_visit_scheduling_enabled?: boolean;
  installation_scheduling_enabled?: boolean;
  invoice_profile?: unknown;
}): AppSettings {
  return {
    siteVisitSchedulingEnabled: data.site_visit_scheduling_enabled ?? true,
    installationSchedulingEnabled:
      data.installation_scheduling_enabled ?? true,
    invoiceProfile: normalizeInvoiceProfile(data.invoice_profile),
  };
}

export async function getAppSettings(): Promise<AppSettings> {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (!userError && userData?.user) {
    const { data: userProfile } = await supabase
      .from("users")
      .select("company_id")
      .eq("id", userData.user.id)
      .single();

    if (userProfile?.company_id) {
      return getAppSettingsForCompany(userProfile.company_id);
    }
  }

  return DEFAULT_SETTINGS;
}

export async function getAppSettingsForCompany(
  companyId: string
): Promise<AppSettings> {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data, error } = await supabase
    .from("app_settings")
    .select(
      "site_visit_scheduling_enabled, installation_scheduling_enabled, invoice_profile"
    )
    .eq("company_id", companyId)
    .maybeSingle();

  if (!error && data) {
    return mapRow(data);
  }

  // Create defaults if missing
  const { data: newSettings, error: insertError } = await supabase
    .from("app_settings")
    .insert({
      company_id: companyId,
      site_visit_scheduling_enabled: DEFAULT_SETTINGS.siteVisitSchedulingEnabled,
      installation_scheduling_enabled:
        DEFAULT_SETTINGS.installationSchedulingEnabled,
      invoice_profile: EMPTY_INVOICE_PROFILE,
    })
    .select(
      "site_visit_scheduling_enabled, installation_scheduling_enabled, invoice_profile"
    )
    .single();

  if (!insertError && newSettings) {
    return mapRow(newSettings);
  }

  return DEFAULT_SETTINGS;
}

export async function updateAppSettings(
  settings: Partial<AppSettings>
): Promise<void> {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData?.user) throw new Error("Unauthorized");

  const { data: userProfile } = await supabase
    .from("users")
    .select("company_id")
    .eq("id", userData.user.id)
    .single();

  if (!userProfile?.company_id) throw new Error("No company found for user");

  const current = await getAppSettingsForCompany(userProfile.company_id);

  const newSiteVisit =
    settings.siteVisitSchedulingEnabled ?? current.siteVisitSchedulingEnabled;
  const newInstallation =
    settings.installationSchedulingEnabled ??
    current.installationSchedulingEnabled;
  const newInvoiceProfile = normalizeInvoiceProfile(
    settings.invoiceProfile !== undefined
      ? { ...current.invoiceProfile, ...settings.invoiceProfile, bank: {
          ...current.invoiceProfile.bank,
          ...settings.invoiceProfile?.bank,
        } }
      : current.invoiceProfile
  );

  const { error: upsertError } = await supabase.from("app_settings").upsert(
    {
      company_id: userProfile.company_id,
      site_visit_scheduling_enabled: newSiteVisit,
      installation_scheduling_enabled: newInstallation,
      invoice_profile: newInvoiceProfile,
    },
    { onConflict: "company_id" }
  );

  if (upsertError) {
    console.error("Failed to upsert app settings:", upsertError);
    throw new Error("Failed to update settings");
  }

  revalidatePath("/admin/settings");
  revalidatePath("/portal");
}

export async function updateInvoiceProfile(
  profile: InvoiceProfile
): Promise<void> {
  await updateAppSettings({ invoiceProfile: normalizeInvoiceProfile(profile) });
}
