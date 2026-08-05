import { describe, expect, it } from "vitest";
import {
  customerMatchesSearch,
  filterCustomersCatalog,
  normalizeCustomerSearch,
  sanitizeCustomerSearchInput,
  type CustomerListRow,
} from "@/features/customers/customerLogic";

const customers: CustomerListRow[] = [
  {
    id: "1",
    name: "Gourmet Cafe",
    phone: "+91 98765 43210",
    email: "Ramesh@Cafe.com",
    customerCode: "CUS-001",
    contactPerson: "Ramesh Kumar",
    gstNumber: "29AAAAA0000A1Z5",
    status: "Active",
  },
  {
    id: "2",
    name: "O'Reilly Signs",
    phone: "9000000001",
    email: "hi@oreilly.com",
    customerCode: "CUS-002",
    status: "Active",
  },
];

describe("customer search", () => {
  describe("Search fields", () => {
    it("searches by customer ID, company, contact, phone, email, GST", () => {
      expect(filterCustomersCatalog(customers, [], { search: "CUS-001" })).toHaveLength(1);
      expect(filterCustomersCatalog(customers, [], { search: "gourmet" })).toHaveLength(1);
      expect(filterCustomersCatalog(customers, [], { search: "ramesh" })).toHaveLength(1);
      expect(filterCustomersCatalog(customers, [], { search: "98765" })).toHaveLength(1);
      expect(filterCustomersCatalog(customers, [], { search: "ramesh@cafe" })).toHaveLength(1);
      expect(filterCustomersCatalog(customers, [], { search: "29aaaaa" })).toHaveLength(1);
    });
  });

  describe("Search cases", () => {
    it("is case insensitive and trims spaces", () => {
      expect(normalizeCustomerSearch("  Gourmet  ")).toBe("gourmet");
      expect(customerMatchesSearch(customers[0], "  GOURMET  ")).toBe(true);
    });

    it("supports partial and exact matches", () => {
      expect(customerMatchesSearch(customers[0], "Cafe")).toBe(true);
      expect(customerMatchesSearch(customers[0], "Gourmet Cafe")).toBe(true);
    });

    it("handles special characters after sanitize", () => {
      expect(sanitizeCustomerSearchInput("O'Reilly")).toBe("OReilly");
      // Original name still searchable via partial without quote
      expect(customerMatchesSearch(customers[1], "Reilly")).toBe(true);
    });

    it("returns no results for unknown term", () => {
      expect(filterCustomersCatalog(customers, [], { search: "zzzz" })).toEqual([]);
    });

    it("truncates very long search strings", () => {
      const long = "a".repeat(500);
      expect(sanitizeCustomerSearchInput(long).length).toBe(200);
    });

    it("strips SQL injection probes from client search input", () => {
      expect(sanitizeCustomerSearchInput("'; DROP TABLE customers;--")).toBe(
        " DROP TABLE customers"
      );
      expect(sanitizeCustomerSearchInput("1' OR '1'='1")).toBe("1 OR 1=1");
    });
  });
});
