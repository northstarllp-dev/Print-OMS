import { assertPortalTenantAccess } from "@/utils/portal/portalTenantAuth";

/** Validates portal session cookie or token + deploy company_id, returns the order UUID. */
export async function assertPortalUploadAccess(
  orderId: string,
  requiredScope: string,
  portalToken?: string
): Promise<string> {
  const { orderUuid } = await assertPortalTenantAccess({
    orderId,
    requiredScope,
    portalToken,
  });
  if (!orderUuid) throw new Error("Unauthorized");
  return orderUuid;
}
