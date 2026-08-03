import { describe, expect, it } from "vitest";
import {
  computeEmployeeKpis,
  filterEmployeesCatalog,
  paginateEmployees,
  type EmployeeListRow,
} from "@/features/employees/employeeLogic";

function makeEmployees(n: number): EmployeeListRow[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `u${i}`,
    employeeId: `E${String(i + 1).padStart(3, "0")}`,
    name: `Employee ${i}`,
    role: (["Designer", "Production", "Installation", "Marketer"] as const)[i % 4],
    phone: `9${String(100000000 + i).slice(0, 9)}`,
    email: `e${i}@co.com`,
    status: i % 7 === 0 ? "Inactive" : "Active",
    jobsAssigned: i % 6,
    department: `Dept ${i % 10}`,
    online: i % 2 === 0,
  }));
}

describe("employee performance", () => {
  describe("Performance", () => {
    it("filters 10 employees quickly", () => {
      const rows = makeEmployees(10);
      const t0 = performance.now();
      expect(filterEmployeesCatalog(rows, { search: "Employee 5" })).toHaveLength(1);
      expect(performance.now() - t0).toBeLessThan(50);
    });

    it("filters 100 employees under budget", () => {
      const rows = makeEmployees(100);
      const t0 = performance.now();
      filterEmployeesCatalog(rows, {
        statusFilter: "Active",
        roleFilter: "Designer",
        search: "Employee 4",
      });
      expect(performance.now() - t0).toBeLessThan(50);
    });

    it("filters 10,000 employees under budget with pagination + KPIs", () => {
      const rows = makeEmployees(10_000);
      const t0 = performance.now();
      const filtered = filterEmployeesCatalog(rows, { statusFilter: "Active" });
      paginateEmployees(filtered, 1, 50);
      computeEmployeeKpis(rows);
      expect(performance.now() - t0).toBeLessThan(500);
    });
  });
});
