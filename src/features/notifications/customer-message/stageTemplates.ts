import {
  CUSTOMER_MESSAGE_TEMPLATES,
  CustomerMessageKey,
} from "./templates";

export type StageCatchUpTemplates = {
  primary: CustomerMessageKey;
  suggested: CustomerMessageKey[];
};

/**
 * Catch-up templates for when an admin skipped the auto popup after a stage update.
 * `primary` = most likely forgotten message; `suggested` = other useful ones for the stage.
 */
export function getCatchUpTemplatesForStage(
  stage: string,
  workflowType: "quote_first" | "design_first" = "quote_first"
): StageCatchUpTemplates {
  const isDesignFirst = workflowType === "design_first";

  switch (stage) {
    case "Site Visit Pending":
      return { primary: "order_created", suggested: ["site_visit_scheduled"] };

    case "Site Visit Scheduled":
      return { primary: "site_visit_scheduled", suggested: ["site_visit_completed"] };

    case "Site Visit Completed":
      return {
        primary: "site_visit_completed",
        suggested: [
          isDesignFirst ? "design_resources_required" : "quotation_ready",
        ],
      };

    case "Quotation In Progress":
    case "Quotation Sent":
      return {
        primary: "quotation_ready",
        suggested: [
          "revised_quotation_ready",
          "quotation_follow_up",
          "final_quotation_shared",
        ],
      };

    case "Quotation Negotiation":
    case "Quotation Approved":
      return {
        primary: "quotation_follow_up",
        suggested: ["final_quotation_shared", "revised_quotation_ready"],
      };

    case "Design In Progress":
      return {
        primary: "design_resources_required",
        suggested: ["design_ready_for_review", "design_revision_uploaded"],
      };

    case "Design Approved":
      return { primary: "design_approved", suggested: ["production_started"] };

    case "Production":
      return {
        primary: "production_started",
        suggested: ["ready_for_installation"],
      };

    case "Ready For Installation":
      return {
        primary: "ready_for_installation",
        suggested: ["installation_scheduled"],
      };

    case "Installation Scheduled":
      return {
        primary: "installation_scheduled",
        suggested: ["installation_completed"],
      };

    case "Completed":
    case "Closed":
      return {
        primary: "installation_completed",
        suggested: ["feedback_request"],
      };

    default:
      return { primary: "order_created", suggested: [] };
  }
}

/** Full catalog keys in stable display order (for the “All templates” section). */
export const ALL_CUSTOMER_MESSAGE_KEYS = Object.keys(
  CUSTOMER_MESSAGE_TEMPLATES
) as CustomerMessageKey[];

/** Date/time extras for templates that need schedule fields. */
export function getScheduleExtrasForTemplate(
  key: CustomerMessageKey,
  order: {
    siteVisitDetails?: {
      auditDate?: string;
      auditTime?: string;
      preferredDate?: string;
      preferredTime?: string;
    } | null;
    installationDetails?: {
      scheduledDate?: string;
      scheduledTime?: string;
    } | null;
  }
): { date?: string; time?: string } | undefined {
  if (key === "site_visit_scheduled") {
    const sv = order.siteVisitDetails;
    const date = sv?.auditDate || sv?.preferredDate || undefined;
    const time = sv?.auditTime || sv?.preferredTime || undefined;
    return date || time ? { date, time } : undefined;
  }
  if (key === "installation_scheduled") {
    const inst = order.installationDetails;
    const date = inst?.scheduledDate || undefined;
    const time = inst?.scheduledTime || undefined;
    return date || time ? { date, time } : undefined;
  }
  return undefined;
}
