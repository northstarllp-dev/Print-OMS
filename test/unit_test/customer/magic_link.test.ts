import { describe, expect, it } from "vitest";
import {
  defaultPortalExpiryDays,
  isCustomerPortalExpired,
  isOpaquePortalTokenShape,
  isPortalTokenExpired,
  isPortalTokenRevoked,
  portalTokenMatchesCustomer,
  portalTokenMatchesOrder,
} from "@/features/customers/customerLogic";
import {
  PORTAL_TOKEN_LENGTH,
  buildPortalUrl,
  generatePortalTokenSync,
} from "@/utils/portal-tokens";

describe("customer magic link / portal", () => {
  describe("Generate", () => {
    it("creates opaque token of expected length with default expiry", () => {
      const { token, jti, expiresAt, scopes } = generatePortalTokenSync("cust-uuid", "ord-uuid", {
        expiresInDays: defaultPortalExpiryDays(),
      });
      expect(token).toBe(jti);
      expect(token.length).toBe(PORTAL_TOKEN_LENGTH);
      expect(isOpaquePortalTokenShape(token)).toBe(true);
      expect(scopes.length).toBeGreaterThan(0);
      expect(expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    it("builds portal URL with token query param", () => {
      const url = buildPortalUrl("AbCdEfGhIjKl", "https://app.example.com");
      expect(url).toContain("/portal?");
      expect(url).toContain("token=AbCdEfGhIjKl");
    });
  });

  describe("Expired / Revoked", () => {
    it("detects expired and revoked tokens", () => {
      expect(isPortalTokenExpired(new Date(Date.now() - 1000))).toBe(true);
      expect(isPortalTokenExpired(new Date(Date.now() + 60_000))).toBe(false);
      expect(isPortalTokenRevoked(null)).toBe(false);
      expect(isPortalTokenRevoked("2026-01-01T00:00:00Z")).toBe(true);
    });

    it("marks customer portal expired when all linked orders are closed", () => {
      expect(
        isCustomerPortalExpired("c1", [
          { customerId: "c1", stage: "Completed" },
          { customerId: "c1", stage: "Closed" },
        ])
      ).toBe(true);
      expect(
        isCustomerPortalExpired("c1", [
          { customerId: "c1", stage: "Completed" },
          { customerId: "c1", stage: "Production" },
        ])
      ).toBe(false);
      expect(isCustomerPortalExpired("c1", [])).toBe(false);
    });
  });

  describe("Security", () => {
    it("blocks cross-customer portal access (no IDOR)", () => {
      expect(portalTokenMatchesCustomer("cust-a", "cust-a")).toBe(true);
      expect(portalTokenMatchesCustomer("cust-a", "cust-b")).toBe(false);
    });

    it("blocks order portal when order belongs to another customer", () => {
      expect(portalTokenMatchesOrder("ord-1", "cust-a", "cust-a")).toBe(true);
      expect(portalTokenMatchesOrder("ord-1", "cust-b", "cust-a")).toBe(false);
      expect(portalTokenMatchesOrder(undefined, "cust-b", "cust-a")).toBe(true);
    });

    it("rejects dotted/legacy-looking strings as opaque tokens", () => {
      expect(isOpaquePortalTokenShape("aaa.bbb")).toBe(false);
      expect(isOpaquePortalTokenShape("short")).toBe(false);
    });
  });
});
