import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { getCurrentUser } from "@/features/auth/actions/authActions";
import { resolveStagePermission } from "./permissions";
import type { OrderStage } from "./types";

/**
 * Server-side authority check (Layer 2 of RBAC — see plan).
 * Mirrors the UI's resolveStagePermission so both layers stay in sync.
 *
 * Only call this from mutation actions that are exclusively staff/admin-authored.
 * For actions also invoked by the customer portal, use assertStageEditOrPortalOrder.
 */
export async function assertStageEditPermission(stage: OrderStage): Promise<void> {
  const profile = await getCurrentUser();
  if (!profile) {
    throw new Error("Unauthorized");
  }

  const actor = {
    role: profile.role,
    staff_role: profile.staff_role ?? null,
    company_id: profile.company_id ?? null,
  };
  const { canEdit } = resolveStagePermission(stage, actor);

  if (!canEdit) {
    throw new Error(`Forbidden: you do not have permission to edit the ${stage} stage`);
  }
}

async function assertValidPortalSessionForOrder(orderId: string): Promise<void> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("portal_session")?.value;
  if (!sessionCookie) {
    throw new Error("Unauthorized");
  }

  let session: {
    customerId?: string;
    orderId?: string;
    scopes?: string[];
    exp?: number;
  };
  try {
    session = JSON.parse(sessionCookie);
  } catch {
    throw new Error("Unauthorized");
  }

  const now = Math.floor(Date.now() / 1000);
  if (!session.exp || session.exp < now) {
    throw new Error("Unauthorized");
  }

  // Direct match on uuid or friendly order code in the session.
  if (session.orderId && (session.orderId === orderId)) {
    return;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {},
      },
    }
  );

  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  let order: { id: string; order_id: string | null; customer_id: string | null } | null = null;

  if (uuidPattern.test(orderId)) {
    const { data } = await supabase
      .from("orders")
      .select("id, order_id, customer_id")
      .eq("id", orderId)
      .maybeSingle();
    order = data;
  } else {
    const { data } = await supabase
      .from("orders")
      .select("id, order_id, customer_id")
      .eq("order_id", orderId)
      .maybeSingle();
    order = data;
  }

  if (!order) {
    throw new Error("Unauthorized");
  }

  if (session.orderId && (session.orderId === order.id || session.orderId === order.order_id)) {
    return;
  }

  // Customer-scoped portal tokens (friendly customer_id) may access any of their orders.
  if (session.customerId) {
    const { data: customer } = await supabase
      .from("customers")
      .select("id")
      .eq("customer_id", session.customerId)
      .maybeSingle();
    if (customer && order.customer_id === customer.id) {
      return;
    }
  }

  throw new Error("Unauthorized");
}

/**
 * Staff/admin with stage grant, or a valid customer portal session for the order.
 * Use for mutations shared with the customer portal (e.g. design approve/revise).
 */
export async function assertStageEditOrPortalOrder(
  stage: OrderStage,
  orderId: string
): Promise<void> {
  const profile = await getCurrentUser();
  if (profile) {
    const actor = {
      role: profile.role,
      staff_role: profile.staff_role ?? null,
      company_id: profile.company_id ?? null,
    };
    const { canEdit } = resolveStagePermission(stage, actor);
    if (!canEdit) {
      throw new Error(`Forbidden: you do not have permission to edit the ${stage} stage`);
    }
    return;
  }

  await assertValidPortalSessionForOrder(orderId);
}

/**
 * Server-side admin-only check (Phase 6) for actions outside the stage RBAC
 * model, e.g. Payments — admin-only regardless of staff_role stage grants.
 */
export async function assertAdminOnly(): Promise<void> {
  const profile = await getCurrentUser();
  if (!profile) {
    throw new Error("Unauthorized");
  }
  if (profile.role !== "admin") {
    throw new Error("Forbidden: admin access required");
  }
}
