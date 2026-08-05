import { describe, expect, it } from "vitest";
import {
  canAdminResetPassword,
  canResetDeletedEmployeePassword,
  canResetFrozenEmployeePassword,
  canResetOwnPasswordAsAdminWithoutPolicy,
  passwordsMatch,
  validatePasswordPolicy,
} from "@/features/employees/employeeLogic";

describe("employee password reset & change", () => {
  describe("Reset Password", () => {
    it("admin-only gate", () => {
      expect(canAdminResetPassword("admin")).toBe(true);
      expect(canAdminResetPassword("staff")).toBe(false);
      expect(canAdminResetPassword("sales")).toBe(false);
    });

    it("enforces min password policy (current UI = 6)", () => {
      expect(validatePasswordPolicy("12345")).toMatch(/at least 6/);
      expect(validatePasswordPolicy("123456")).toBeNull();
    });

    it("allows reset for frozen employees; rejects deleted", () => {
      expect(canResetFrozenEmployeePassword("Inactive")).toBe(true);
      expect(canResetDeletedEmployeePassword(false)).toBe(false);
      expect(canResetDeletedEmployeePassword(true)).toBe(true);
    });

    it("does not allow unrestricted self-reset as admin without policy", () => {
      expect(canResetOwnPasswordAsAdminWithoutPolicy()).toBe(false);
    });
  });

  describe("Change Password (staff)", () => {
    it("requires matching confirmation", () => {
      expect(passwordsMatch("Secret1!", "Secret1!")).toBe(true);
      expect(passwordsMatch("Secret1!", "Secret2!")).toBe(false);
    });
  });
});
