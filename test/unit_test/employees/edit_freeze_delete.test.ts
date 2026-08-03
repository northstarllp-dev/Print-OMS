import { describe, expect, it } from "vitest";
import {
  canArchiveEmployeeWithJobs,
  canEmployeeLogin,
  employeeStatusLabel,
  filterEmployeesCatalog,
  isDuplicateEmployeeEmail,
  isDuplicateEmployeePhone,
  isEmployeeArchived,
  isEmployeeFrozen,
  isEmployeeSubmitLocked,
  recommendArchiveInsteadOfDelete,
  shouldHardDeleteEmployee,
  validateEmail,
  validateEmployeeForm,
  validatePhone,
  type EmployeeListRow,
} from "@/features/employees/employeeLogic";

describe("employee edit, freeze & archive", () => {
  describe("Validation", () => {
    it("validates phone and email", () => {
      expect(validatePhone("12")).toMatch(/Invalid/);
      expect(validatePhone("+91 98765 43210")).toBeNull();
      expect(validateEmail("bad")).toMatch(/Invalid/);
      expect(validateEmail("ok@co.com")).toBeNull();
    });

    it("detects duplicate email and phone", () => {
      const existing = [
        { id: "1", email: "a@co.com", phone: "9876543210" },
        { id: "2", email: "b@co.com", phone: "9000000000" },
      ];
      expect(isDuplicateEmployeeEmail("A@CO.COM", existing)).toBe(true);
      expect(isDuplicateEmployeeEmail("a@co.com", existing, "1")).toBe(false);
      expect(isDuplicateEmployeePhone("+91 98765 43210", existing)).toBe(true);
    });

    it("aggregates form errors", () => {
      const errors = validateEmployeeForm({
        name: "",
        email: "x",
        phone: "1",
        role: "",
      });
      expect(errors.name).toBeTruthy();
      expect(errors.email).toBeTruthy();
      expect(errors.phone).toBeTruthy();
      expect(errors.role).toBeTruthy();
    });
  });

  describe("Freeze Employee", () => {
    it("labels Inactive as Frozen in UI", () => {
      expect(employeeStatusLabel("Inactive")).toBe("Frozen");
      expect(employeeStatusLabel("Archived")).toBe("Archived");
      expect(employeeStatusLabel("Active")).toBe("Active");
    });

    it("frozen/inactive cannot login; archived cannot; active can", () => {
      expect(isEmployeeFrozen("Inactive")).toBe(true);
      expect(isEmployeeArchived("Archived")).toBe(true);
      expect(canEmployeeLogin("Inactive")).toBe(false);
      expect(canEmployeeLogin("Archived")).toBe(false);
      expect(canEmployeeLogin("Active")).toBe(true);
    });
  });

  describe("Archive Employee", () => {
    it("never hard deletes", () => {
      expect(shouldHardDeleteEmployee()).toBe(false);
      expect(recommendArchiveInsteadOfDelete()).toBe(true);
    });

    it("blocks archive when jobs are assigned", () => {
      expect(canArchiveEmployeeWithJobs(3).ok).toBe(false);
      expect(canArchiveEmployeeWithJobs(0).ok).toBe(true);
    });

    it("hides archived from default ALL filter", () => {
      const employees: EmployeeListRow[] = [
        {
          id: "1",
          name: "A",
          role: "Designer",
          phone: "9876543210",
          email: "a@c.com",
          status: "Active",
        },
        {
          id: "2",
          name: "B",
          role: "Production",
          phone: "9876543211",
          email: "b@c.com",
          status: "Archived",
        },
      ];
      expect(filterEmployeesCatalog(employees, { statusFilter: "ALL" }).map((e) => e.id)).toEqual([
        "1",
      ]);
      expect(
        filterEmployeesCatalog(employees, { statusFilter: "Archived" }).map((e) => e.id)
      ).toEqual(["2"]);
    });
  });

  describe("Buttons / UX", () => {
    it("locks submit while pending", () => {
      expect(isEmployeeSubmitLocked(true)).toBe(true);
    });
  });
});
