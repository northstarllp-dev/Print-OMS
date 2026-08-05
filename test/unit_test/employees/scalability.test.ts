import { describe, expect, it } from "vitest";
import {
  canArchiveEmployeeWithJobs,
  computeEmployeeKpis,
  filterEmployeesCatalog,
  isEmployeeSubmitLocked,
  nextEmployeeIdFromExisting,
  workloadBucket,
  type EmployeeListRow,
} from "@/features/employees/employeeLogic";

describe("employee scalability, jobs & KPIs", () => {
  describe("Jobs Assigned", () => {
    it("classifies workload buckets", () => {
      expect(workloadBucket(0)).toBe("idle");
      expect(workloadBucket(2)).toBe("normal");
      expect(workloadBucket(5)).toBe("overloaded");
    });
  });

  describe("Manager KPIs", () => {
    it("surfaces idle and overloaded counts", () => {
      const employees: EmployeeListRow[] = [
        {
          id: "1",
          name: "A",
          role: "Designer",
          phone: "9876543210",
          email: "a@c.com",
          status: "Active",
          jobsAssigned: 0,
        },
        {
          id: "2",
          name: "B",
          role: "Production",
          phone: "9876543211",
          email: "b@c.com",
          status: "Active",
          jobsAssigned: 8,
        },
        {
          id: "3",
          name: "C",
          role: "Designer",
          phone: "9876543212",
          email: "c@c.com",
          status: "Inactive",
          jobsAssigned: 0,
        },
      ];
      expect(computeEmployeeKpis(employees)).toMatchObject({
        idle: 1,
        overloaded: 1,
        frozen: 1,
      });
    });
  });

  describe("Scalability", () => {
    it("allocates next employee IDs after thousands of staff", () => {
      const ids = Array.from({ length: 2_000 }, (_, i) => `E${String(i + 1).padStart(3, "0")}`);
      expect(nextEmployeeIdFromExisting(ids)).toBe("E2001");
    });

    it("filters large multi-branch-like catalogs by department + role", () => {
      const employees: EmployeeListRow[] = Array.from({ length: 500 }, (_, i) => ({
        id: `u${i}`,
        name: `Emp ${i}`,
        role: i % 2 === 0 ? "Designer" : "Production",
        phone: "9876543210",
        email: `e${i}@c.com`,
        status: "Active",
        department: `Branch ${i % 5}`,
        jobsAssigned: i % 3,
      }));
      const out = filterEmployeesCatalog(employees, {
        roleFilter: "Designer",
        departmentFilter: "Branch 0",
      });
      expect(out.every((e) => e.role === "Designer" && e.department === "Branch 0")).toBe(
        true
      );
    });
  });

  describe("Edge Cases", () => {
    it("locks save during in-flight update", () => {
      expect(isEmployeeSubmitLocked(true)).toBe(true);
    });

    it("blocks delete when active jobs remain", () => {
      expect(canArchiveEmployeeWithJobs(9).reason).toMatch(/9 job/);
    });
  });
});
