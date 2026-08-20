"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import {
  EMPTY_INVOICE_PROFILE,
  normalizeInvoiceProfile,
  type InvoiceProfile,
} from "@/features/quotations/types/invoiceProfile";
import {
  EMPTY_INVOICE_NUMBERING,
  normalizeInvoiceNumbering,
  type InvoiceNumberingConfig,
} from "@/features/invoices/types/invoiceNumbering";
import { createAdminClient } from "@/utils/supabase/admin";
import {
  DEFAULT_PRODUCTION_CHECKLISTS_BY_OP,
  getChecklistForBusinessOp,
  normalizeProductionChecklistsByOp,
  type ProductionChecklistsByOp,
} from "@/features/settings/productionChecklist";
import type { AppSettings, CompanyDetails } from "@/features/settings/settingsTypes";
import {
  DEFAULT_WORKFLOW_AUTO_APPROVAL,
  type WorkflowAutoApprovalMap,
  type WorkflowAutoApprovalStageKey,
} from "@/features/settings/settingsTypes";

const DEFAULT_SETTINGS: AppSettings = {
  siteVisitSchedulingEnabled: true,
  installationSchedulingEnabled: true,
  googleReviewLink: "",
  invoiceProfile: EMPTY_INVOICE_PROFILE,
  invoiceNumbering: EMPTY_INVOICE_NUMBERING,
  productionChecklistsByOp: DEFAULT_PRODUCTION_CHECKLISTS_BY_OP,
  productionChecklistItems: getChecklistForBusinessOp(
    DEFAULT_PRODUCTION_CHECKLISTS_BY_OP,
    "signage"
  ),
  workflowAutoApproval: { ...DEFAULT_WORKFLOW_AUTO_APPROVAL },
};

/** Normalize arbitrary DB JSON into a complete WorkflowAutoApprovalMap. */
function normalizeWorkflowAutoApproval(raw: unknown): WorkflowAutoApprovalMap {
  const out: WorkflowAutoApprovalMap = { ...DEFAULT_WORKFLOW_AUTO_APPROVAL };
  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    for (const key of Object.keys(out) as WorkflowAutoApprovalStageKey[]) {
      const v = obj[key];
      if (typeof v === "boolean") out[key] = v;
    }
  }
  return out;
}

function mapRow(data: {
  site_visit_scheduling_enabled?: boolean;
  installation_scheduling_enabled?: boolean;
  google_review_link?: string | null;
  invoice_profile?: unknown;
  invoice_numbering?: unknown;
  production_checklist_items?: unknown;
  workflow_auto_approval?: unknown;
}): AppSettings {
  const productionChecklistsByOp = normalizeProductionChecklistsByOp(
    data.production_checklist_items
  );
  return {
    siteVisitSchedulingEnabled: data.site_visit_scheduling_enabled ?? true,
    installationSchedulingEnabled: data.installation_scheduling_enabled ?? true,
    googleReviewLink: (data.google_review_link ?? "").trim(),
    invoiceProfile: normalizeInvoiceProfile(data.invoice_profile),
    invoiceNumbering: normalizeInvoiceNumbering(data.invoice_numbering),
    productionChecklistsByOp,
    productionChecklistItems: getChecklistForBusinessOp(
      productionChecklistsByOp,
      "signage"
    ),
    workflowAutoApproval: normalizeWorkflowAutoApproval(
      data.workflow_auto_approval
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
      "site_visit_scheduling_enabled, installation_scheduling_enabled, google_review_link, invoice_profile, invoice_numbering, production_checklist_items, workflow_auto_approval"
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
      google_review_link: DEFAULT_SETTINGS.googleReviewLink,
      invoice_profile: EMPTY_INVOICE_PROFILE,
      invoice_numbering: EMPTY_INVOICE_NUMBERING,
      production_checklist_items: DEFAULT_PRODUCTION_CHECKLISTS_BY_OP,
      workflow_auto_approval: DEFAULT_SETTINGS.workflowAutoApproval,
    })
    .select(
      "site_visit_scheduling_enabled, installation_scheduling_enabled, google_review_link, invoice_profile, invoice_numbering, production_checklist_items, workflow_auto_approval"
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
  const newGoogleReviewLink =
    settings.googleReviewLink !== undefined
      ? settings.googleReviewLink.trim()
      : current.googleReviewLink;
  const newInvoiceProfile = normalizeInvoiceProfile(
    settings.invoiceProfile !== undefined
      ? { ...current.invoiceProfile, ...settings.invoiceProfile, bank: {
          ...current.invoiceProfile.bank,
          ...settings.invoiceProfile?.bank,
        } }
      : current.invoiceProfile
  );
  const newInvoiceNumbering = normalizeInvoiceNumbering(
    settings.invoiceNumbering !== undefined
      ? { ...current.invoiceNumbering, ...settings.invoiceNumbering }
      : current.invoiceNumbering
  );
  const newProductionChecklistsByOp: ProductionChecklistsByOp =
    settings.productionChecklistsByOp !== undefined
      ? normalizeProductionChecklistsByOp(settings.productionChecklistsByOp)
      : settings.productionChecklistItems !== undefined
        ? normalizeProductionChecklistsByOp({
            ...current.productionChecklistsByOp,
            signage: settings.productionChecklistItems,
          })
        : current.productionChecklistsByOp;
  const newWorkflowAutoApproval: WorkflowAutoApprovalMap =
    settings.workflowAutoApproval !== undefined
      ? {
          ...DEFAULT_WORKFLOW_AUTO_APPROVAL,
          ...current.workflowAutoApproval,
          ...settings.workflowAutoApproval,
        }
      : current.workflowAutoApproval;

  const { error: upsertError } = await supabase.from("app_settings").upsert(
    {
      company_id: userProfile.company_id,
      site_visit_scheduling_enabled: newSiteVisit,
      installation_scheduling_enabled: newInstallation,
      google_review_link: newGoogleReviewLink,
      invoice_profile: newInvoiceProfile,
      invoice_numbering: newInvoiceNumbering,
      production_checklist_items: newProductionChecklistsByOp,
      workflow_auto_approval: newWorkflowAutoApproval,
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

export async function updateInvoiceNumbering(
  numbering: InvoiceNumberingConfig
): Promise<void> {
  await updateAppSettings({
    invoiceNumbering: normalizeInvoiceNumbering(numbering),
  });
}

/**
 * Service-role read of the workflow-auto-approval map for a company.
 * Used by `requestStageAdvancementAction` to decide whether to auto-advance.
 * No auth context required — caller must already be authenticated.
 */
export async function getWorkflowAutoApprovalForCompany(
  companyId: string
): Promise<WorkflowAutoApprovalMap> {
  const adminClient = createAdminClient();
  if (!adminClient) return { ...DEFAULT_WORKFLOW_AUTO_APPROVAL };
  const { data, error } = await adminClient
    .from("app_settings")
    .select("workflow_auto_approval")
    .eq("company_id", companyId)
    .maybeSingle();
  if (error || !data) return { ...DEFAULT_WORKFLOW_AUTO_APPROVAL };
  return normalizeWorkflowAutoApproval(data.workflow_auto_approval);
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
