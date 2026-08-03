import { describe, expect, it } from "vitest";
import {
  buildConvertCustomerOrClauses,
  buildCustomerInsertFromConvert,
  buildEnquiryConvertedUpdate,
  buildOrderInsertFromConvert,
  canConvertEnquiry,
  canStartConvertSubmit,
  canSubmitConvertForm,
  filterProductsByName,
  isConvertSubmitDisabled,
  orderCreatedIdempotencyKey,
  shouldBlockConvert,
} from "@/features/enquiries/enquiryConvertLogic";
import { resolveStagePermission } from "@/features/orders/workspace/shared/permissions";

describe("convert", () => {
  describe("frontend", () => {
    it("shows Convert only for non-Converted enquiries", () => {
      expect(canConvertEnquiry("Pending")).toBe(true);
      expect(canConvertEnquiry("Converted")).toBe(false);
    });

    it("Create Order requires names and blocks double submit", () => {
      expect(canSubmitConvertForm({ clientName: "A", businessName: "B" })).toBe(true);
      expect(canSubmitConvertForm({ clientName: "  ", businessName: "B" })).toBe(false);
      expect(isConvertSubmitDisabled("A", "B", true)).toBe(true);
      expect(canStartConvertSubmit(false)).toBe(true);
      expect(canStartConvertSubmit(true)).toBe(false);
    });

    it("product typeahead filters by name (custom values still allowed)", () => {
      const products = [
        { id: "1", name: "ACP Board" },
        { id: "2", name: "LED Fascia" },
        { id: "3", name: "Neon Sign" },
      ];
      expect(filterProductsByName(products, "led").map((p) => p.name)).toEqual(["LED Fascia"]);
      expect(filterProductsByName(products, "")).toHaveLength(3);
      expect(filterProductsByName(products, "zzz")).toHaveLength(0);
    });
  });

  describe("backend", () => {
    it("builds customer + order inserts with writer company_id into right tables", () => {
      expect(
        buildCustomerInsertFromConvert(
          "company-uuid",
          { phone: "+9198", whatsapp: "+9198", email: "a@b.com", location: "Indiranagar" },
          "Client",
          "Biz"
        )
      ).toMatchObject({
        company_id: "company-uuid",
        name: "Biz",
        shipping_address: "Indiranagar",
      });

      expect(
        buildOrderInsertFromConvert(
          "co-1",
          "cust-uuid",
          {
            clientName: "Ramesh",
            businessName: "Gourmet",
            productType: "ACP Board",
            requirements: "Need fascia",
            assignedAdmins: ["admin-1"],
          },
          "Fallback"
        )
      ).toEqual({
        company_id: "co-1",
        client_name: "Ramesh",
        business_name: "Gourmet",
        customer_id: "cust-uuid",
        stage: "Site Visit Pending",
        health: "Active",
        product_type: "ACP Board",
        requirements: "Need fascia",
        assigned_admins: ["admin-1"],
      });
    });

    it("links enquiry as Converted and uses stable notify key", () => {
      expect(buildEnquiryConvertedUpdate("c-uuid", "o-uuid")).toEqual({
        status: "Converted",
        customer_id: "c-uuid",
        order_id: "o-uuid",
      });
      expect(orderCreatedIdempotencyKey("ORD042")).toBe("order_created:ORD042");
    });
  });

  describe("security", () => {
    it("blocks duplicate convert when already Converted or order_id set", () => {
      expect(shouldBlockConvert({ status: "Pending", order_id: null })).toBe(false);
      expect(shouldBlockConvert({ status: "Converted" })).toBe(true);
      expect(shouldBlockConvert({ order_id: "ord-uuid" })).toBe(true);
    });

    it("requires enquiry edit grant to convert", () => {
      expect(
        resolveStagePermission("enquiry", { role: "staff", staff_role: "Marketer" }).canEdit
      ).toBe(true);
      expect(
        resolveStagePermission("enquiry", { role: "staff", staff_role: "Production" }).canEdit
      ).toBe(false);
    });

    it("escapes customer match filters used on convert path", () => {
      const clauses = buildConvertCustomerOrClauses({
        phone: '91"evil',
        email: "ok@x.com",
      });
      expect(clauses[0]).toContain('\\"');
    });
  });

  describe("scalability", () => {
    it("searches large product catalogs correctly", () => {
      const products = Array.from({ length: 2000 }, (_, i) => ({
        id: String(i),
        name: i % 50 === 0 ? `LED Panel ${i}` : `Sign ${i}`,
      }));
      expect(filterProductsByName(products, "led panel")).toHaveLength(40);
    });
  });

  describe("performance", () => {
    it("duplicate-guard + order payload builders stay under budget", () => {
      const start = performance.now();
      for (let i = 0; i < 5000; i++) {
        shouldBlockConvert({ status: i % 10 === 0 ? "Converted" : "Pending" });
        buildOrderInsertFromConvert(
          "co",
          `c-${i}`,
          { clientName: "A", businessName: "B", productType: "ACP" },
          "A"
        );
      }
      expect(performance.now() - start).toBeLessThan(100);
    });
  });
});
