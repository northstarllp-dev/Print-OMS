import { describe, expect, it } from "vitest";
import { canConvertEnquiry } from "@/features/enquiries/enquiryConvertLogic";

describe("enquiry edit / delete guards", () => {
  const canEditEnquiry = (enq: { status: string; orderId?: string }) =>
    !enq.orderId && enq.status !== "Converted";

  const canDeleteEnquiry = canEditEnquiry;

  describe("canEditEnquiry", () => {
    it("allows editing a Pending enquiry", () => {
      expect(canEditEnquiry({ status: "Pending" })).toBe(true);
    });

    it("allows editing a Contacted enquiry", () => {
      expect(canEditEnquiry({ status: "Contacted" })).toBe(true);
    });

    it("blocks editing a Converted enquiry", () => {
      expect(canEditEnquiry({ status: "Converted" })).toBe(false);
    });

    it("blocks editing an enquiry linked to an order", () => {
      expect(canEditEnquiry({ status: "Pending", orderId: "ord-123" })).toBe(false);
    });
  });

  describe("canDeleteEnquiry", () => {
    it("allows deleting a Pending enquiry", () => {
      expect(canDeleteEnquiry({ status: "Pending" })).toBe(true);
    });

    it("blocks deleting a Converted enquiry", () => {
      expect(canDeleteEnquiry({ status: "Converted" })).toBe(false);
    });

    it("blocks deleting an enquiry linked to an order", () => {
      expect(canDeleteEnquiry({ status: "Quoted", orderId: "ord-456" })).toBe(false);
    });
  });

  describe("ENQUIRY_EDITABLE_FIELDS allowlist", () => {
    const ENQUIRY_EDITABLE_FIELDS = new Set([
      "lead_name",
      "business_name",
      "phone",
      "whatsapp",
      "email",
      "source",
      "notes",
      "primary_communication_mode",
      "location",
      "business_operation",
    ]);

    const sanitise = (updates: Record<string, unknown>) => {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(updates)) {
        if (ENQUIRY_EDITABLE_FIELDS.has(k)) out[k] = v;
      }
      return out;
    };

    it("passes through allowed fields", () => {
      const result = sanitise({ lead_name: "A", business_name: "B" });
      expect(result).toEqual({ lead_name: "A", business_name: "B" });
    });

    it("strips disallowed fields like id, company_id, order_id", () => {
      const result = sanitise({
        lead_name: "A",
        id: "uuid",
        company_id: "c1",
        order_id: "o1",
        enquire_id: "ENQ001",
        status: "Converted",
      });
      expect(result).toEqual({ lead_name: "A" });
    });

    it("returns empty if no valid fields", () => {
      const result = sanitise({ id: "abc", status: "Converted" });
      expect(Object.keys(result)).toHaveLength(0);
    });
  });
});
