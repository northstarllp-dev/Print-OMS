import type { InvoiceProfile } from "@/features/quotations/types/invoiceProfile";
import type {
  ProductionChecklistItem,
  ProductionChecklistsByOp,
} from "@/features/settings/productionChecklist";
import type { InvoiceNumberingConfig } from "@/features/invoices/types/invoiceNumbering";

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

export const WORKFLOW_AUTO_APPROVAL_STAGE_KEYS: readonly WorkflowAutoApprovalStageKey[] =
  ["site_visit", "quotation", "design", "production", "installation"];

export const DEFAULT_WORKFLOW_AUTO_APPROVAL: WorkflowAutoApprovalMap = {
  site_visit: false,
  quotation: false,
  design: false,
  production: false,
  installation: false,
};

export const WORKFLOW_AUTO_APPROVAL_STAGE_LABELS: Record<
  WorkflowAutoApprovalStageKey,
  string
> = {
  site_visit: "Site Visit",
  quotation: "Quotation",
  design: "Design",
  production: "Production",
  installation: "Installation",
};

export const WORKFLOW_AUTO_APPROVAL_STAGE_DESCRIPTIONS: Record<
  WorkflowAutoApprovalStageKey,
  string
> = {
  site_visit:
    "When staff request approval after completing the site visit, advance automatically to the next stage (default Quote First) without admin sign-off.",
  quotation:
    "When staff request approval after the quotation is approved, advance automatically to Design or Production without admin sign-off.",
  design:
    "When staff request approval after design approval, advance automatically to Production without admin sign-off.",
  production:
    "When staff request approval after the production checklist is complete, advance automatically to Ready For Installation without admin sign-off.",
  installation:
    "When staff request job-done approval after installation, complete the order automatically if no payment balance is outstanding.",
};

export interface AppSettings {
  siteVisitSchedulingEnabled: boolean;
  installationSchedulingEnabled: boolean;
  /** Google Business / review URL used in post-install feedback messages. */
  googleReviewLink: string;
  invoiceProfile: InvoiceProfile;
  invoiceNumbering: InvoiceNumberingConfig;
  /**
   * Workshop production checklist per business operation.
   * Legacy single-list settings are normalized into this map on read.
   */
  productionChecklistsByOp: ProductionChecklistsByOp;
  /**
   * @deprecated Prefer productionChecklistsByOp. Kept as signage/default list for older callers.
   */
  productionChecklistItems: ProductionChecklistItem[];
  /**
   * Per-stage auto-approval toggles. When ON for a stage, staff
   * `requestStageAdvancementAction` advances the order directly instead of
   * parking it in `Pending Admin Approval: …` for an admin to click Approve.
   */
  workflowAutoApproval: WorkflowAutoApprovalMap;
}

export interface CompanyDetails {
  id: string;
  name: string;
  address?: string | null;
}
