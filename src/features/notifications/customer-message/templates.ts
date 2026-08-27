/**
 * Utility-style customer message templates (Meta-ready).
 *
 * Bodies use numbered params ({{1}}…{{n}}) so the same copy can later be
 * submitted to Meta as approved utility templates with a portal URL button.
 * For the admin popup (copy / wa.me / mailto) the params are auto-filled and
 * the portal link is appended as plain text on its own line.
 *
 * Blank lines between blocks improve WhatsApp readability.
 */

export type CustomerMessageKey =
  | "enquiry_received"
  | "order_created"
  | "site_visit_scheduled"
  | "site_visit_completed"
  | "quotation_ready"
  | "revised_quotation_ready"
  | "quotation_follow_up"
  | "final_quotation_shared"
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

export type CustomerMessageParam =
  | "BusinessName"
  | "ClientName"
  | "EnquiryNo"
  | "OrderNo"
  | "Date"
  | "Time"
  | "TicketNo";

export type CustomerMessageTemplate = {
  title: string;
  emailSubject: string;
  /** Meta-ready utility body with {{1}}…{{n}} placeholders. */
  body: string;
  /** Ordered labels for {{1}}…{{n}}. */
  params: CustomerMessageParam[];
};

export const CUSTOMER_MESSAGE_TEMPLATES: Record<
  CustomerMessageKey,
  CustomerMessageTemplate
> = {
  enquiry_received: {
    title: "Enquiry Received",
    emailSubject: "Your enquiry has been received",
    params: ["BusinessName", "ClientName", "EnquiryNo"],
    body: `Hello {{1}},

Thank you for contacting {{2}}.

We have received your enquiry. Our team will review the requirements shortly.

Reference: {{3}}

Track updates in your customer portal using the button below.`,
  },
  order_created: {
    title: "Order Created",
    emailSubject: "Your order has been created",
    params: ["BusinessName", "ClientName", "OrderNo"],
    body: `Hello {{1}},

Thank you for choosing {{2}}.

Your enquiry is now an active order. The project has been initiated.

Order: {{3}}

Next step: schedule a site visit for measurements and assessment.

Track your order in the customer portal using the button below.`,
  },
  site_visit_scheduled: {
    title: "Site Visit Scheduled",
    emailSubject: "Your site visit has been scheduled",
    params: ["BusinessName", "Date", "Time"],
    body: `Hello {{1}},

Your site visit is scheduled.

Date: {{2}}
Time: {{3}}

Our team will visit to collect measurements and assess installation conditions.

Track your order in the customer portal using the button below.`,
  },
  site_visit_completed: {
    title: "Site Visit Completed",
    emailSubject: "Your site visit is complete",
    params: ["BusinessName"],
    body: `Hello {{1}},

Your site visit is complete.

Measurements, site photographs, and project details are available in your portal.

Our team will review the information and proceed to the next stage.

Open your customer portal using the button below.`,
  },
  quotation_ready: {
    title: "Quotation Ready",
    emailSubject: "Your quotation is ready for review",
    params: ["BusinessName"],
    body: `Hello {{1}},

Your quotation is ready for review.

View specifications, pricing, materials, and project details in your portal.

Please approve the quotation or share feedback.

Open your customer portal using the button below.`,
  },
  revised_quotation_ready: {
    title: "Revised Quotation Ready",
    emailSubject: "Your revised quotation is ready",
    params: ["BusinessName"],
    body: `Hello {{1}},

A revised quotation is ready based on your feedback.

Please review the updated quotation and confirm if further changes are needed.

Open your customer portal using the button below.`,
  },
  quotation_follow_up: {
    title: "Quotation Follow-Up",
    emailSubject: "Reminder regarding your quotation",
    params: ["BusinessName"],
    body: `Hello {{1}},

This is a reminder regarding your quotation.

If you have questions or need help with materials and options, our team can assist.

Open your customer portal using the button below.`,
  },
  final_quotation_shared: {
    title: "Final Quotation Shared",
    emailSubject: "Your final quotation has been shared",
    params: ["BusinessName"],
    body: `Hello {{1}},

Your final quotation has been shared.

Please review the latest quotation and project details in your portal.

Open your customer portal using the button below.`,
  },
  design_resources_required: {
    title: "Design Resources Required",
    emailSubject: "Design resources required for your project",
    params: ["BusinessName"],
    body: `Hello {{1}},

To begin design, please upload logo files, branding assets, reference images, or artwork.

These materials help us prepare accurate design proposals.

Upload files in your customer portal using the button below.`,
  },
  design_ready_for_review: {
    title: "Design Ready For Review",
    emailSubject: "Your design proposal is ready for review",
    params: ["BusinessName"],
    body: `Hello {{1}},

Your design proposal is ready for review.

Please review the latest version and share feedback or approval in your portal.

Open your customer portal using the button below.`,
  },
  design_revision_uploaded: {
    title: "Design Revision Uploaded",
    emailSubject: "An updated design version is ready",
    params: ["BusinessName"],
    body: `Hello {{1}},

An updated design version has been uploaded based on your feedback.

Please review the revision and confirm if further changes are needed.

Open your customer portal using the button below.`,
  },
  design_approved: {
    title: "Design Approved",
    emailSubject: "Design approved moving to production",
    params: ["BusinessName"],
    body: `Hello {{1}},

Thank you for approving the design.

The design phase is complete. Your project will now move into production.

Track progress in your customer portal using the button below.`,
  },
  production_started: {
    title: "Production Started",
    emailSubject: "Production has started for your project",
    params: ["BusinessName"],
    body: `Hello {{1}},

Production has started for your project.

Our team is preparing your signage to the approved specifications and design.

Track progress in your customer portal using the button below.`,
  },
  ready_for_installation: {
    title: "Ready For Installation",
    emailSubject: "Your signage is ready for installation",
    params: ["BusinessName"],
    body: `Hello {{1}},

Your signage is complete and ready for installation.

We will coordinate the installation schedule and share updates in your portal.

Open your customer portal using the button below.`,
  },
  installation_scheduled: {
    title: "Installation Scheduled",
    emailSubject: "Your installation has been scheduled",
    params: ["BusinessName", "Date", "Time"],
    body: `Hello {{1}},

Your installation is scheduled.

Date: {{2}}
Time: {{3}}

Our installation team will arrive during the scheduled time window.

Track your project in the customer portal using the button below.`,
  },
  installation_completed: {
    title: "Installation Completed",
    emailSubject: "Your signage project is complete",
    params: ["BusinessName", "ClientName"],
    body: `Hello {{1}},

Your signage project is complete.

Installation photographs and completion records are available in your portal.

Thank you for choosing {{2}}.

Open your customer portal using the button below.`,
  },
  service_ticket_created: {
    title: "Service Ticket Created",
    emailSubject: "Your support request has been registered",
    params: ["BusinessName", "TicketNo"],
    body: `Hello {{1}},

Your support request has been registered.

Ticket: {{2}}

Our team will review the issue and share updates.

Track your support request using the link below.`,
  },
  service_ticket_resolved: {
    title: "Service Ticket Resolved",
    emailSubject: "Your support ticket has been resolved",
    params: ["BusinessName"],
    body: `Hello {{1}},

Your support ticket is marked resolved.

If you need further help, contact our team or create a new support request using the link below.`,
  },
  feedback_request: {
    title: "Feedback Request",
    emailSubject: "We would love your feedback",
    params: ["BusinessName", "ClientName"],
    body: `Hello {{1}},

Thank you for choosing {{2}}.

We would appreciate your feedback on the completed project and our service.

Share your Google review using the button below.`,
  },
};
