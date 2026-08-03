/** Per-company configurable invoice number format (stored on app_settings.invoice_numbering). */

export type InvoiceNumberReset = "never" | "yearly" | "monthly";
export type InvoiceYearPart = "none" | "calendar" | "financial";

export interface InvoiceNumberingConfig {
  /** e.g. INV or PRT/INV — never a UUID */
  prefix: string;
  /** Separator between parts, e.g. "-" or "/" */
  separator: string;
  /** How/whether to include a year segment */
  yearPart: InvoiceYearPart;
  /** Month (1–12) when financial year starts. India default: 4 (April). */
  financialYearStartMonth: number;
  /** First sequence number for a new period */
  startingNumber: number;
  /** Zero-pad width for the sequence, e.g. 4 → 0001 */
  padding: number;
  reset: InvoiceNumberReset;
}

export const EMPTY_INVOICE_NUMBERING: InvoiceNumberingConfig = {
  prefix: "INV",
  separator: "-",
  yearPart: "calendar",
  financialYearStartMonth: 4,
  startingNumber: 1,
  padding: 6,
  reset: "yearly",
};

function asPositiveInt(value: unknown, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.floor(n);
}

export function normalizeInvoiceNumbering(raw: unknown): InvoiceNumberingConfig {
  const src =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};

  const yearPart =
    src.yearPart === "none" ||
    src.yearPart === "calendar" ||
    src.yearPart === "financial"
      ? src.yearPart
      : EMPTY_INVOICE_NUMBERING.yearPart;

  const reset =
    src.reset === "never" || src.reset === "yearly" || src.reset === "monthly"
      ? src.reset
      : EMPTY_INVOICE_NUMBERING.reset;

  const separator =
    typeof src.separator === "string" && src.separator.length > 0
      ? src.separator.slice(0, 3)
      : EMPTY_INVOICE_NUMBERING.separator;

  const prefixRaw =
    typeof src.prefix === "string" ? src.prefix.trim() : EMPTY_INVOICE_NUMBERING.prefix;
  const prefix = prefixRaw || EMPTY_INVOICE_NUMBERING.prefix;

  const fyMonth = asPositiveInt(
    src.financialYearStartMonth,
    EMPTY_INVOICE_NUMBERING.financialYearStartMonth
  );

  return {
    prefix,
    separator,
    yearPart,
    financialYearStartMonth: Math.min(12, fyMonth),
    startingNumber: asPositiveInt(
      src.startingNumber,
      EMPTY_INVOICE_NUMBERING.startingNumber
    ),
    padding: Math.min(
      12,
      asPositiveInt(src.padding, EMPTY_INVOICE_NUMBERING.padding)
    ),
    reset,
  };
}

/** Indian FY label for a date, e.g. Jul 2026 with start month 4 → "26-27". */
export function financialYearLabel(
  date: Date,
  startMonth: number = 4
): string {
  const month = date.getMonth() + 1;
  const year = date.getFullYear();
  const fyStartYear = month >= startMonth ? year : year - 1;
  const yy = String(fyStartYear).slice(-2);
  const yyNext = String(fyStartYear + 1).slice(-2);
  return `${yy}-${yyNext}`;
}

export function resolvePeriodKey(
  config: InvoiceNumberingConfig,
  date: Date = new Date()
): string {
  if (config.reset === "never") return "all";
  if (config.reset === "monthly") {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    return `${y}-${m}`;
  }
  // yearly
  if (config.yearPart === "financial") {
    return financialYearLabel(date, config.financialYearStartMonth);
  }
  return String(date.getFullYear());
}

export function resolveYearSegment(
  config: InvoiceNumberingConfig,
  date: Date = new Date()
): string | null {
  if (config.yearPart === "none") return null;
  if (config.yearPart === "financial") {
    return financialYearLabel(date, config.financialYearStartMonth);
  }
  return String(date.getFullYear());
}

export function formatInvoiceNumber(
  config: InvoiceNumberingConfig,
  sequence: number,
  date: Date = new Date()
): string {
  const parts: string[] = [config.prefix];
  const yearSeg = resolveYearSegment(config, date);
  if (yearSeg) parts.push(yearSeg);
  parts.push(String(Math.max(1, sequence)).padStart(config.padding, "0"));
  return parts.join(config.separator);
}

/** Live preview for settings UI (does not allocate). */
export function previewInvoiceNumber(
  config: InvoiceNumberingConfig,
  date: Date = new Date()
): string {
  return formatInvoiceNumber(config, config.startingNumber, date);
}

/**
 * Legacy short IDs from the first trigger (`INV-001`) before configurable numbering.
 * Drafts with these should be reallocated once.
 */
export function isLegacyInvoiceNumber(invoiceId?: string | null): boolean {
  if (!invoiceId) return true;
  return /^INV-\d{1,4}$/i.test(invoiceId.trim());
}
