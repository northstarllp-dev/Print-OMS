import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/features/auth/actions/authActions", () => ({
  getCurrentUser: vi.fn(),
}));

import { getCurrentUser } from "@/features/auth/actions/authActions";
import {
  assertAdminOnly,
  assertCanAssignOrderTeam,
  assertOrderUpdateAccess,
  assertStaffOrAdmin,
} from "@/features/orders/workspace/shared/serverPermissions";

describe("orders server RBAC", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("assertAdminOnly", () => {
    it("allows admin and rejects staff/anon", async () => {
      vi.mocked(getCurrentUser).mockResolvedValueOnce({ role: "admin" } as any);
      await expect(assertAdminOnly()).resolves.toBeUndefined();

      vi.mocked(getCurrentUser).mockResolvedValueOnce({ role: "staff" } as any);
      await expect(assertAdminOnly()).rejects.toThrow(/admin access required/);

      vi.mocked(getCurrentUser).mockResolvedValueOnce(null as any);
      await expect(assertAdminOnly()).rejects.toThrow(/Unauthorized/);
    });
  });

  describe("assertOrderUpdateAccess", () => {
    it("allows staff for status-only patches", async () => {
      vi.mocked(getCurrentUser).mockResolvedValueOnce({
        role: "staff",
        staff_role: "Production",
      } as any);
      await expect(
        assertOrderUpdateAccess({ stage_status: "Pending Admin Approval: Production Ready" })
      ).resolves.toBeUndefined();
    });

    it("requires admin for field patches", async () => {
      vi.mocked(getCurrentUser).mockResolvedValueOnce({
        role: "staff",
        staff_role: "Production",
      } as any);
      await expect(assertOrderUpdateAccess({ health: "On Hold" })).rejects.toThrow(
        /admin access required/
      );

      vi.mocked(getCurrentUser).mockResolvedValueOnce({ role: "admin" } as any);
      await expect(assertOrderUpdateAccess({ health: "On Hold" })).resolves.toBeUndefined();
    });
  });

  describe("assertCanAssignOrderTeam", () => {
    it("allows admin always", async () => {
      vi.mocked(getCurrentUser).mockResolvedValueOnce({ role: "admin" } as any);
      await expect(assertCanAssignOrderTeam()).resolves.toBeUndefined();
    });

    it("allows staff with enquiry edit (Marketer)", async () => {
      vi.mocked(getCurrentUser).mockResolvedValueOnce({
        role: "staff",
        staff_role: "Marketer",
        company_id: null,
      } as any);
      await expect(assertCanAssignOrderTeam()).resolves.toBeUndefined();
    });

    it("rejects Production staff without enquiry edit", async () => {
      vi.mocked(getCurrentUser).mockResolvedValueOnce({
        role: "staff",
        staff_role: "Production",
        company_id: null,
      } as any);
      await expect(assertCanAssignOrderTeam()).rejects.toThrow(/assign employees/);
    });
  });

  describe("assertStaffOrAdmin", () => {
    it("rejects non-staff roles", async () => {
      vi.mocked(getCurrentUser).mockResolvedValueOnce({ role: "customer" } as any);
      await expect(assertStaffOrAdmin()).rejects.toThrow(/staff or admin/);
    });
  });
});
