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

/**
 * Meta template URL button (all templates):
 *   Label: Click Here
 *   URL:   {YOUR_DOMAIN}/portal?token={{1}}
 */
export const WHATSAPP_TEMPLATES: Record<WhatsAppTemplateKey, WhatsAppTemplateDef> = {
  enquiry_received: { metaName: "printec_enquiry_received", language: "en", bodyParamCount: 3, hasUrlButton: true },
  order_created: { metaName: "printec_order_created", language: "en", bodyParamCount: 3, hasUrlButton: true },
  site_visit_scheduled: { metaName: "printec_site_visit_scheduled", language: "en", bodyParamCount: 3, hasUrlButton: true },
  site_visit_completed: { metaName: "printec_site_visit_completed", language: "en", bodyParamCount: 1, hasUrlButton: true },
  quotation_ready: { metaName: "printec_quotation_ready", language: "en", bodyParamCount: 1, hasUrlButton: true },
  revised_quotation_ready: { metaName: "printec_revised_quotation", language: "en", bodyParamCount: 1, hasUrlButton: true },
  design_resources_required: { metaName: "printec_design_resources", language: "en", bodyParamCount: 1, hasUrlButton: true },
  design_ready_for_review: { metaName: "printec_design_ready", language: "en", bodyParamCount: 1, hasUrlButton: true },
  design_revision_uploaded: { metaName: "printec_design_revision", language: "en", bodyParamCount: 1, hasUrlButton: true },
  design_approved: { metaName: "printec_design_approved", language: "en", bodyParamCount: 1, hasUrlButton: true },
  production_started: { metaName: "printec_production_started", language: "en", bodyParamCount: 1, hasUrlButton: true },
  ready_for_installation: { metaName: "printec_ready_install", language: "en", bodyParamCount: 1, hasUrlButton: true },
  installation_scheduled: { metaName: "printec_install_scheduled", language: "en", bodyParamCount: 3, hasUrlButton: true },
  installation_completed: { metaName: "printec_install_completed", language: "en", bodyParamCount: 2, hasUrlButton: true },
  service_ticket_created: { metaName: "printec_ticket_created", language: "en", bodyParamCount: 2, hasUrlButton: true },
  service_ticket_resolved: { metaName: "printec_ticket_resolved", language: "en", bodyParamCount: 1, hasUrlButton: true },
  feedback_request: { metaName: "printec_feedback_request", language: "en", bodyParamCount: 2, hasUrlButton: true },
};

export const HELLO_WORLD_TEMPLATE = {
  metaName: "hello_world",
  language: "en_US",
  bodyParamCount: 0,
  hasUrlButton: false,
} as const;
