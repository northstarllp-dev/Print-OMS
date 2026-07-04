/** High-level phases that can show the payment-required popup. */

export type PaymentGatePhaseKey =
  | "site_visit"
  | "quotation"
  | "design"
  | "production"
  | "installation_scheduled"
  | "installation_completed";

export type PaymentGateStage = {
  id: string;
  /** Phase key stored in payment_gate_stages.stage */
  stage: PaymentGatePhaseKey;
  label: string;
  /** Final pipeline stage(s) that trigger the popup when advancing from them */
  linkedStages: string[];
  is_enabled: boolean;
  company_id?: string;
  created_at: string;
  updated_at: string;
};

/**
 * Admin checkboxes map to these phases.
 * Popup shows only when advancing from the linked final stage(s).
 */
export const PAYMENT_GATE_PHASES: {
  key: PaymentGatePhaseKey;
  label: string;
  linkedStages: string[];
}[] = [
  {
    key: "site_visit",
    label: "Site Visit",
    linkedStages: ["Site Visit Completed"],
  },
  {
    key: "quotation",
    label: "Quotation",
    linkedStages: ["Quotation Approved"],
  },
  {
    key: "design",
    label: "Design",
    linkedStages: ["Design Approved"],
  },
  {
    key: "production",
    label: "Production",
    linkedStages: ["Ready For Installation"],
  },
  {
    key: "installation_scheduled",
    label: "Installation Scheduled",
    linkedStages: ["Installation Scheduled"],
  },
  {
    key: "installation_completed",
    label: "Completed",
    linkedStages: ["Completed"],
  },
];

/**
 * Resolve which payment-gate phase applies when advancing from a pipeline stage.
 * Site visit completion is often approved while `stage` is still Scheduled/Pending
 * and `stage_status` is "Pending Admin Approval: Site Visit Completed".
 */
export function getPaymentGatePhaseForStage(
  pipelineStage: string,
  stageStatus?: string | null
): (typeof PAYMENT_GATE_PHASES)[number] | null {
  const direct = PAYMENT_GATE_PHASES.find((p) =>
    p.linkedStages.includes(pipelineStage)
  );
  if (direct) return direct;

  // Site visit audit submitted for admin approval (stage may not be "Site Visit Completed" yet)
  if (
    pipelineStage.startsWith("Site Visit") &&
    (stageStatus?.includes("Site Visit Completed") ||
      stageStatus === "Pending Admin Approval: Site Visit Completed")
  ) {
    return PAYMENT_GATE_PHASES.find((p) => p.key === "site_visit") ?? null;
  }

  return null;
}
