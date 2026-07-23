import { loadClientConfig } from "@/config/loadClientConfig";

export type WhatsAppTemplateKey =
  | "enquiry_received"
  | "order_created"
  | "site_visit_scheduled"
  | "site_visit_completed"
  | "quotation_ready"
  | "revised_quotation_ready"
  | "design_resources_required"
  | "design_ready_for_review"
  | "design_revision_uploaded"
  | "design_approved"
  | "production_started"
  | "ready_for_installation"
  | "installation_scheduled"
  | "installation_completed"
  | "service_ticket_created"
  | "service_ticket_resolved"
  | "feedback_request";

export type WhatsAppTemplateDef = {
  metaName: string;
  language: string;
  bodyParamCount: number;
  hasUrlButton: boolean;
};

/** Suffix after client prefix — matches historically approved Meta names for printec_*. */
const TEMPLATE_SUFFIXES: Record<WhatsAppTemplateKey, string> = {
  enquiry_received: "enquiry_received",
  order_created: "order_created",
  site_visit_scheduled: "site_visit_scheduled",
  site_visit_completed: "site_visit_completed",
  quotation_ready: "quotation_ready",
  revised_quotation_ready: "revised_quotation",
  design_resources_required: "design_resources",
  design_ready_for_review: "design_ready",
  design_revision_uploaded: "design_revision",
  design_approved: "design_approved",
  production_started: "production_started",
  ready_for_installation: "ready_install",
  installation_scheduled: "install_scheduled",
  installation_completed: "install_completed",
  service_ticket_created: "ticket_created",
  service_ticket_resolved: "ticket_resolved",
  feedback_request: "feedback_request",
};

const TEMPLATE_META: Record<
  WhatsAppTemplateKey,
  Omit<WhatsAppTemplateDef, "metaName">
> = {
  enquiry_received: { language: "en", bodyParamCount: 3, hasUrlButton: true },
  order_created: { language: "en", bodyParamCount: 3, hasUrlButton: true },
  site_visit_scheduled: { language: "en", bodyParamCount: 3, hasUrlButton: true },
  site_visit_completed: { language: "en", bodyParamCount: 1, hasUrlButton: true },
  quotation_ready: { language: "en", bodyParamCount: 1, hasUrlButton: true },
  revised_quotation_ready: { language: "en", bodyParamCount: 1, hasUrlButton: true },
  design_resources_required: { language: "en", bodyParamCount: 1, hasUrlButton: true },
  design_ready_for_review: { language: "en", bodyParamCount: 1, hasUrlButton: true },
  design_revision_uploaded: { language: "en", bodyParamCount: 1, hasUrlButton: true },
  design_approved: { language: "en", bodyParamCount: 1, hasUrlButton: true },
  production_started: { language: "en", bodyParamCount: 1, hasUrlButton: true },
  ready_for_installation: { language: "en", bodyParamCount: 1, hasUrlButton: true },
  installation_scheduled: { language: "en", bodyParamCount: 3, hasUrlButton: true },
  installation_completed: { language: "en", bodyParamCount: 2, hasUrlButton: true },
  service_ticket_created: { language: "en", bodyParamCount: 2, hasUrlButton: true },
  service_ticket_resolved: { language: "en", bodyParamCount: 1, hasUrlButton: true },
  feedback_request: { language: "en", bodyParamCount: 2, hasUrlButton: true },
};

/** Resolve Meta template definitions for the active CLIENT_SLUG. */
export function getWhatsAppTemplates(): Record<
  WhatsAppTemplateKey,
  WhatsAppTemplateDef
> {
  const config = loadClientConfig();
  const prefix = config.whatsappTemplatePrefix || "printec_";
  const overrides = config.whatsappTemplateOverrides || {};

  const out = {} as Record<WhatsAppTemplateKey, WhatsAppTemplateDef>;
  for (const key of Object.keys(TEMPLATE_SUFFIXES) as WhatsAppTemplateKey[]) {
    out[key] = {
      ...TEMPLATE_META[key],
      metaName: overrides[key] || `${prefix}${TEMPLATE_SUFFIXES[key]}`,
    };
  }
  return out;
}

export const HELLO_WORLD_TEMPLATE = {
  metaName: "hello_world",
  language: "en_US",
  bodyParamCount: 0,
  hasUrlButton: false,
} as const;
