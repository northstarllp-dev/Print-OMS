import { describe, expect, it } from "vitest";
import { isGoogleMapsUrl } from "@/components/maps/mapsUrl";
import {
  assertCanSendInvoice,
  assertUpsertStatusTransition as assertInvoiceUpsertTransition,
  assertValidInvoiceStatus,
  isInvoiceVisibleToCustomer,
  sanitizeSignageOptions as sanitizeInvoiceSignageOptions,
  toCustomerVisibleInvoice,
} from "@/features/invoices/utils/invoiceSecurity";
import { isLegacyInvoiceNumber } from "@/features/invoices/types/invoiceNumbering";
import { normalizeWhatsAppPhone } from "@/features/notifications/whatsapp/phone";
import { isAutoPaymentName } from "@/features/payments/utils/installmentName";
import { isQuotationVisibleToCustomer } from "@/features/quotations/utils/lineAmount";
import { isDisplayableQuotationLine } from "@/features/quotations/utils/quotationDocumentMath";
import {
  assertCanSendQuotationToCustomer,
  assertQuotationEditable,
  assertUpsertStatusTransition,
  assertValidQuotationStatus,
  sanitizeSignageOptions,
  toCustomerVisibleQuotation,
} from "@/features/quotations/utils/quotationSecurity";

describe("quotation validators", () => {
  describe("assertValidQuotationStatus", () => {
    it("defaults undefined to Draft", () => {
      expect(assertValidQuotationStatus(undefined)).toBe("Draft");
    });

    it("accepts allowed statuses", () => {
      for (const status of ["Draft", "Pending Approval", "Sent", "Approved", "Rejected"]) {
        expect(assertValidQuotationStatus(status)).toBe(status);
      }
    });

    it("rejects unknown statuses", () => {
      expect(() => assertValidQuotationStatus("Bogus")).toThrow(/Invalid quotation status/);
    });
  });

  describe("assertQuotationEditable", () => {
    it("allows editable statuses", () => {
      expect(() => assertQuotationEditable("Draft")).not.toThrow();
      expect(() => assertQuotationEditable(undefined)).not.toThrow();
    });

    it("locks Approved quotations", () => {
      expect(() => assertQuotationEditable("Approved")).toThrow(/locked/);
    });

    it("allows Approved when adminOverride is true", () => {
      expect(() => assertQuotationEditable("Approved", true)).not.toThrow();
    });
  });

  describe("assertCanSendQuotationToCustomer", () => {
    it("allows sendable statuses", () => {
      for (const status of ["Draft", "Pending Approval", "Sent", "Rejected"]) {
        expect(() => assertCanSendQuotationToCustomer(status)).not.toThrow();
      }
    });

    it("blocks Approved", () => {
      expect(() => assertCanSendQuotationToCustomer("Approved")).toThrow(/Cannot send quotation/);
    });
  });

  describe("assertUpsertStatusTransition", () => {
    it("blocks setting Approved via save", () => {
      expect(() => assertUpsertStatusTransition("Draft", "Approved")).toThrow(/workflow action/);
    });

    it("blocks transitioning into Rejected via save", () => {
      expect(() => assertUpsertStatusTransition("Sent", "Rejected")).toThrow(/workflow action/);
    });

    it("allows keeping Rejected", () => {
      expect(() => assertUpsertStatusTransition("Rejected", "Rejected")).not.toThrow();
    });

    it("blocks edits when existing is Approved", () => {
      expect(() => assertUpsertStatusTransition("Approved", "Draft")).toThrow(/locked/);
    });

    it("allows editing Approved when adminOverride is true", () => {
      expect(() => assertUpsertStatusTransition("Approved", "Draft", true)).not.toThrow();
      expect(() => assertUpsertStatusTransition("Approved", "Sent", true)).not.toThrow();
    });

    it("still blocks setting Approved via save even with adminOverride", () => {
      expect(() => assertUpsertStatusTransition("Draft", "Approved", true)).toThrow(
        /workflow action/
      );
    });
  });

  describe("sanitizeSignageOptions", () => {
    it("returns empty array for non-arrays", () => {
      expect(sanitizeSignageOptions(null)).toEqual([]);
      expect(sanitizeSignageOptions({})).toEqual([]);
    });

    it("passes through valid sections", () => {
      const input = [{ lines: [{ description: "Board" }] }];
      expect(sanitizeSignageOptions(input)).toEqual(input);
    });

    it("rejects too many sections", () => {
      expect(() => sanitizeSignageOptions(Array(101).fill({ lines: [] }))).toThrow(
        /Too many quotation sections/
      );
    });

    it("rejects invalid section shapes", () => {
      expect(() => sanitizeSignageOptions([null])).toThrow(/Invalid quotation section/);
      expect(() => sanitizeSignageOptions([{ lines: "nope" }])).toThrow(
        /Invalid quotation line items/
      );
    });

    it("rejects sections with too many lines", () => {
      expect(() =>
        sanitizeSignageOptions([{ lines: Array(201).fill({}) }])
      ).toThrow(/Too many line items/);
    });
  });

  describe("customer visibility", () => {
    it("isQuotationVisibleToCustomer only for Sent/Approved/Rejected", () => {
      expect(isQuotationVisibleToCustomer("Sent")).toBe(true);
      expect(isQuotationVisibleToCustomer("Approved")).toBe(true);
      expect(isQuotationVisibleToCustomer("Rejected")).toBe(true);
      expect(isQuotationVisibleToCustomer("Draft")).toBe(false);
      expect(isQuotationVisibleToCustomer(null)).toBe(false);
    });

    it("toCustomerVisibleQuotation strips non-visible rows", () => {
      expect(toCustomerVisibleQuotation({ status: "Draft" })).toBeNull();
      expect(toCustomerVisibleQuotation({ status: "Sent", id: "1" })).toEqual({
        status: "Sent",
        id: "1",
      });
      expect(toCustomerVisibleQuotation(null)).toBeNull();
    });
  });

  describe("isDisplayableQuotationLine", () => {
    it("keeps lines with amount or rate", () => {
      expect(isDisplayableQuotationLine({ quantity: 2, unitPrice: 100 })).toBe(true);
      expect(isDisplayableQuotationLine({ unitPrice: 50, description: "" })).toBe(true);
    });

    it("drops blank placeholder rows", () => {
      expect(isDisplayableQuotationLine({ description: "Item", unitPrice: 0 })).toBe(false);
      expect(isDisplayableQuotationLine({ description: "  ", unitPrice: 0 })).toBe(false);
    });

    it("keeps descriptive zero-amount lines", () => {
      expect(
        isDisplayableQuotationLine({ description: "Installation note", unitPrice: 0 })
      ).toBe(true);
    });
  });
});

describe("invoice validators", () => {
  it("assertValidInvoiceStatus defaults and validates", () => {
    expect(assertValidInvoiceStatus(undefined)).toBe("Draft");
    expect(assertValidInvoiceStatus("Paid")).toBe("Paid");
    expect(() => assertValidInvoiceStatus("Bogus")).toThrow(/Invalid invoice status/);
  });

  it("assertInvoiceUpsertTransition locks Paid/Void and blocks workflow statuses", () => {
    expect(() => assertInvoiceUpsertTransition("Draft", "Paid")).toThrow(/workflow action/);
    expect(() => assertInvoiceUpsertTransition("Paid", "Draft")).toThrow(/locked/);
    expect(() => assertInvoiceUpsertTransition("Draft", "Sent")).not.toThrow();
  });

  it("assertCanSendInvoice only allows Draft/Sent", () => {
    expect(() => assertCanSendInvoice("Draft")).not.toThrow();
    expect(() => assertCanSendInvoice("Paid")).toThrow(/Cannot send invoice/);
  });

  it("customer visibility helpers", () => {
    expect(isInvoiceVisibleToCustomer("Sent")).toBe(true);
    expect(isInvoiceVisibleToCustomer("Draft")).toBe(false);
    expect(toCustomerVisibleInvoice({ status: "Paid" })).toEqual({ status: "Paid" });
    expect(toCustomerVisibleInvoice({ status: "Draft" })).toBeNull();
  });

  it("sanitizeInvoiceSignageOptions mirrors quotation rules", () => {
    expect(sanitizeInvoiceSignageOptions("x")).toEqual([]);
    expect(() => sanitizeInvoiceSignageOptions(Array(101).fill({}))).toThrow(
      /Too many invoice sections/
    );
  });

  it("isLegacyInvoiceNumber detects short INV-NNN ids", () => {
    expect(isLegacyInvoiceNumber(undefined)).toBe(true);
    expect(isLegacyInvoiceNumber("INV-001")).toBe(true);
    expect(isLegacyInvoiceNumber("INV-2026-000001")).toBe(false);
  });
});

describe("normalizeWhatsAppPhone", () => {
  it("returns null for empty/invalid input", () => {
    expect(normalizeWhatsAppPhone(null)).toBeNull();
    expect(normalizeWhatsAppPhone("")).toBeNull();
    expect(normalizeWhatsAppPhone("abc")).toBeNull();
    expect(normalizeWhatsAppPhone("123")).toBeNull();
  });

  it("prefixes Indian 10-digit mobiles with 91", () => {
    expect(normalizeWhatsAppPhone("9876543210")).toBe("919876543210");
    expect(normalizeWhatsAppPhone("+91 98765 43210")).toBe("919876543210");
  });

  it("prefixes US test 555 numbers with 1", () => {
    expect(normalizeWhatsAppPhone("5551234567")).toBe("15551234567");
  });

  it("rejects numbers outside E.164 length bounds", () => {
    expect(normalizeWhatsAppPhone("1234567890123456")).toBeNull();
  });
});

describe("isAutoPaymentName", () => {
  it("matches generated installment labels", () => {
    expect(isAutoPaymentName("1st installment")).toBe(true);
    expect(isAutoPaymentName("2nd installment")).toBe(true);
    expect(isAutoPaymentName("Rest of Amount")).toBe(true);
    expect(isAutoPaymentName("Advance Payment")).toBe(true);
    expect(isAutoPaymentName("Custom deposit")).toBe(false);
  });
});

describe("isGoogleMapsUrl", () => {
  it("detects common Google Maps URL shapes", () => {
    expect(isGoogleMapsUrl("https://maps.app.goo.gl/abc")).toBe(true);
    expect(isGoogleMapsUrl("https://www.google.com/maps/place/Foo")).toBe(true);
    expect(isGoogleMapsUrl("123 Main Street")).toBe(false);
    expect(isGoogleMapsUrl("")).toBe(false);
  });
});
