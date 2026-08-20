import type { Order } from "@/types";

/** Map getOrderById() result → worksheet / detail client Order shape. */
export function mapDbOrderToWorksheetOrder(o: Record<string, unknown>): Order {
  return {
    id: o.id as string,
    clientName: o.client_name as string,
    businessName: (o.business_name as string) || "",
    customerId: o.customer_id as string,
    stage: o.stage as Order["stage"],
    productType: o.product_type as string | undefined,
    requirements: o.requirements as string | undefined,
    assignedEmployees: (o.assigned_employees as string[]) || [],
    dateCreated: o.date_created as string,
    versionHistory: (o.version_history as Order["versionHistory"]) || [],
    chatHistory: (o.chat_history as Order["chatHistory"]) || [],
    siteVisitDetails: o.siteVisitDetails as Order["siteVisitDetails"],
    design: o.design as Order["design"],
    productionDetails: o.productionDetails as Order["productionDetails"],
    installationDetails: o.installationDetails as Order["installationDetails"],
    stageStatus: o.stage_status as Order["stageStatus"],
    stageAdminNotes: o.stage_admin_notes as string | undefined,
    customerName: (o.business_name as string) || "",
    orderCode: (o.order_id as string) || (o.id as string),
    orderId: (o.order_id as string) || (o.id as string),
    health:
      ((o.stage === "Completed" || o.stage === "Closed") &&
      o.health === "Needs Attention"
        ? "Active"
        : (o.health as string) || "Active"),
    lost_reason: o.lost_reason as string | undefined,
    hold_note: (o.hold_note as string | null | undefined) ?? null,
    reach_out_at: (o.reach_out_at as string | null | undefined) ?? null,
    workflow_type: ((o.workflow_type as Order["workflow_type"]) || "quote_first"),
    business_operation: (o.business_operation as string) || "signage",
    delivery_method: (o.delivery_method as string) || "installation",
    pickup_confirmed_at: (o.pickup_confirmed_at as string | null) ?? null,
  };
}
