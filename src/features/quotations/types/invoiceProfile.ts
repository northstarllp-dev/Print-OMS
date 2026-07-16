export type InvoiceTaxSplit = "cgst_sgst" | "igst";

export interface InvoiceBankDetails {
  accountName?: string;
  accountType?: string;
  accountNumber?: string;
  bankName?: string;
  branch?: string;
  ifsc?: string;
}

/** Per-company letterhead / bank / GST for quotation documents. */
export interface InvoiceProfile {
  legalName?: string;
  brandName?: string;
  address?: string;
  gstin?: string;
  email?: string;
  website?: string;
  logoUrl?: string | null;
  placeOfSupplyDefault?: string;
  taxSplit?: InvoiceTaxSplit;
  bank?: InvoiceBankDetails;
  defaultTerms?: string;
}

export const EMPTY_INVOICE_PROFILE: InvoiceProfile = {
  legalName: "",
  brandName: "",
  address: "",
  gstin: "",
  email: "",
  website: "",
  logoUrl: null,
  placeOfSupplyDefault: "",
  taxSplit: "cgst_sgst",
  bank: {
    accountName: "",
    accountType: "Current",
    accountNumber: "",
    bankName: "",
    branch: "",
    ifsc: "",
  },
  defaultTerms: "",
};

export function normalizeInvoiceProfile(raw: unknown): InvoiceProfile {
  const src =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  const bankSrc =
    src.bank && typeof src.bank === "object" && !Array.isArray(src.bank)
      ? (src.bank as Record<string, unknown>)
      : {};

  const taxSplit =
    src.taxSplit === "igst" || src.taxSplit === "cgst_sgst"
      ? src.taxSplit
      : "cgst_sgst";

  return {
    legalName: typeof src.legalName === "string" ? src.legalName : "",
    brandName: typeof src.brandName === "string" ? src.brandName : "",
    address: typeof src.address === "string" ? src.address : "",
    gstin: typeof src.gstin === "string" ? src.gstin : "",
    email: typeof src.email === "string" ? src.email : "",
    website: typeof src.website === "string" ? src.website : "",
    logoUrl:
      typeof src.logoUrl === "string"
        ? src.logoUrl
        : src.logoUrl === null
          ? null
          : null,
    placeOfSupplyDefault:
      typeof src.placeOfSupplyDefault === "string"
        ? src.placeOfSupplyDefault
        : "",
    taxSplit,
    bank: {
      accountName:
        typeof bankSrc.accountName === "string" ? bankSrc.accountName : "",
      accountType:
        typeof bankSrc.accountType === "string"
          ? bankSrc.accountType
          : "Current",
      accountNumber:
        typeof bankSrc.accountNumber === "string" ? bankSrc.accountNumber : "",
      bankName: typeof bankSrc.bankName === "string" ? bankSrc.bankName : "",
      branch: typeof bankSrc.branch === "string" ? bankSrc.branch : "",
      ifsc: typeof bankSrc.ifsc === "string" ? bankSrc.ifsc : "",
    },
    defaultTerms:
      typeof src.defaultTerms === "string" ? src.defaultTerms : "",
  };
}

export function hasBankDetails(bank?: InvoiceBankDetails | null): boolean {
  if (!bank) return false;
  return Boolean(
    bank.accountName ||
      bank.accountNumber ||
      bank.bankName ||
      bank.ifsc
  );
}
