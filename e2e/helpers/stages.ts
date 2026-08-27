import type { Page } from "@playwright/test";
import { getServiceClient, PRINTOMS_COMPANY_ID } from "./db";
import type { CustomerFixture } from "../fixtures/customers";

export type OrderRef = {
  id: string;
  order_id: string;
  customer_id: string;
  stage: string;
  stage_status: string;
};

async function logTimeline(
  friendlyOrderId: string,
  content: string,
  metadata?: Record<string, unknown>
) {
  const db = getServiceClient();
  await db.from("order_activity").insert({
    order_id: friendlyOrderId,
    company_id: PRINTOMS_COMPANY_ID,
    activity_type: "timeline",
    actor_name: "E2E Helper",
    actor_role: "System",
    content,
    metadata: metadata ?? {},
  });
}

async function queueNotification(
  templateKey: string,
  friendlyOrderId: string,
  phone = "919900000000"
) {
  const db = getServiceClient();
  const key = `e2e:${templateKey}:${friendlyOrderId}:${Date.now()}`;
  await db.from("notification_outbox").insert({
    company_id: PRINTOMS_COMPANY_ID,
    template_key: templateKey,
    recipient_phone: phone,
    order_id: friendlyOrderId,
    body_parameters: [],
    status: "skipped",
    error_message: "WhatsApp not configured (E2E)",
    idempotency_key: key,
  });
}

export async function setOrderStage(
  orderUuid: string,
  stage: string,
  stageStatus = "Normal"
) {
  const db = getServiceClient();
  const { data, error } = await db
    .from("orders")
    .update({
      stage,
      stage_status: stageStatus,
      stage_changed_at: new Date().toISOString(),
    })
    .eq("id", orderUuid)
    .select("*")
    .single();
  if (error) throw new Error(`setOrderStage: ${error.message}`);
  return data as OrderRef;
}

/**
 * Staff requests admin approval for the current stage gate.
 */
export async function requestStageAdvance(
  orderUuid: string,
  pendingStatus: string
) {
  const db = getServiceClient();
  const { data: order } = await db
    .from("orders")
    .select("order_id, stage")
    .eq("id", orderUuid)
    .single();

  await setOrderStage(orderUuid, order!.stage, pendingStatus);
  await logTimeline(
    order!.order_id,
    `Staff requested admin approval: ${pendingStatus}`,
    { action: "request_stage_advancement", pendingStatus }
  );
}

/**
 * Admin clears the gate and moves to the next pipeline stage.
 */
export async function adminApprove(
  orderUuid: string,
  nextStage: string
) {
  const db = getServiceClient();
  const { data: order } = await db
    .from("orders")
    .select("order_id")
    .eq("id", orderUuid)
    .single();

  await setOrderStage(orderUuid, nextStage, "Normal");
  await logTimeline(
    order!.order_id,
    `Admin approved stage advancement to ${nextStage}`,
    { action: "admin_approve_stage", nextStage }
  );
}

export async function setWorkflowType(
  orderUuid: string,
  workflowType: "quote_first" | "design_first"
) {
  const db = getServiceClient();
  const firstStage =
    workflowType === "design_first"
      ? "Design In Progress"
      : "Quotation In Progress";

  const { data: order } = await db
    .from("orders")
    .update({
      workflow_type: workflowType,
      stage: firstStage,
      stage_status: "Normal",
      stage_changed_at: new Date().toISOString(),
    })
    .eq("id", orderUuid)
    .select("order_id")
    .single();

  await logTimeline(
    order!.order_id,
    `Workflow path set to "${workflowType === "design_first" ? "Design First" : "Quote First"}". Order advanced to ${firstStage}.`,
    { action: "set_workflow_type", workflowType }
  );

  return firstStage;
}

/** Drive UI approve buttons when the worksheet is open. */
export async function uiRequestApproval(page: Page, name?: string | RegExp) {
  await page
    .getByRole("button", {
      name: name ?? /Request Admin Approval|Request Advance|Request Approval/i,
    })
    .first()
    .click();
  const confirm = page.getByRole("button", {
    name: /Confirm & Request Admin Approval|Submit Request|Confirm/i,
  });
  if (await confirm.first().isVisible({ timeout: 3_000 }).catch(() => false)) {
    await confirm.first().click();
  }
}

export async function uiAdminApprove(page: Page) {
  await page
    .getByRole("button", {
      name: /Approve & Advance|Approve Stage|Choose Workflow & Approve/i,
    })
    .first()
    .click();
}

/**
 * Seed a complete quote_first progression from Site Visit Pending → Completed,
 * creating child rows and timeline/notification evidence along the way.
 */
export async function advanceQuoteFirstPipeline(orderUuid: string) {
  const db = getServiceClient();
  const { data: order, error } = await db
    .from("orders")
    .select("*")
    .eq("id", orderUuid)
    .single();
  if (error || !order) throw new Error(error?.message || "Order not found");

  const friendly = order.order_id as string;
  const customerId = order.customer_id as string;

  // Site visit
  await setOrderStage(orderUuid, "Site Visit Scheduled");
  await logTimeline(friendly, "Site visit scheduled");
  await queueNotification("site_visit_scheduled", friendly);

  await db.from("site_visits").upsert(
    {
      order_id: orderUuid,
      company_id: PRINTOMS_COMPANY_ID,
      completed: true,
      review_status: "approved",
    },
    { onConflict: "order_id" }
  );

  await setOrderStage(orderUuid, "Site Visit Completed");
  await logTimeline(friendly, "Site visit completed");
  await queueNotification("site_visit_completed", friendly);

  await setWorkflowType(orderUuid, "quote_first");

  // Quotation
  const { data: quote, error: qErr } = await db
    .from("quotations")
    .insert({
      quotation_id: "",
      order_id: orderUuid,
      company_id: PRINTOMS_COMPANY_ID,
      customer_id: customerId,
      status: "Sent",
      subtotal: 50000,
      tax: 9000,
      grand_total: 59000,
      signage_options: [
        {
          name: "3D LED Channel Letters",
          qty: 1,
          rate: 50000,
          amount: 50000,
        },
      ],
      notes: "E2E seeded quotation",
      terms: "50% advance",
    })
    .select("*")
    .single();
  if (qErr) throw new Error(`quotation insert: ${qErr.message}`);

  await setOrderStage(orderUuid, "Quotation Sent");
  await logTimeline(friendly, "Quotation sent to customer");
  await queueNotification("quotation_ready", friendly);

  await db
    .from("quotations")
    .update({ status: "Approved", customer_response: "Approved" })
    .eq("id", quote!.id);

  await setOrderStage(orderUuid, "Quotation Approved");
  await logTimeline(friendly, "Customer approved quotation");

  // Design
  await setOrderStage(orderUuid, "Design In Progress");
  await queueNotification("design_ready_for_review", friendly);

  await db.from("designs").upsert(
    {
      order_id: orderUuid,
      resources: [],
      items: [
        {
          id: "v1",
          version: 1,
          status: "Approved",
          label: "Storefront fascia v1",
        },
      ],
    },
    { onConflict: "order_id" }
  );

  await setOrderStage(orderUuid, "Design Approved");
  await logTimeline(friendly, "Customer approved design");
  await queueNotification("design_approved", friendly);

  // Production
  await setOrderStage(orderUuid, "Production");
  await queueNotification("production_started", friendly);
  await db.from("productions").upsert(
    {
      order_id: orderUuid,
      stage1: true,
      stage2: true,
      stage3: true,
      stage4: true,
      checklist: {
        procurementOfMaterials: true,
        acpAndAcrylicCutting: true,
        lightingAndWiring: true,
        qualityCheck: true,
      },
    },
    { onConflict: "order_id" }
  );

  await setOrderStage(orderUuid, "Ready For Installation");
  await logTimeline(friendly, "Production complete — ready for installation");
  await queueNotification("ready_for_installation", friendly);

  // Installation
  await setOrderStage(orderUuid, "Installation Scheduled");
  await queueNotification("installation_scheduled", friendly);
  await db.from("installations").upsert(
    {
      order_id: orderUuid,
      status: "Completed",
      checklist: {},
      photos: [],
      afterPhotos: [],
    },
    { onConflict: "order_id" }
  );

  await setOrderStage(orderUuid, "Completed");
  await logTimeline(friendly, "Installation completed — order Completed");
  await queueNotification("installation_completed", friendly);

  return { friendly, quoteId: quote!.id, customerId };
}

/**
 * Create customer + order directly (skips the enquiry UI).
 *
 * Stage tests should seed to the stage under test, then drive only that
 * worksheet in the browser. Keep createOrderViaEnquiry for the enquiry
 * happy path in e2e/flows and e2e/enquiries.
 */
export async function createOrderDirect(
  customer: CustomerFixture
): Promise<OrderRef & { customerUuid: string; customerFriendlyId: string }> {
  const db = getServiceClient();

  const { data: cust, error: cErr } = await db
    .from("customers")
    .insert({
      company_id: PRINTOMS_COMPANY_ID,
      name: customer.businessName,
      phone: customer.phone,
      whatsapp: customer.whatsapp,
      email: customer.email,
      city: customer.city,
      billing_address: customer.location,
      shipping_address: customer.location,
    })
    .select("*")
    .single();
  if (cErr) throw new Error(`customer insert: ${cErr.message}`);

  const { data: order, error: oErr } = await db
    .from("orders")
    .insert({
      company_id: PRINTOMS_COMPANY_ID,
      customer_id: cust!.id,
      client_name: customer.name,
      business_name: customer.businessName,
      stage: "Site Visit Pending",
      stage_status: "Normal",
      health: "Active",
      product_type: customer.productType,
      requirements: `E2E order for ${customer.businessName}`,
      workflow_type: "quote_first",
    })
    .select("*")
    .single();
  if (oErr) throw new Error(`order insert: ${oErr.message}`);

  await db.from("designs").insert({
    order_id: order!.id,
    resources: [],
    items: [],
  });

  await logTimeline(
    order!.order_id,
    `Order created for ${customer.businessName}`,
    { action: "order_created", method: "e2e_direct" }
  );
  await queueNotification("order_created", order!.order_id, customer.phone);

  return {
    id: order!.id,
    order_id: order!.order_id,
    customer_id: cust!.id,
    stage: order!.stage,
    stage_status: order!.stage_status,
    customerUuid: cust!.id,
    customerFriendlyId: cust!.customer_id,
  };
}

/**
 * Seed to "Quotation In Progress" with a completed site visit + one
 * measurement line so the Quote worksheet has a row to fill.
 */
export async function seedOrderAtQuotationInProgress(
  customer: CustomerFixture
): Promise<OrderRef & { customerUuid: string; customerFriendlyId: string }> {
  const base = await createOrderDirect(customer);
  const db = getServiceClient();
  const orderUuid = base.id;

  await setOrderStage(orderUuid, "Site Visit Scheduled");
  const { data: sv, error: svErr } = await db
    .from("site_visits")
    .upsert(
      {
        order_id: orderUuid,
        company_id: PRINTOMS_COMPANY_ID,
        completed: true,
        review_status: "approved",
        customer_address: customer.location,
      },
      { onConflict: "order_id" }
    )
    .select("id")
    .single();
  if (svErr) throw new Error(`site_visits upsert: ${svErr.message}`);

  await db.from("site_visit_measurements").insert({
    site_visit_id: sv!.id,
    name: "Item-1",
    width: 12,
    height: 4,
    width_unit: "ft",
    height_unit: "ft",
  });

  await setOrderStage(orderUuid, "Site Visit Completed");
  await setWorkflowType(orderUuid, "quote_first");

  return {
    ...base,
    stage: "Quotation In Progress",
    stage_status: "Normal",
  };
}

/**
 * Seed a quote_first order directly to "Quotation Approved" with an approved
 * quotation row. Used by quotation-stage auto-approval tests.
 */
export async function seedOrderAtQuotationApproved(
  customer: CustomerFixture
): Promise<OrderRef & { customerUuid: string; customerFriendlyId: string }> {
  const base = await seedOrderAtQuotationInProgress(customer);
  const db = getServiceClient();
  const orderUuid = base.id;
  const friendly = base.order_id;
  const customerId = base.customer_id;

  // Quotation sent + approved
  const { data: quote, error: qErr } = await db
    .from("quotations")
    .insert({
      quotation_id: "",
      order_id: orderUuid,
      company_id: PRINTOMS_COMPANY_ID,
      customer_id: customerId,
      status: "Sent",
      subtotal: 50000,
      tax: 9000,
      grand_total: 59000,
      signage_options: [
        { name: "3D LED Channel Letters", qty: 1, rate: 50000, amount: 50000 },
      ],
      notes: "E2E seeded quotation",
      terms: "50% advance",
    })
    .select("*")
    .single();
  if (qErr) throw new Error(`quotation insert: ${qErr.message}`);

  await setOrderStage(orderUuid, "Quotation Sent");
  await db
    .from("quotations")
    .update({ status: "Approved", customer_response: "Approved" })
    .eq("id", quote!.id);
  await setOrderStage(orderUuid, "Quotation Approved");

  return {
    ...base,
    stage: "Quotation Approved",
    stage_status: "Normal",
  };
}

/**
 * Seed to "Design In Progress" with an approved quote and empty design items
 * so the Design worksheet can upload the first proof.
 */
export async function seedOrderAtDesignInProgress(
  customer: CustomerFixture
): Promise<OrderRef & { customerUuid: string; customerFriendlyId: string }> {
  const base = await seedOrderAtQuotationApproved(customer);
  await setOrderStage(base.id, "Design In Progress");
  return {
    ...base,
    stage: "Design In Progress",
    stage_status: "Normal",
  };
}

/**
 * Seed a quote_first order directly to "Design Approved" with an approved
 * design row (all items approved + production files). Used by design-stage
 * auto-approval tests.
 */
export async function seedOrderAtDesignApproved(
  customer: CustomerFixture
): Promise<OrderRef & { customerUuid: string; customerFriendlyId: string }> {
  const base = await seedOrderAtQuotationApproved(customer);
  const db = getServiceClient();
  const orderUuid = base.id;

  // Advance quotation → design
  await setOrderStage(orderUuid, "Design In Progress");

  await db.from("designs").upsert(
    {
      order_id: orderUuid,
      resources: [],
      items: [
        {
          id: "item-1",
          name: "Storefront fascia",
          currentVersion: 1,
          versions: [
            {
              id: "v1",
              version: 1,
              proofUrl: "https://example.com/proof.png",
              fileName: "proof.png",
              status: "Approved",
              comments: [],
              createdAt: new Date().toISOString(),
            },
          ],
          productionFiles: [
            { id: "pf1", name: "final.pdf", url: "https://example.com/final.pdf", createdAt: new Date().toISOString() },
          ],
          designFiles: [
            { id: "df1", name: "source.cdr", url: "https://example.com/source.cdr", createdAt: new Date().toISOString() },
          ],
          designFilesReady: true,
        },
      ],
    },
    { onConflict: "order_id" }
  );

  await setOrderStage(orderUuid, "Design Approved");

  return {
    ...base,
    stage: "Design Approved",
    stage_status: "Normal",
  };
}

/**
 * Seed a quote_first order directly to "Production" with a complete workshop
 * checklist. Used by production-stage auto-approval tests.
 */
export async function seedOrderAtProduction(
  customer: CustomerFixture,
  opts?: { checklistComplete?: boolean }
): Promise<OrderRef & { customerUuid: string; customerFriendlyId: string }> {
  const base = await seedOrderAtDesignApproved(customer);
  const db = getServiceClient();
  const orderUuid = base.id;
  const done = opts?.checklistComplete !== false;

  await setOrderStage(orderUuid, "Production");

  await db.from("productions").upsert(
    {
      order_id: orderUuid,
      stage1: done,
      stage2: done,
      stage3: done,
      stage4: done,
      checklist: {
        stage1: done,
        stage2: done,
        stage3: done,
        stage4: done,
      },
    },
    { onConflict: "order_id" }
  );

  return {
    ...base,
    stage: "Production",
    stage_status: "Normal",
  };
}

/**
 * Seed a quote_first order to "Ready For Installation" with the quotation
 * balance already received. Used by delivery-method chooser / pickup tests.
 */
export async function seedOrderAtReadyForInstallation(
  customer: CustomerFixture
): Promise<OrderRef & { customerUuid: string; customerFriendlyId: string }> {
  const base = await seedOrderAtProduction(customer);
  const db = getServiceClient();
  const orderUuid = base.id;

  await setOrderStage(orderUuid, "Ready For Installation");

  await db.from("payments").insert({
    order_id: orderUuid,
    payment_name: "Full payment",
    trigger_stage: "Order Created",
    amount_type: "fixed",
    amount: 59000,
    calculated_amount: 59000,
    status: "received",
    paid_at: new Date().toISOString(),
  });

  return {
    ...base,
    stage: "Ready For Installation",
    stage_status: "Normal",
  };
}

/**
 * Seed a quote_first order directly to "Installation Scheduled" with an
 * installations row and a received payment that zeroes the balance (so the
 * payment-balance gate on Completion passes). Used by installation-stage
 * auto-approval tests.
 */
export async function seedOrderAtInstallationScheduled(
  customer: CustomerFixture
): Promise<OrderRef & { customerUuid: string; customerFriendlyId: string }> {
  const base = await seedOrderAtProduction(customer);
  const db = getServiceClient();
  const orderUuid = base.id;

  await setOrderStage(orderUuid, "Ready For Installation");
  await setOrderStage(orderUuid, "Installation Scheduled");

  await db.from("installations").upsert(
    {
      order_id: orderUuid,
      status: "Scheduled",
      checklist: {},
      photos: [],
      afterPhotos: [],
    },
    { onConflict: "order_id" }
  );

  // Zero the payment balance so the Completion gate passes.
  await db.from("payments").insert({
    order_id: orderUuid,
    payment_name: "Full payment",
    trigger_stage: "Order Created",
    amount_type: "fixed",
    amount: 59000,
    calculated_amount: 59000,
    status: "received",
    paid_at: new Date().toISOString(),
  });

  return {
    ...base,
    stage: "Installation Scheduled",
    stage_status: "Normal",
  };
}
