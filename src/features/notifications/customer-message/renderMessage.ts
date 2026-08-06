import {
  CUSTOMER_MESSAGE_TEMPLATES,
  CustomerMessageKey,
  CustomerMessageParam,
} from "./templates";

export type CustomerMessageVars = {
  businessName: string;
  clientName: string;
  enquiryNo?: string;
  orderNo?: string;
  date?: string;
  time?: string;
  ticketNo?: string;
  /** Full portal URL. When absent the portal line is dropped from the text. */
  portalUrl?: string;
  /** Google review URL for feedback_request (takes priority over portal). */
  reviewUrl?: string;
};

function paramValue(param: CustomerMessageParam, vars: CustomerMessageVars): string {
  switch (param) {
    case "BusinessName":
      return vars.businessName || "Customer";
    case "ClientName":
      return vars.clientName || "our team";
    case "EnquiryNo":
      return vars.enquiryNo || "—";
    case "OrderNo":
      return vars.orderNo || "—";
    case "Date":
      return vars.date || "—";
    case "Time":
      return vars.time || "—";
    case "TicketNo":
      return vars.ticketNo || "—";
  }
}

/** WhatsApp emphasis — bold for all filled params (names, IDs, date, time). */
function formatParam(_param: CustomerMessageParam, value: string): string {
  // Strip markers that would break WhatsApp formatting.
  const clean = value.replace(/[*_~`]/g, "").trim() || value;
  return `*${clean}*`;
}

/** Ensure URL is bare so WhatsApp/email clients can auto-link it. */
function normalizeLinkUrl(url: string): string {
  return url.trim().replace(/[)\].,;:]+$/g, "");
}

function appendLink(text: string, url: string): string {
  const withCta = text.replace(
    /using the (?:button|link) below[:.]?/g,
    "using the link below:"
  );
  return `${withCta.trimEnd()}\n\n${normalizeLinkUrl(url)}`;
}

function dropCtaLine(text: string): string {
  return text
    .split("\n")
    .filter(
      (line) =>
        !line.includes("using the button below") &&
        !line.includes("using the link below")
    )
    .join("\n")
    .trimEnd();
}

/** Fill a utility template into ready-to-send free text (wa.me / mailto / copy). */
export function renderCustomerMessage(
  key: CustomerMessageKey,
  vars: CustomerMessageVars
): string {
  const template = CUSTOMER_MESSAGE_TEMPLATES[key];
  let text = template.body;

  template.params.forEach((param, i) => {
    text = text
      .split(`{{${i + 1}}}`)
      .join(formatParam(param, paramValue(param, vars)));
  });

  if (key === "feedback_request") {
    if (vars.reviewUrl) return appendLink(text, vars.reviewUrl);
    return dropCtaLine(text);
  }

  if (vars.portalUrl) {
    return appendLink(text, vars.portalUrl);
  }

  return dropCtaLine(text);
}
