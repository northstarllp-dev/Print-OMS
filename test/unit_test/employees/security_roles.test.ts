import { describe, expect, it } from "vitest";
import {
  canFreezeEmployee,
  canManageEmployees,
  nextEmployeeIdFromExisting,
  permissionMatrixRoles,
  rolesUiIsImplemented,
  staffCanAccessEmployeeCrm,
} from "@/features/employees/employeeLogic";
import {
  DEFAULT_STAGE_GRANTS_BY_ROLE,
  resolveStageGrant,
} from "@/features/orders/workspace/shared/stageGrants";

describe("employee roles, permissions & security", () => {
  describe("RBAC", () => {
    it("only admin manages / freezes employees; staff cannot access CRM", () => {
      expect(canManageEmployees("admin")).toBe(true);
      expect(canManageEmployees("staff")).toBe(false);
      expect(canFreezeEmployee("admin")).toBe(true);
      expect(staffCanAccessEmployeeCrm()).toBe(false);
    });
  });

  describe("Roles / Permissions", () => {
    it("roles UI is not implemented yet (coming soon placeholder)", () => {
      expect(rolesUiIsImplemented()).toBe(false);
    });

    it("default stage permission matrix covers core staff roles", () => {
      expect(permissionMatrixRoles().sort()).toEqual(
        Object.keys(DEFAULT_STAGE_GRANTS_BY_ROLE).sort()
      );
      const designer = { role: "staff" as const, staff_role: "Designer" };
      const production = { role: "staff" as const, staff_role: "Production" };
      const installation = { role: "staff" as const, staff_role: "Installation" };
      const marketer = { role: "staff" as const, staff_role: "Marketer" };
      expect(resolveStageGrant(designer, "design")).toMatchObject({
        canView: true,
        canEdit: true,
      });
      expect(resolveStageGrant(production, "design")).toMatchObject({
        canView: false,
        canEdit: false,
      });
      expect(resolveStageGrant(installation, "installation")).toMatchObject({
        canEdit: true,
      });
      expect(resolveStageGrant(marketer, "quotation")).toMatchObject({
        canEdit: true,
      });
    });
  });

  describe("Database / IDs", () => {
    it("never reuses employee IDs (max+1)", () => {
      expect(nextEmployeeIdFromExisting(["E001", "E003"])).toBe("E004");
      expect(nextEmployeeIdFromExisting([])).toBe("E001");
    });
  });
});
