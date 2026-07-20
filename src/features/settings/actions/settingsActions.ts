"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import {
  EMPTY_INVOICE_PROFILE,
  normalizeInvoiceProfile,
  type InvoiceProfile,
} from "@/features/quotations/types/invoiceProfile";
import { createAdminClient } from "@/utils/supabase/admin";
import {
  DEFAULT_PRODUCTION_CHECKLIST_ITEMS,
  normalizeProductionChecklistItems,
  type ProductionChecklistItem,
} from "@/features/settings/productionChecklist";
import type { AppSettings, CompanyDetails } from "@/features/settings/settingsTypes";

const DEFAULT_SETTINGS: AppSettings = {
  siteVisitSchedulingEnabled: true,
  installationSchedulingEnabled: true,
  enableFinalProduct: false,
  invoiceProfile: EMPTY_INVOICE_PROFILE,
  productionChecklistItems: DEFAULT_PRODUCTION_CHECKLIST_ITEMS,
};

function mapRow(data: {
  site_visit_scheduling_enabled?: boolean;
  installation_scheduling_enabled?: boolean;
  enable_final_product?: boolean;
  invoice_profile?: unknown;
  production_checklist_items?: unknown;
}): AppSettings {
  return {
    siteVisitSchedulingEnabled: data.site_visit_scheduling_enabled ?? true,
    installationSchedulingEnabled: data.installation_scheduling_enabled ?? true,
    enableFinalProduct: data.enable_final_product ?? false,
    invoiceProfile: normalizeInvoiceProfile(data.invoice_profile),
    productionChecklistItems: normalizeProductionChecklistItems(
      data.production_checklist_items
    ),
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
      "site_visit_scheduling_enabled, installation_scheduling_enabled, enable_final_product, invoice_profile, production_checklist_items"
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
      enable_final_product: DEFAULT_SETTINGS.enableFinalProduct,
      invoice_profile: EMPTY_INVOICE_PROFILE,
      production_checklist_items: DEFAULT_PRODUCTION_CHECKLIST_ITEMS,
    })
    .select(
      "site_visit_scheduling_enabled, installation_scheduling_enabled, enable_final_product, invoice_profile, production_checklist_items"
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
  const newEnableFinalProduct =
    settings.enableFinalProduct ?? current.enableFinalProduct;
  const newInvoiceProfile = normalizeInvoiceProfile(
    settings.invoiceProfile !== undefined
      ? { ...current.invoiceProfile, ...settings.invoiceProfile, bank: {
          ...current.invoiceProfile.bank,
          ...settings.invoiceProfile?.bank,
        } }
      : current.invoiceProfile
  );
  const newProductionChecklistItems = normalizeProductionChecklistItems(
    settings.productionChecklistItems !== undefined
      ? settings.productionChecklistItems
      : current.productionChecklistItems
  );

  const { error: upsertError } = await supabase.from("app_settings").upsert(
    {
      company_id: userProfile.company_id,
      site_visit_scheduling_enabled: newSiteVisit,
      installation_scheduling_enabled: newInstallation,
      enable_final_product: newEnableFinalProduct,
      invoice_profile: newInvoiceProfile,
      production_checklist_items: newProductionChecklistItems,
    },
    { onConflict: "company_id" }
  );

  if (upsertError) {
    console.error("Failed to upsert app settings:", upsertError);
    throw new Error("Failed to update settings");
  }

  revalidatePath("/admin/settings");
  revalidatePath("/printoms/portal");
  revalidatePath("/admin/orders");
  revalidatePath("/production/orders");
  revalidatePath("/staff/orders");
}

export async function updateInvoiceProfile(
  profile: InvoiceProfile
): Promise<void> {
  await updateAppSettings({ invoiceProfile: normalizeInvoiceProfile(profile) });
}

export async function getCompanyDetails(): Promise<CompanyDetails | null> {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData?.user) return null;

  const { data: userProfile } = await supabase
    .from("users")
    .select("company_id")
    .eq("id", userData.user.id)
    .single();

  if (!userProfile?.company_id) return null;

  const { data: company, error } = await supabase
    .from("companies")
    .select("id, name, address")
    .eq("id", userProfile.company_id)
    .single();

  if (error) {
    console.error("Failed to fetch company details:", error.message || error);
    return null;
  }

  return company;
}

export async function updateCompanyDetails(name: string, address: string | null): Promise<void> {
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

  const adminClient = createAdminClient();
  if (!adminClient) throw new Error("Admin client not configured");

  const { error } = await adminClient
    .from("companies")
    .update({ name, address })
    .eq("id", userProfile.company_id);

  if (error) {
    console.error("Failed to update company details:", error);
    throw new Error("Failed to update company details");
  }

  revalidatePath("/admin/settings");
}
