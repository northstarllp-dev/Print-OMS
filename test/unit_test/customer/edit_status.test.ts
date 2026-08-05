import { describe, expect, it } from "vitest";
import {
  canArchiveCustomer,
  getCustomerStatusColor,
  isCustomerSubmitLocked,
  isDuplicateCustomerEmail,
  isDuplicateCustomerPhone,
  shouldHardDeleteCustomer,
  validateCustomerEditForm,
  validateEmail,
  validateGstNumber,
  validatePhone,
} from "@/features/customers/customerLogic";

describe("customer edit & status", () => {
  describe("Validation", () => {
    it("validates phone and email", () => {
      expect(validatePhone("")).toMatch(/required/);
      expect(validatePhone("123")).toMatch(/Invalid/);
      expect(validatePhone("+91 98765 43210")).toBeNull();
      expect(validateEmail("bad")).toMatch(/Invalid/);
      expect(validateEmail("ok@biz.com")).toBeNull();
    });

    it("validates GST when present", () => {
      expect(validateGstNumber("")).toBeNull();
      expect(validateGstNumber("BAD")).toMatch(/Invalid GST/);
      expect(validateGstNumber("29AAAAA0000A1Z5")).toBeNull();
    });

    it("detects duplicate phone and email", () => {
      const existing = [
        { id: "1", phone: "9876543210", email: "a@x.com" },
        { id: "2", phone: "9000000000", email: "b@x.com" },
      ];
      expect(isDuplicateCustomerPhone("+91 98765 43210", existing)).toBe(true);
      expect(isDuplicateCustomerPhone("9876543210", existing, "1")).toBe(false);
      expect(isDuplicateCustomerEmail("B@X.COM", existing)).toBe(true);
      expect(isDuplicateCustomerEmail("new@x.com", existing)).toBe(false);
    });

    it("aggregates edit-form errors", () => {
      const errors = validateCustomerEditForm({
        name: "",
        phone: "12",
        email: "nope",
        gstNumber: "x",
        status: "Nope",
      });
      expect(errors.name).toBeTruthy();
      expect(errors.phone).toBeTruthy();
      expect(errors.email).toBeTruthy();
      expect(errors.gstNumber).toBeTruthy();
      expect(errors.status).toBeTruthy();
    });
  });

  describe("Customer Status", () => {
    it("maps status badge colors including Blocked/Archived", () => {
      expect(getCustomerStatusColor("Active").label).toBe("ACTIVE");
      expect(getCustomerStatusColor("Blocked").label).toBe("BLOCKED");
      expect(getCustomerStatusColor("Archived").label).toBe("ARCHIVED");
    });

    it("blocks archive when customer has active orders", () => {
      const gate = canArchiveCustomer("c1", [
        { customerId: "c1", stage: "Production" },
        { customerId: "c1", stage: "Completed" },
      ]);
      expect(gate.ok).toBe(false);
      expect(gate.reason).toMatch(/active order/);
      expect(
        canArchiveCustomer("c1", [{ customerId: "c1", stage: "Closed" }]).ok
      ).toBe(true);
    });

    it("prefers soft lifecycle over hard delete", () => {
      expect(shouldHardDeleteCustomer()).toBe(false);
    });
  });

  describe("Buttons / UX", () => {
    it("locks save while submitting", () => {
      expect(isCustomerSubmitLocked(true)).toBe(true);
      expect(isCustomerSubmitLocked(false)).toBe(false);
    });
  });
});
