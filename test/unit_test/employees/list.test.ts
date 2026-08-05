import { describe, expect, it } from "vitest";
import {
  computeEmployeeKpis,
  filterEmployeesCatalog,
  mapDbUserToEmployee,
  paginateEmployees,
  resetEmployeeFilters,
  sortEmployeesByName,
  type EmployeeListRow,
} from "@/features/employees/employeeLogic";

const employees: EmployeeListRow[] = [
  {
    id: "u1",
    employeeId: "E001",
    name: "Anita Designer",
    role: "Designer",
    phone: "9876543210",
    email: "anita@co.com",
    status: "Active",
    jobsAssigned: 3,
    department: "Creative",
  },
  {
    id: "u2",
    employeeId: "E002",
    name: "Bala Production",
    role: "Production",
    phone: "9123456780",
    email: "bala@co.com",
    status: "Inactive",
    jobsAssigned: 0,
    department: "Shopfloor",
  },
  {
    id: "u3",
    employeeId: "E003",
    name: "Chitra Sales",
    role: "Marketer",
    phone: "9000000000",
    email: "chitra@co.com",
    status: "Active",
    jobsAssigned: 6,
    department: "Sales",
    online: true,
  },
];

describe("employee list", () => {
  describe("Display", () => {
    it("maps DB users to list columns including job count", () => {
      const row = mapDbUserToEmployee({
        id: "uuid",
        employee_id: "E010",
        name: "Dev",
        staff_role: "Installation",
        phone: "9999999999",
        email: "d@co.com",
        status: "Active",
        order_assignments: [{ id: "a" }, { id: "b" }],
      });
      expect(row).toMatchObject({
        employeeId: "E010",
        role: "Installation",
        jobsAssigned: 2,
      });
    });

    it("paginates and sorts by name", () => {
      const sorted = sortEmployeesByName(employees);
      expect(sorted.map((e) => e.name)[0]).toBe("Anita Designer");
      expect(paginateEmployees(sorted, 1, 2).items).toHaveLength(2);
      expect(paginateEmployees(sorted, 2, 2).totalPages).toBe(2);
    });
  });

  describe("KPI & Analytics", () => {
    it("computes active / frozen / workload KPIs", () => {
      expect(computeEmployeeKpis(employees)).toMatchObject({
        total: 3,
        active: 2,
        frozen: 1,
        totalJobsAssigned: 9,
        overloaded: 1,
        idle: 0,
      });
    });
  });

  describe("Filters", () => {
    it("filters Active / Inactive (Frozen)", () => {
      expect(
        filterEmployeesCatalog(employees, { statusFilter: "Active" }).map((e) => e.id)
      ).toEqual(["u1", "u3"]);
      expect(
        filterEmployeesCatalog(employees, { statusFilter: "Frozen" }).map((e) => e.id)
      ).toEqual(["u2"]);
    });

    it("filters by role and online status", () => {
      expect(
        filterEmployeesCatalog(employees, { roleFilter: "Designer" }).map((e) => e.id)
      ).toEqual(["u1"]);
      expect(
        filterEmployeesCatalog(employees, { statusFilter: "Online" }).map((e) => e.id)
      ).toEqual(["u3"]);
    });

    it("combines role + status and resets defaults", () => {
      expect(
        filterEmployeesCatalog(employees, {
          roleFilter: "Marketer",
          statusFilter: "Active",
          search: "chitra",
        }).map((e) => e.id)
      ).toEqual(["u3"]);
      expect(resetEmployeeFilters()).toEqual({
        search: "",
        statusFilter: "ALL",
        roleFilter: "ALL",
        departmentFilter: "ALL",
      });
    });
  });
});
