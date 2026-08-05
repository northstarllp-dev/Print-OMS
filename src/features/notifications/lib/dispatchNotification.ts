import { createAdminClient } from "@/utils/supabase/admin";
import { OrderStage } from "@/features/orders/workspace/shared/types";
import { resolveStageGrant } from "@/features/orders/workspace/shared/stageGrants";
import { createNotification } from "../actions/notificationActions";

interface DispatchEvent {
  title: string;
  message: string;
  type: "info" | "success" | "warning" | "error";
  link?: string;
}

/**
 * Map real DB stage strings (e.g. "Site Visit Pending") → OrderStage RBAC keys.
 * Any stage that doesn't map falls back to the input itself (handled via type cast).
 */
const DB_STAGE_TO_ORDER_STAGE: Record<string, OrderStage> = {
  // Enquiry
  "enquiry": "enquiry",
  // Site Visit
  "Site Visit Pending": "site_visit",
  "Site Visit Scheduled": "site_visit",
  "Site Visit Completed": "site_visit",
  // Quotation
  "Quotation Pending": "quotation",
  "Quotation Sent": "quotation",
  "Quotation Approved": "quotation",
  // Invoice
  "Invoice Pending": "invoice",
  "Invoice Sent": "invoice",
  "Invoice Paid": "invoice",
  // Design
  "Design Pending": "design",
  "Design In Progress": "design",
  "Design Approved": "design",
  // Production
  "Production": "production",
  "Production Pending": "production",
  "Production In Progress": "production",
  "Ready For Dispatch": "production",
  // Installation
  "Ready For Installation": "installation",
  "Installation Scheduled": "installation",
  "Installation In Progress": "installation",
  "Installation Completed": "installation",
  // Service
  "Completed": "service_tickets",
  "Closed": "service_tickets",
};

function resolveOrderStage(stage: string): OrderStage {
  return DB_STAGE_TO_ORDER_STAGE[stage] ?? (stage as OrderStage);
}

/**
 * Dispatch a notification for a specific stage event, resolving recipients based on RBAC.
 * Accepts either an OrderStage key OR a raw DB stage name (e.g. "Site Visit Pending").
 */
export async function dispatchStageNotification(
  stage: string,
  companyId: string | null,
  event: DispatchEvent
) {
  if (!companyId) return;

  const supabase = createAdminClient();
  if (!supabase) {
    console.error("Admin client not found for dispatchStageNotification");
    return;
  }

  const orderStage = resolveOrderStage(stage);

  // 1. Fetch all active employees (staff) and admins for this company
  // Note: We use admin client because RLS might prevent current user from seeing everyone.
  const { data: users, error } = await supabase
    .from("users")
    .select("id, role, staff_role, status")
    .eq("company_id", companyId)
    .neq("status", "Inactive"); // Don't notify frozen users

  if (error || !users) {
    console.error("Error fetching users for notification dispatch", error);
    return;
  }

  // 2. Loop through users and resolve their grants
  for (const user of users) {
    if (user.role === "admin") {
      // Admins always get notified
      await createNotification(user.id, companyId, event);
      continue;
    }

    if (user.role === "staff") {
      // Resolve staff grant for this stage
      const grant = resolveStageGrant(
        { role: "staff", staff_role: user.staff_role, company_id: companyId },
        orderStage
      );

      // If they can view OR edit, they receive the notification
      if (grant.canView || grant.canEdit) {
        await createNotification(user.id, companyId, event);
      }
    }
  }
}


/**
 * Dispatch a notification directly to a specific user (e.g., Task Assigned)
 */
export async function dispatchDirectNotification(
  userId: string,
  companyId: string | null,
  event: DispatchEvent
) {
  await createNotification(userId, companyId, event);
}

/**
 * Dispatch a notification to all admins of a company (e.g., SLA Breach)
 */
export async function dispatchAdminNotification(
  companyId: string | null,
  event: DispatchEvent
) {
  if (!companyId) return;
  const supabase = createAdminClient();
  if (!supabase) return;

  const { data: admins, error } = await supabase
    .from("users")
    .select("id, status")
    .eq("company_id", companyId)
    .eq("role", "admin")
    .neq("status", "Inactive");

  if (error || !admins) return;

  for (const admin of admins) {
    await createNotification(admin.id, companyId, event);
  }
}
