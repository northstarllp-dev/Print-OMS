import { cookies } from "next/headers";
import { loadClientConfig } from "@/config/loadClientConfig";
import { createAdminClient } from "@/utils/supabase/admin";
import { verifyPortalToken } from "@/utils/portal-tokens";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const PORTAL_WRONG_WORKSPACE =
  "Unauthorized access. This portal link belongs to a different client workspace.";

function requireAdmin() {
  const admin = createAdminClient();
  if (!admin) throw new Error("Server configuration error");
  return admin;
}

/** Deploy company UUID for the active CLIENT_SLUG. */
export function getPortalDeployCompanyId(): string {
  const id = loadClientConfig().companyId;
  if (!id) throw new Error("Client config is missing companyId");
  return id;
}

/** Throws PORTAL_WRONG_WORKSPACE if companyId !== deploy. */
export function assertCompanyMatchesDeploy(companyId: string | null | undefined): void {
  if (!companyId || companyId !== getPortalDeployCompanyId()) {
    throw new Error(PORTAL_WRONG_WORKSPACE);
  }
}

export async function resolvePortalOrderUuid(idOrOrderId: string): Promise<string> {
  if (uuidPattern.test(idOrOrderId)) return idOrOrderId;
  const admin = requireAdmin();
  // Friendly order_id collides across tenants — always scope to deploy company.
  const { data, error } = await admin
    .from("orders")
    .select("id")
    .eq("order_id", idOrOrderId)
    .eq("company_id", getPortalDeployCompanyId())
    .maybeSingle();
  if (error || !data) throw new Error("Unauthorized");
  return data.id;
}

/**
 * Load order and assert it belongs to this deploy's company.
 * Returns order fields needed by callers.
 */
export async function assertOrderTenantAccess(orderId: string): Promise<{
  id: string;
  order_id: string | null;
  customer_id: string | null;
  company_id: string;
}> {
  const admin = requireAdmin();
  const orderUuid = await resolvePortalOrderUuid(orderId);
  const { data: order } = await admin
    .from("orders")
    .select("id, order_id, customer_id, company_id")
    .eq("id", orderUuid)
    .maybeSingle();
  if (!order) throw new Error("Unauthorized");
  assertCompanyMatchesDeploy(order.company_id);
  return order as {
    id: string;
    order_id: string | null;
    customer_id: string | null;
    company_id: string;
  };
}

/**
 * Load customer by friendly customer_id or UUID and assert deploy company.
 */
export async function assertCustomerTenantAccess(customerIdOrFriendly: string): Promise<{
  id: string;
  customer_id: string | null;
  company_id: string;
}> {
  const admin = requireAdmin();
  const deployCompanyId = getPortalDeployCompanyId();
  let customer: { id: string; customer_id: string | null; company_id: string | null } | null =
    null;

  if (uuidPattern.test(customerIdOrFriendly)) {
    const { data } = await admin
      .from("customers")
      .select("id, customer_id, company_id")
      .eq("id", customerIdOrFriendly)
      .maybeSingle();
    customer = data;
  }
  if (!customer) {
    // Friendly customer_id collides across tenants — scope to deploy company.
    const { data } = await admin
      .from("customers")
      .select("id, customer_id, company_id")
      .eq("customer_id", customerIdOrFriendly)
      .eq("company_id", deployCompanyId)
      .maybeSingle();
    customer = data;
  }
  if (!customer) throw new Error("Unauthorized");
  assertCompanyMatchesDeploy(customer.company_id);
  return customer as {
    id: string;
    customer_id: string | null;
    company_id: string;
  };
}

type PortalSession = {
  customerId?: string;
  orderId?: string;
  scopes?: string[];
  exp?: number;
};

async function readPortalSession(): Promise<PortalSession | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("portal_session")?.value;
  if (!sessionCookie) return null;
  try {
    const session = JSON.parse(sessionCookie) as PortalSession;
    const now = Math.floor(Date.now() / 1000);
    if (!session.exp || session.exp < now) return null;
    return session;
  } catch {
    return null;
  }
}

/**
 * Dual auth for portal mutations:
 * 1) Valid session cookie or HMAC portalToken (+ optional scope)
 * 2) Target order/customer company_id === deploy companyId
 */
export async function assertPortalTenantAccess(opts: {
  orderId?: string;
  customerId?: string;
  portalToken?: string;
  requiredScope?: string;
}): Promise<{ orderUuid?: string; companyId: string }> {
  const deployCompanyId = getPortalDeployCompanyId();
  const session = await readPortalSession();

  let authenticated = false;
  let tokenPayload: ReturnType<typeof verifyPortalToken> = null;

  if (session) {
    if (
      opts.requiredScope &&
      (!session.scopes || !session.scopes.includes(opts.requiredScope))
    ) {
      // Cookie present but missing scope — try token fallback below
    } else {
      authenticated = true;
    }
  }

  if (!authenticated && opts.portalToken) {
    tokenPayload = verifyPortalToken(opts.portalToken);
    if (!tokenPayload) throw new Error("Unauthorized");
    if (
      opts.requiredScope &&
      !tokenPayload.scopes.includes(opts.requiredScope)
    ) {
      throw new Error(`Forbidden: missing portal scope "${opts.requiredScope}"`);
    }
    authenticated = true;
  }

  if (!authenticated) throw new Error("Unauthorized");

  // Prefer order-scoped check when orderId provided
  if (opts.orderId) {
    const order = await assertOrderTenantAccess(opts.orderId);

    // Ownership: session/token must match order or customer
    const ownerOk = await assertOwnershipAgainstOrder(
      order,
      session,
      tokenPayload
    );
    if (!ownerOk) throw new Error("Unauthorized");

    return { orderUuid: order.id, companyId: deployCompanyId };
  }

  if (opts.customerId) {
    const customer = await assertCustomerTenantAccess(opts.customerId);
    const sid = session?.customerId || tokenPayload?.customerId;
    if (sid && sid !== customer.customer_id && sid !== customer.id) {
      throw new Error("Unauthorized");
    }
    return { companyId: deployCompanyId };
  }

  // Token/session alone: still verify customer on token belongs to deploy
  const friendlyCustomer =
    session?.customerId || tokenPayload?.customerId;
  if (friendlyCustomer) {
    await assertCustomerTenantAccess(friendlyCustomer);
    return { companyId: deployCompanyId };
  }

  throw new Error("Unauthorized");
}

async function assertOwnershipAgainstOrder(
  order: {
    id: string;
    order_id: string | null;
    customer_id: string | null;
  },
  session: PortalSession | null,
  tokenPayload: ReturnType<typeof verifyPortalToken>
): Promise<boolean> {
  const orderRef = session?.orderId || tokenPayload?.orderId;
  if (orderRef && (orderRef === order.id || orderRef === order.order_id)) {
    return true;
  }

  const customerRef = session?.customerId || tokenPayload?.customerId;
  if (customerRef) {
    const customer = await assertCustomerTenantAccess(customerRef);
    if (order.customer_id === customer.id) return true;
  }

  // Session matched orderId string earlier paths may have returned already;
  // if we only had scope-valid session with no ids, deny.
  return false;
}
