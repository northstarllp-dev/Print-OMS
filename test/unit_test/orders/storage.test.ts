import { describe, expect, it, vi, beforeEach } from "vitest";

const { mockRemove, mockFromOrders, mockMaybeSingle } = vi.hoisted(() => {
  const mockMaybeSingle = vi.fn();
  const mockFromOrders = vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        maybeSingle: mockMaybeSingle,
      })),
    })),
  }));
  const mockRemove = vi.fn().mockResolvedValue({ error: null });
  return { mockRemove, mockFromOrders, mockMaybeSingle };
});

vi.mock("@/features/auth/actions/authActions", () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock("@/features/service-tickets/ticketGrants", () => ({
  resolveTicketPermission: vi.fn(() => ({ canView: true, canManage: true })),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(() => ({
    from: (table: string) => {
      if (table === "orders") return mockFromOrders();
      return {};
    },
  })),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    storage: {
      from: vi.fn(() => ({
        remove: mockRemove,
      })),
    },
  })),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ getAll: () => [], setAll: () => {} })),
}));

import { getCurrentUser } from "@/features/auth/actions/authActions";
import { resolveTicketPermission } from "@/features/service-tickets/ticketGrants";
import { deleteStorageFilesAction } from "@/features/orders/actions/storageActions";

describe("deleteStorageFilesAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRemove.mockResolvedValue({ error: null });
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service";
  });

  it("rejects unauthenticated callers", async () => {
    vi.mocked(getCurrentUser).mockResolvedValueOnce(null as any);
    await expect(
      deleteStorageFilesAction("site-visit-photos", ["uuid/a.jpg"])
    ).rejects.toThrow(/Unauthorized/);
  });

  it("rejects non-allowlisted buckets", async () => {
    vi.mocked(getCurrentUser).mockResolvedValueOnce({
      role: "admin",
      company_id: "co-1",
    } as any);
    await expect(deleteStorageFilesAction("secret-bucket", ["a.jpg"])).rejects.toThrow(
      /bucket is not allowed/
    );
  });

  it("rejects path traversal", async () => {
    vi.mocked(getCurrentUser).mockResolvedValueOnce({
      role: "admin",
      company_id: "co-1",
    } as any);
    await expect(
      deleteStorageFilesAction("site-visit-photos", ["../etc/passwd"])
    ).rejects.toThrow(/Invalid storage path/);
  });

  it("deletes order-scoped path when order belongs to company", async () => {
    const orderId = "11111111-1111-1111-1111-111111111111";
    vi.mocked(getCurrentUser).mockResolvedValue({
      role: "staff",
      company_id: "co-1",
    } as any);
    mockMaybeSingle.mockResolvedValueOnce({
      data: { id: orderId, company_id: "co-1" },
      error: null,
    });

    await deleteStorageFilesAction("site-visit-photos", [`${orderId}/photo.jpg`]);

    expect(mockRemove).toHaveBeenCalledWith([`${orderId}/photo.jpg`]);
  });

  it("rejects order path for another company", async () => {
    const orderId = "11111111-1111-1111-1111-111111111111";
    vi.mocked(getCurrentUser).mockResolvedValue({
      role: "staff",
      company_id: "co-1",
    } as any);
    mockMaybeSingle.mockResolvedValueOnce({
      data: { id: orderId, company_id: "co-other" },
      error: null,
    });

    await expect(
      deleteStorageFilesAction("site-visit-photos", [`${orderId}/photo.jpg`])
    ).rejects.toThrow(/does not belong to your company/);
  });

  it("requires ticket manage for support/ paths", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({
      role: "staff",
      staff_role: "Production",
      company_id: "co-1",
    } as any);
    vi.mocked(resolveTicketPermission).mockReturnValueOnce({
      canView: false,
      canManage: false,
    });

    await expect(
      deleteStorageFilesAction("service-ticket-photos", ["support/a.jpg"])
    ).rejects.toThrow(/service ticket files/);
  });
});
