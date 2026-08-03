import { describe, expect, it } from "vitest";
import {
  employeeMatchesSearch,
  filterEmployeesCatalog,
  normalizeEmployeeSearch,
  sanitizeEmployeeSearchInput,
  type EmployeeListRow,
} from "@/features/employees/employeeLogic";

const employees: EmployeeListRow[] = [
  {
    id: "uuid-1",
    employeeId: "E001",
    name: "Anita O'Neil",
    role: "Designer",
    phone: "+91 98765 43210",
    email: "Anita@Co.com",
    status: "Active",
  },
  {
    id: "uuid-2",
    employeeId: "E002",
    name: "Bala Kumar",
    role: "Production",
    phone: "9000000001",
    email: "bala@co.com",
    status: "Active",
  },
];

describe("employee search", () => {
  describe("Search fields", () => {
    it("searches by employee ID, name, email, phone, role", () => {
      expect(filterEmployeesCatalog(employees, { search: "E001" })).toHaveLength(1);
      expect(filterEmployeesCatalog(employees, { search: "anita" })).toHaveLength(1);
      expect(filterEmployeesCatalog(employees, { search: "anita@co" })).toHaveLength(1);
      expect(filterEmployeesCatalog(employees, { search: "98765" })).toHaveLength(1);
      expect(filterEmployeesCatalog(employees, { search: "production" })).toHaveLength(1);
    });
  });

  describe("Search cases", () => {
    it("is case insensitive and trims spaces", () => {
      expect(normalizeEmployeeSearch("  Anita  ")).toBe("anita");
      expect(employeeMatchesSearch(employees[0], "  DESIGNER  ")).toBe(true);
    });

    it("supports partial and full match", () => {
      expect(employeeMatchesSearch(employees[0], "Neil")).toBe(true);
      expect(employeeMatchesSearch(employees[0], "Anita")).toBe(true);
      expect(employeeMatchesSearch(employees[1], "Bala Kumar")).toBe(true);
    });

    it("sanitizes special characters / injection probes and truncates large input", () => {
      expect(sanitizeEmployeeSearchInput("O'Neil")).toBe("ONeil");
      expect(sanitizeEmployeeSearchInput("'; DROP TABLE users;--")).toBe(
        " DROP TABLE users"
      );
      expect(sanitizeEmployeeSearchInput("a".repeat(500)).length).toBe(200);
    });

    it("returns no results for unknown term", () => {
      expect(filterEmployeesCatalog(employees, { search: "zzzz" })).toEqual([]);
    });
  });
});
