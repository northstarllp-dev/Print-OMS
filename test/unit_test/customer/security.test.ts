import { describe, expect, it } from "vitest";
import {
  canAccessCustomerCrm,
  canArchiveCustomers,
  canEditCustomer,
  canGeneratePortalLink,
  customerRoleCanAccessCrm,
  designerSeesFullCustomerCrm,
  mapDbCustomerToListRow,
} from "@/features/customers/customerLogic";

describe("customer security & RBAC", () => {
  describe("RBAC", () => {
    it("admin and sales can access CRM; customer role cannot", () => {
      expect(canAccessCustomerCrm("admin")).toBe(true);
      expect(canAccessCustomerCrm("sales")).toBe(true);
      expect(canAccessCustomerCrm("production")).toBe(false);
      expect(customerRoleCanAccessCrm()).toBe(false);
    });

    it("edit / archive / portal generation permissions", () => {
      expect(canEditCustomer("admin")).toBe(true);
      expect(canEditCustomer("sales")).toBe(true);
      expect(canEditCustomer("designer")).toBe(false);
      expect(canArchiveCustomers("admin")).toBe(true);
      expect(canArchiveCustomers("sales")).toBe(false);
      expect(canGeneratePortalLink("sales")).toBe(true);
      expect(canGeneratePortalLink("production")).toBe(false);
      expect(designerSeesFullCustomerCrm()).toBe(false);
    });
  });

  describe("Data Isolation", () => {
    it("list mapping keeps friendly customer_id separate from uuid id", () => {
      const row = mapDbCustomerToListRow({
        id: "uuid-aaa",
        name: "X",
        phone: "9999999999",
        email: "x@y.com",
        customer_id: "CUS-099",
      });
      expect(row.id).toBe("uuid-aaa");
      expect(row.customerCode).toBe("CUS-099");
    });
  });
});
