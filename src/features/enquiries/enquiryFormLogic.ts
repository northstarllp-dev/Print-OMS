/** Pure enquiry form / create-path helpers (unit-tested). */

export type EnquiryPrimaryMode = "email" | "whatsapp";

export type EnquirySource =
  | "Meta Ads"
  | "Referrals"
  | "Walk-ins"
  | "Google Enquiry (Ph Call)"
  | "Website";

export interface EnquiryFormData {
  businessName: string;
  leadName: string;
  phone: string;
  whatsappNumber: string;
  email: string;
  primaryMode: EnquiryPrimaryMode;
  source: EnquirySource;
  notes: string;
  location: string;
}

export interface EnquiryInsertPayload {
  lead_name: string;
  business_name: string;
  phone: string;
  whatsapp: string;
  email: string;
  source: EnquirySource;
  notes: string;
  primary_communication_mode: "WHATSAPP" | "MAIL";
  location: string;
  status: "Pending";
}

export type EnquiryFormErrors = Partial<
  Record<"businessName" | "leadName" | "phone" | "email", string>
>;

/** Format Indian mobile input for the add-enquiry modal. */
export function formatPhoneNumber(value: string): string {
  let digits = value.replace(/\D/g, "");
  // Only strip +91 / leading 0 when a full local number was pasted with the prefix
  // (e.g. 919876543210). Do NOT strip while typing — "91…" is a valid start of a 10-digit mobile.
  if (digits.length > 10 && digits.startsWith("91")) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  digits = digits.slice(0, 10);
  if (digits.length === 10) {
    return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
  }
  return digits;
}

/** True when phone is a formatted/raw 91 + 10-digit Indian number. */
export function validatePhoneNumber(phone: string): boolean {
  const digits = phone.replace(/\D/g, "");
  return digits.length === 12 && digits.startsWith("91");
}

export function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/** Client-side Create Enquiry gate — mirrors AddEnquiryModal submit checks. */
export function validateEnquiryForm(data: EnquiryFormData): EnquiryFormErrors {
  const errors: EnquiryFormErrors = {};
  if (!data.businessName.trim()) errors.businessName = "Business name is required";
  if (!data.leadName.trim()) errors.leadName = "Lead name is required";
  if (!validatePhoneNumber(data.phone)) {
    errors.phone = "Please enter a valid 10-digit phone number";
  }
  if (data.email.trim() && !validateEmail(data.email)) {
    errors.email = "Please enter a valid email address";
  }
  return errors;
}

export function canSubmitEnquiryForm(data: EnquiryFormData): boolean {
  return Object.keys(validateEnquiryForm(data)).length === 0;
}

/** Strip display spaces before persisting phone/WhatsApp. */
export function stripPhoneSpaces(value: string): string {
  return value.replace(/\s+/g, "");
}

/**
 * Map modal form → DB insert row used by EnquiriesViewNew → createEnquiry.
 * Does not set company_id / added_by (server fills those).
 */
export function mapEnquiryFormToInsert(data: EnquiryFormData): EnquiryInsertPayload {
  return {
    lead_name: data.leadName,
    business_name: data.businessName,
    phone: stripPhoneSpaces(data.phone),
    whatsapp: stripPhoneSpaces(data.whatsappNumber),
    email: data.email,
    source: data.source,
    notes: data.notes,
    primary_communication_mode: data.primaryMode === "whatsapp" ? "WHATSAPP" : "MAIL",
    location: data.location,
    status: "Pending",
  };
}

/** Escape a value for PostgREST `.or()` double-quoted filters. */
export function escapePostgrestFilterValue(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

/**
 * Build customer match OR clauses for ensureCustomerForEnquiry.
 * Escapes quotes/backslashes so phone/email cannot break the filter.
 */
export function buildCustomerMatchOrClauses(enq: {
  phone?: unknown;
  whatsapp?: unknown;
  email?: unknown;
}): string[] {
  const clauses: string[] = [];
  if (enq.phone) {
    clauses.push(`phone.eq."${escapePostgrestFilterValue(String(enq.phone))}"`);
  }
  if (enq.whatsapp) {
    clauses.push(`whatsapp.eq."${escapePostgrestFilterValue(String(enq.whatsapp))}"`);
  }
  if (enq.email) {
    clauses.push(`email.eq."${escapePostgrestFilterValue(String(enq.email))}"`);
  }
  return clauses;
}

/** Payload used when createEnquiry auto-creates a customer. */
export function buildCustomerInsertFromEnquiry(
  enq: {
    company_id?: unknown;
    business_name?: unknown;
    lead_name?: unknown;
    phone?: unknown;
    whatsapp?: unknown;
    email?: unknown;
    location?: unknown;
  },
  fallbackCompanyId: string
) {
  return {
    company_id: (enq.company_id as string) || fallbackCompanyId,
    name:
      (enq.business_name as string) ||
      (enq.lead_name as string) ||
      "Customer",
    phone: enq.phone,
    whatsapp: enq.whatsapp,
    email: enq.email,
    billing_address: "Address Details Pending Intake",
    shipping_address:
      (enq.location as string) || "Installation Address Pending Survey",
  };
}

/**
 * Mirror of DB trigger generate_enquiry_id: ENQ + zero-padded sequence.
 * Pads to at least 3 digits (ENQ001); grows naturally past 999.
 */
export function formatEnquireId(sequence: number): string {
  const n = Math.max(1, Math.floor(sequence));
  return `ENQ${String(n).padStart(3, "0")}`;
}

export function nextEnquireSequence(existingIds: string[]): number {
  let max = 0;
  for (const id of existingIds) {
    const m = /^ENQ(\d+)$/i.exec(id.trim());
    if (!m) continue;
    const n = Number(m[1]);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return max + 1;
}

/** Auth gate for createEnquiry: anonymous OK; session requires enquiry edit. */
export function requiresEnquiryEditGrant(hasSession: boolean): boolean {
  return hasSession;
}

export function whatsappNotifyIdempotencyKey(enquiryId: string): string {
  return `enquiry_received:${enquiryId}`;
}

export const EMPTY_ENQUIRY_FORM: EnquiryFormData = {
  businessName: "",
  leadName: "",
  phone: "",
  whatsappNumber: "",
  email: "",
  primaryMode: "whatsapp",
  source: "Website",
  notes: "",
  location: "",
};
