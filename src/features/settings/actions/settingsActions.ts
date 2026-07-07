"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

export interface AppSettings {
  siteVisitSchedulingEnabled: boolean;
  installationSchedulingEnabled: boolean;
}

const DEFAULT_SETTINGS: AppSettings = {
  siteVisitSchedulingEnabled: true,
  installationSchedulingEnabled: true,
};

export async function getAppSettings(): Promise<AppSettings> {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data: userData, error: userError } = await supabase.auth.getUser();

  // If a user is authenticated, use their company ID
  if (!userError && userData?.user) {
    const { data: userProfile } = await supabase
      .from("users")
      .select("company_id")
      .eq("id", userData.user.id)
      .single();

    if (userProfile?.company_id) {
      const { data, error } = await supabase
        .from("app_settings")
        .select("site_visit_scheduling_enabled, installation_scheduling_enabled")
        .eq("company_id", userProfile.company_id)
        .single();

      if (!error && data) {
        return {
          siteVisitSchedulingEnabled: data.site_visit_scheduling_enabled,
          installationSchedulingEnabled: data.installation_scheduling_enabled,
        };
      }
      
      // If no settings exist yet, create them with defaults
      const { data: newSettings, error: insertError } = await supabase
        .from("app_settings")
        .insert({
          company_id: userProfile.company_id,
          site_visit_scheduling_enabled: DEFAULT_SETTINGS.siteVisitSchedulingEnabled,
          installation_scheduling_enabled: DEFAULT_SETTINGS.installationSchedulingEnabled,
        })
        .select()
        .single();
        
      if (!insertError && newSettings) {
        return {
          siteVisitSchedulingEnabled: newSettings.site_visit_scheduling_enabled,
          installationSchedulingEnabled: newSettings.installation_scheduling_enabled,
        };
      }
    }
  }

  return DEFAULT_SETTINGS;
}

export async function getAppSettingsForCompany(companyId: string): Promise<AppSettings> {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  
  const { data, error } = await supabase
    .from("app_settings")
    .select("site_visit_scheduling_enabled, installation_scheduling_enabled")
    .eq("company_id", companyId)
    .single();

  if (!error && data) {
    return {
      siteVisitSchedulingEnabled: data.site_visit_scheduling_enabled,
      installationSchedulingEnabled: data.installation_scheduling_enabled,
    };
  }
  
  return DEFAULT_SETTINGS;
}

export async function updateAppSettings(settings: Partial<AppSettings>): Promise<void> {
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

  // Fetch current to merge
  const current = await getAppSettingsForCompany(userProfile.company_id);

  const newSiteVisit = settings.siteVisitSchedulingEnabled ?? current.siteVisitSchedulingEnabled;
  const newInstallation = settings.installationSchedulingEnabled ?? current.installationSchedulingEnabled;

  const { error: upsertError } = await supabase
    .from("app_settings")
    .upsert({
        company_id: userProfile.company_id,
        site_visit_scheduling_enabled: newSiteVisit,
        installation_scheduling_enabled: newInstallation,
    }, { onConflict: "company_id" });
    
  if (upsertError) {
      console.error("Failed to upsert app settings:", upsertError);
      throw new Error("Failed to update settings");
  }

  revalidatePath("/admin/settings");
  revalidatePath("/portal");
}
