import { getServiceClient, PRINTOMS_COMPANY_ID } from "./db";

export type WorkflowAutoApprovalStageKey =
  | "site_visit"
  | "quotation"
  | "design"
  | "production"
  | "installation";

export type WorkflowAutoApprovalMap = Record<
  WorkflowAutoApprovalStageKey,
  boolean
>;

/**
 * Service-role read of the per-stage auto-approval map for the printoms
 * test company. Used by e2e specs to flip a toggle before a test and
 * restore it afterwards.
 */
export async function getWorkflowAutoApproval(): Promise<WorkflowAutoApprovalMap> {
  const db = getServiceClient();
  const { data, error } = await db
    .from("app_settings")
    .select("workflow_auto_approval")
    .eq("company_id", PRINTOMS_COMPANY_ID)
    .maybeSingle();
  if (error || !data) {
    return {
      site_visit: false,
      quotation: false,
      design: false,
      production: false,
      installation: false,
    };
  }
  const raw = (data.workflow_auto_approval ?? {}) as Record<string, unknown>;
  return {
    site_visit: typeof raw.site_visit === "boolean" ? raw.site_visit : false,
    quotation: typeof raw.quotation === "boolean" ? raw.quotation : false,
    design: typeof raw.design === "boolean" ? raw.design : false,
    production: typeof raw.production === "boolean" ? raw.production : false,
    installation: typeof raw.installation === "boolean" ? raw.installation : false,
  };
}

/**
 * Patch one stage's auto-approval toggle for the printoms test company.
 * Returns the previous value so callers can restore it in `finally`.
 */
export async function setWorkflowAutoApprovalStage(
  stage: WorkflowAutoApprovalStageKey,
  enabled: boolean
): Promise<boolean> {
  const db = getServiceClient();
  const previous = await getWorkflowAutoApproval();
  const next: WorkflowAutoApprovalMap = { ...previous, [stage]: enabled };

  const { error } = await db
    .from("app_settings")
    .upsert(
      {
        company_id: PRINTOMS_COMPANY_ID,
        workflow_auto_approval: next,
      },
      { onConflict: "company_id" }
    );
  if (error) throw new Error(`setWorkflowAutoApprovalStage: ${error.message}`);
  return previous[stage];
}
