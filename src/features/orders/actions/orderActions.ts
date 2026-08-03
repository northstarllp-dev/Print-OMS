"use server";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

import {
  mapSiteVisitFromDb,
  mapSiteVisitMeasurementFromDb,
  mapSiteVisitToDb,
} from "./siteVisitMapper";
import { mapDesignFromDb } from "@/features/designs/actions/designMapper";
import {
  dispatchWhatsAppNotification,
  dispatchWhatsAppForPipelineStage,
  notifyOrderStageChange,
} from "@/features/notifications/actions/dispatchNotification";
import {
  dispatchDirectNotification,
  dispatchAdminNotification,
} from "@/features/notifications/lib/dispatchNotification";
import { getRequestBaseUrl } from "@/features/notifications/whatsapp/requestBaseUrl";
import {
  assertAdminOnly,
  assertCanAssignOrderTeam,
  assertOrderUpdateAccess,
  assertStageEditPermission,
} from "@/features/orders/workspace/shared/serverPermissions";
import {
  revalidateOrderDetailPaths,
  revalidateStaffOrderDetailPaths,
} from "@/features/orders/actions/revalidateOrderPaths";
import { areAllDesignItemsApproved } from "@/features/designs/utils/designApproval";
import { createAdminClient } from "@/utils/supabase/admin";
import { getCurrentUser } from "@/features/auth/actions/authActions";
import { insertOrderActivity } from "@/features/orders/activity/logOrderActivity";

export { revalidateOrderDetailPaths, revalidateStaffOrderDetailPaths };

/** Design In Progress may only advance once artwork is customer-approved and production files exist. */
async function assertDesignReadyToLeaveInProgress(
  supabase: Awaited<ReturnType<typeof getSupabase>>,
  orderUuid: string
): Promise<void> {
  const { data: design, error } = await supabase
    .from("designs")
    .select("items")
    .eq("order_id", orderUuid)
    .maybeSingle();
  if (error) throw new Error(error.message);

  const items = (design?.items as any[]) || [];
  const allApproved = areAllDesignItemsApproved(items as any);
  const hasProductionFiles = items.some(
    (item: any) => Array.isArray(item.productionFiles) && item.productionFiles.length > 0
  );
  if (!allApproved || !hasProductionFiles) {
    throw new Error(
      "Cannot advance from Design In Progress until all design items are customer-approved and production files are uploaded."
    );
  }
}

async function getSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  );
}

export async function getOrders() {
  const supabase = await getSupabase();
  const { data, error } = await supabase.from("orders").select(`
    *,
    site_visits(
      *,
      site_visit_measurements(*)
    ),
    order_assignments(
      employee_id
    ),
    installations(*),
    productions(*),
    designs(*),
    quotations(grand_total, status),
    payments(amount, calculated_amount, status)
  `).order("date_created", { ascending: false });
  if (error) throw new Error(error.message);
  
  return data.map(order => {
    const sv = Array.isArray(order.site_visits)
      ? (order.site_visits.length > 0 ? order.site_visits[0] : null)
      : (order.site_visits || null);
    const assignedEmployees = (order.order_assignments || []).map((a: any) => a.employee_id);
    const designRow = Array.isArray(order.designs)
      ? (order.designs.length > 0 ? order.designs[0] : null)
      : (order.designs || null);
    return {
      ...order,
      assigned_employees: assignedEmployees,
      siteVisitDetails: mapSiteVisitFromDb(sv),
      design: designRow ? mapDesignFromDb(designRow) : null,
      installationDetails: Array.isArray(order.installations) ? order.installations[0] : order.installations,
      productionDetails: Array.isArray(order.productions) ? order.productions[0] : order.productions,
      quotations: order.quotations,
      payments: order.payments
    };
  });
}

export async function getOrderById(id: string) {
  const supabase = await getSupabase();
  
  // First try by UUID (id column)
  let { data, error } = await supabase.from("orders").select(`
    *,
    site_visits(
      *,
      site_visit_measurements(*)
    ),
    installations(*),
    productions(*),
    designs(*),
    quotations(grand_total, status),
    payments(amount, calculated_amount, status)
  `).eq("id", id).maybeSingle();
  
  // If not found, try by friendly order_id column
  if ((error || !data) && id) {
    const { data: dataByOrderId, error: errorByOrderId } = await supabase
      .from("orders")
      .select(`
        *,
        site_visits(
          *,
          site_visit_measurements(*)
        ),
        installations(*),
        productions(*),
        designs(*),
        quotations(grand_total, status),
        payments(amount, calculated_amount, status)
      `)
      .eq("order_id", id)
      .maybeSingle();
    
    if (!errorByOrderId && dataByOrderId) {
      data = dataByOrderId;
    }
  }
  
  if (!data) return null;

  const sv = Array.isArray(data.site_visits)
    ? (data.site_visits.length > 0 ? data.site_visits[0] : null)
    : (data.site_visits || null);
  
  const designRow = Array.isArray(data.designs)
    ? (data.designs.length > 0 ? data.designs[0] : null)
    : (data.designs || null);
  
  // Fetch assignments from new table
  const { data: assignData } = await supabase
    .from("order_assignments")
    .select("employee_id")
    .eq("order_id", data.id);
  const assignedEmployees = (assignData || []).map((a: any) => a.employee_id);
  
  return {
    ...data,
    assigned_employees: assignedEmployees,
    siteVisitDetails: mapSiteVisitFromDb(sv),
    design: designRow ? mapDesignFromDb(designRow) : null,
    installationDetails: Array.isArray(data.installations) && data.installations.length > 0 ? data.installations[0] : (data.installations || null),
    productionDetails: Array.isArray(data.productions) && data.productions.length > 0 ? data.productions[0] : (data.productions || null),
    quotations: data.quotations,
    payments: data.payments
  };
}

export async function createOrder(formData: any) {
  await assertAdminOnly();
  const supabase = await getSupabase();
  
  const { resolveWriteCompanyId } = await import("@/lib/resolveWriteCompanyId");
  const companyId = await resolveWriteCompanyId();

  const orderWithDefaults = {
    company_id: companyId,
    ...formData,
    health: formData.health || "Active",
  };

  const { data, error } = await supabase.from("orders").insert([orderWithDefaults]).select();
  if (error) throw new Error(error.message);
  
  const createdOrder = data[0];

  // Create an empty designs record for the new order
  await supabase.from("designs").insert({
    order_id: createdOrder.id,
    resources: [],
    items: [],
  });

  await insertOrderActivity(supabase, {
    order_id: createdOrder.order_id || createdOrder.id,
    company_id: createdOrder.company_id || companyId,
    actor_name: "System",
    actor_role: "System",
    content: `Order for Client "${createdOrder.client_name}" created manually by Admin.`,
    metadata: { action: "order_created", method: "manual" }
  });

  await revalidateStaffQueuePaths();
  return data;
}

// Helper to resolve either UUID id or friendly order_id to an actual UUID id
async function resolveOrderUuid(supabase: any, idOrOrderId: string): Promise<string> {
  // If it already looks like a UUID, use it directly
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidPattern.test(idOrOrderId)) return idOrOrderId;

  // Otherwise, look it up by friendly order_id
  const { data, error } = await supabase
    .from("orders")
    .select("id")
    .eq("order_id", idOrOrderId)
    .maybeSingle();

  if (error || !data) {
    throw new Error(`Could not resolve order ID: ${idOrOrderId}`);
  }
  return data.id;
}

export async function updateOrder(id: string, updates: any) {
  await assertOrderUpdateAccess(updates ?? {});
  const supabase = await getSupabase();
  // Resolve UUID in case a friendly order_id was passed
  const orderUuid = await resolveOrderUuid(supabase, id);

  const { stageProgressPatch } = await import("@/features/orders/lib/orderHealth");
  let patch = { ...updates };
  if (updates.stage !== undefined) {
    const { data: current } = await supabase
      .from("orders")
      .select("stage, health")
      .eq("id", orderUuid)
      .maybeSingle();
    if (current && current.stage !== updates.stage) {
      patch = { ...patch, ...stageProgressPatch(current.health) };
    }
  }

  const { data, error } = await supabase.from("orders").update(patch).eq("id", orderUuid).select();
  if (error) throw new Error(error.message);
  if (data && data.length > 0) {
    const orderIdFriendly = data[0].order_id || id;
    const updateKeys = Object.keys(updates);
    // Status-only patches (staff request approval) don't need every floor/portal path.
    const statusOnly =
      updateKeys.length > 0 &&
      updateKeys.every((k) => k === "stage_status" || k === "stage_admin_notes");
    if (statusOnly) {
      revalidatePath("/admin/orders");
      revalidatePath("/admin/dashboard");
      revalidatePath("/staff/orders");
      revalidateOrderDetailPaths(orderIdFriendly);
      revalidateOrderDetailPaths(orderUuid);
    } else {
      await revalidateStaffQueuePaths();
      revalidateOrderDetailPaths(orderIdFriendly);
      revalidateOrderDetailPaths(orderUuid);
      revalidatePath("/printoms/portal");
    }
  }
  return data;
}

export async function deleteOrder(id: string) {
  await assertAdminOnly();
  const supabase = await getSupabase();
  const { data: o } = await supabase.from("orders").select("order_id").eq("id", id).single();
  const { error } = await supabase.from("orders").delete().eq("id", id);
  if (error) throw new Error(error.message);
  await revalidateStaffQueuePaths();
  if (o) {
    revalidatePath(`/admin/orders/${o.order_id}`);
    revalidatePath(`/staff/orders/${o.order_id}`);
  }
}

export async function updateSiteVisitDetailsAction(orderId: string, details: any) {
  await assertStageEditPermission("site_visit");
  const supabase = await getSupabase();
  const orderUuid = await resolveOrderUuid(supabase, orderId);

  // 1. Get company ID and order_id
  const { data: order } = await supabase.from("orders").select("company_id, order_id").eq("id", orderUuid).single();
  if (!order?.company_id) {
    throw new Error("Order is missing company_id — cannot save site visit.");
  }
  const companyId = order.company_id;

  // 2. Map payload to DB schema
  const dbPayload = mapSiteVisitToDb(orderUuid, companyId, details);
  console.log("Saving site visit details payload photo_categories:", JSON.stringify(dbPayload.photo_categories));

  // 3. Upsert into site_visits
  const { data: siteVisit, error: svError } = await supabase
    .from("site_visits")
    .upsert(dbPayload, { onConflict: "order_id" })
    .select()
    .single();

  if (svError) throw new Error(svError.message);

  // 4. Update measurements if provided
  let savedLocations =
    (details.locations && Array.isArray(details.locations)
      ? details.locations.map((loc: any) => mapSiteVisitMeasurementFromDb(loc))
      : null) as ReturnType<typeof mapSiteVisitMeasurementFromDb>[] | null;

  if (details.locations && Array.isArray(details.locations)) {
    const isUuid = (id: unknown): id is string =>
      typeof id === "string" &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

    const keepIds = details.locations.map((l: any) => l.id).filter(isUuid);

    // Delete measurements for this site visit that are no longer in the payload
    if (keepIds.length > 0) {
      const { error: delError } = await supabase
        .from("site_visit_measurements")
        .delete()
        .eq("site_visit_id", siteVisit.id)
        .not("id", "in", `(${keepIds.join(",")})`);
      if (delError) throw new Error(`Failed to remove old signage items: ${delError.message}`);
    } else {
      const { error: delAllError } = await supabase
        .from("site_visit_measurements")
        .delete()
        .eq("site_visit_id", siteVisit.id);
      if (delAllError) throw new Error(`Failed to clear signage items: ${delAllError.message}`);
    }

    if (details.locations.length > 0) {
      const locationsPayload = details.locations.map((loc: any) => ({
        ...(isUuid(loc.id) ? { id: loc.id } : {}),
        site_visit_id: siteVisit.id,
        name: loc.name || "Unknown",
        width: loc.width ?? null,
        width_unit: loc.widthUnit || "ft",
        height: loc.height ?? null,
        height_unit: loc.heightUnit || "ft",
        depth: loc.depth ?? null,
        depth_unit: loc.depthUnit || "ft",
        ground_clearance: loc.groundClearance ?? null,
        ground_clearance_unit: loc.groundClearanceUnit || "ft",
        notes: loc.notes ?? null,
        photos: loc.photos || [],
        power_available: loc.powerAvailable ?? false,
        distance_to_power_source: loc.distanceToPowerSource ?? null,
        distance_to_power_source_unit: loc.distanceToPowerSourceUnit ?? null,
        electrical_notes: loc.electricalNotes || "",
        wall_type: loc.wallType || "",
        mounting_method: loc.mountingMethod ?? null,
        surface_condition: loc.surfaceCondition ?? null,
        obstacles: loc.obstacles || [],
        structural_notes: loc.structuralNotes ?? null,
      }));

      const { data: upserted, error: locError } = await supabase
        .from("site_visit_measurements")
        .upsert(locationsPayload, { onConflict: "id" })
        .select("*");

      if (locError) throw new Error(`Failed to save signage items: ${locError.message}`);
      if (!upserted || upserted.length !== locationsPayload.length) {
        throw new Error(
          `Failed to save all signage items (saved ${upserted?.length ?? 0} of ${locationsPayload.length}).`
        );
      }
      savedLocations = upserted.map((row) => mapSiteVisitMeasurementFromDb(row));
    } else {
      savedLocations = [];
    }
  }

  // Revalidate this order only — queues refresh when stage/status changes.
  const orderCode = order?.order_id;
  revalidateOrderDetailPaths(orderId);
  if (orderCode && orderCode !== orderId) {
    revalidateOrderDetailPaths(orderCode);
  }

  const mappedVisit = mapSiteVisitFromDb(siteVisit);
  return {
    success: true,
    siteVisitDetails: {
      ...(mappedVisit || { completed: false }),
      id: siteVisit.id,
      ...(savedLocations ? { locations: savedLocations } : {}),
    },
  };
}



export async function updateProductionDetailsAction(orderId: string, details: any) {
  await assertStageEditPermission("production");
  const supabase = await getSupabase();
  const orderUuid = await resolveOrderUuid(supabase, orderId);

  // Check if a production row exists
  const { data: current, error: fetchError } = await supabase.from("productions").select("*").eq("order_id", orderUuid).maybeSingle();
  
  if (current) {
    const { error: updateError } = await supabase.from("productions").update(details).eq("order_id", orderUuid);
    if (updateError) throw new Error(updateError.message);
  } else {
    const { error: insertError } = await supabase.from("productions").insert({ order_id: orderUuid, ...details });
    if (insertError) throw new Error(insertError.message);
  }
  
  // Client owns checklist UI — only refresh this order's detail pages.
  revalidateOrderDetailPaths(orderId);
  revalidateOrderDetailPaths(orderUuid);

  return { success: true };
}

export async function updateInstallationDetailsAction(orderId: string, details: any) {
  await assertStageEditPermission("installation");
  const supabase = await getSupabase();
  const orderUuid = await resolveOrderUuid(supabase, orderId);

  // Check if an installation row exists
  const { data: current, error: fetchError } = await supabase.from("installations").select("*").eq("order_id", orderUuid).maybeSingle();
  
  if (current) {
    const { error: updateError } = await supabase.from("installations").update(details).eq("order_id", orderUuid);
    if (updateError) throw new Error(updateError.message);
  } else {
    const { error: insertError } = await supabase.from("installations").insert({ order_id: orderUuid, ...details });
    if (insertError) throw new Error(insertError.message);
  }
  
  revalidateOrderDetailPaths(orderId);
  revalidateOrderDetailPaths(orderUuid);

  return { success: true };
}

export async function requestStageAdvancementAction(orderId: string) {
  const supabase = await getSupabase();
  const orderUuid = await resolveOrderUuid(supabase, orderId);
  const { data: current, error: fetchError } = await supabase
    .from("orders")
    .select("stage, workflow_type")
    .eq("id", orderUuid)
    .single();
  if (fetchError) throw new Error(fetchError.message);

  const isDesignFirst = (current.workflow_type || "quote_first") === "design_first";
  // Permission is for the stage being advanced FROM — not the destination stage.
  const stageToPermission: Record<string, "site_visit" | "quotation" | "design" | "production" | "installation"> = {
    "Site Visit Pending": "site_visit",
    "Site Visit Scheduled": "site_visit",
    "Site Visit Completed": "site_visit",
    "Quotation In Progress": "quotation",
    "Quotation Sent": "quotation",
    "Quotation Negotiation": "quotation",
    "Quotation Approved": "quotation",
    "Design In Progress": "design",
    "Design Approved": "design",
    "Production": "production",
    "Ready For Installation": "installation",
    "Installation Scheduled": "installation",
    "Completed": "installation",
    "Closed": "installation",
  };
  const requiredStage = stageToPermission[current.stage];
  if (!requiredStage) {
    throw new Error(`Unsupported stage transition request from "${current.stage}"`);
  }
  await assertStageEditPermission(requiredStage);

  let nextStatus = "Normal";
  const stage = current.stage;
  
  if (stage === "Site Visit Pending" || stage === "Site Visit Scheduled") {
    nextStatus = "Pending Admin Approval: Site Visit Completed";
  } else if (stage === "Site Visit Completed") {
    nextStatus = isDesignFirst
      ? "Pending Admin Approval: Design Stage"
      : "Pending Admin Approval: Quote Stage";
  } else if (stage === "Quotation In Progress" || stage === "Quotation Sent" || stage === "Quotation Negotiation") {
    nextStatus = "Pending Admin Approval: Quote Approval";
  } else if (stage === "Quotation Approved") {
    nextStatus = isDesignFirst
      ? "Pending Admin Approval: Production Ready"
      : "Pending Admin Approval: Design Stage";
  } else if (stage === "Design In Progress") {
    await assertDesignReadyToLeaveInProgress(supabase, orderUuid);
    nextStatus = "Pending Admin Approval: Design Approval";
  } else if (stage === "Design Approved") {
    nextStatus = isDesignFirst
      ? "Pending Admin Approval: Quote Stage"
      : "Pending Admin Approval: Production Ready";
  } else if (stage === "Production") {
    nextStatus = "Pending Admin Approval: Production Ready";
  } else if (stage === "Ready For Installation") {
    throw new Error(
      "Schedule the installation first. Job-done approval is only available after the order is Installation Scheduled."
    );
  } else if (stage === "Installation Scheduled") {
    nextStatus = "Pending Admin Approval: Job Done";
  }
  
  const result = await updateOrder(orderId, { stage_status: nextStatus, stage_admin_notes: "" });

  // Notify all admins that stage advancement has been requested
  const { data: reqOrder } = await supabase
    .from("orders")
    .select("order_id, company_id")
    .eq("id", orderUuid)
    .single();
  if (reqOrder?.company_id) {
    await insertOrderActivity(supabase, {
      order_id: reqOrder.order_id || orderId,
      company_id: reqOrder.company_id,
      actor_name: "System",
      actor_role: "System",
      content: `Stage advancement requested from "${current.stage}" (${nextStatus}).`,
      metadata: {
        action: "stage_advancement_requested",
        from_stage: current.stage,
        stage_status: nextStatus,
      },
    });
    await dispatchAdminNotification(reqOrder.company_id, {
      title: `Stage Approval Requested`,
      message: `Order ${reqOrder.order_id} needs your approval to advance from "${current.stage}".`,
      type: "warning",
      link: `/admin/orders/${reqOrder.order_id}`,
    });
  }

  return result;
}

export async function adminApproveStageAction(orderId: string) {
  await assertAdminOnly();
  const supabase = await getSupabase();
  const orderUuid = await resolveOrderUuid(supabase, orderId);
  const { data: o, error: fetchError } = await supabase
    .from("orders")
    .select("stage, order_id, workflow_type, stage_status, company_id")
    .eq("id", orderUuid)
    .single();
  if (fetchError) throw new Error(fetchError.message);

  const midQuotationStages = new Set([
    "Quotation In Progress",
    "Quotation Sent",
    "Quotation Negotiation",
  ]);
  if (midQuotationStages.has(o.stage)) {
    throw new Error(
      `Cannot advance from "${o.stage}" via generic stage approval. Use Send to Customer or the quotation workflow actions in the Quotation tab.`
    );
  }
  if (o.stage === "Site Visit Completed") {
    throw new Error(
      "Cannot advance from Site Visit Completed via generic stage approval. Choose workflow (Quote First or Design First) from Site Visit review."
    );
  }

  const isDesignFirst = (o.workflow_type || "quote_first") === "design_first";
  const isJobDonePending = o.stage_status === "Pending Admin Approval: Job Done";

  // Build the next-stage map dynamically based on workflow type
  const nextStageMap: Record<string, string> = isDesignFirst
    ? {
        "Site Visit Pending":     "Site Visit Scheduled",
        "Site Visit Scheduled":   "Design In Progress",
        "Site Visit Completed":   "Design In Progress",
        "Design In Progress":     "Design Approved",
        "Design Approved":        "Quotation In Progress",
        "Quotation In Progress":  "Quotation Sent",
        "Quotation Sent":         "Quotation Negotiation",
        "Quotation Negotiation":  "Quotation Approved",
        "Quotation Approved":     "Production",
        "Production":             "Ready For Installation",
        "Ready For Installation": "Installation Scheduled",
        "Installation Scheduled": "Completed",
        "Completed":              "Closed",
      }
    : {
        "Site Visit Pending":     "Site Visit Scheduled",
        "Site Visit Scheduled":   "Quotation In Progress",
        "Site Visit Completed":   "Quotation In Progress",
        "Quotation In Progress":  "Quotation Sent",
        "Quotation Sent":         "Quotation Negotiation",
        "Quotation Negotiation":  "Quotation Approved",
        "Quotation Approved":     "Design In Progress",
        "Design In Progress":     "Design Approved",
        "Design Approved":        "Production",
        "Production":             "Ready For Installation",
        "Ready For Installation": "Installation Scheduled",
        "Installation Scheduled": "Completed",
        "Completed":              "Closed",
      };

  // Job Done always completes the order (payment review happens in the UI before this action).
  const nextStage = isJobDonePending ? "Completed" : (nextStageMap[o.stage] || o.stage);
  if (!isJobDonePending && nextStage === o.stage) {
    throw new Error(
      `No next stage configured for "${o.stage}". Cannot approve advancement.`
    );
  }
  if (o.stage === "Design In Progress" && nextStage === "Design Approved") {
    await assertDesignReadyToLeaveInProgress(supabase, orderUuid);
  }

  // Hard gate: never close/complete while quote balance is still outstanding.
  if (nextStage === "Completed") {
    const { getPaymentBalanceSummary } = await import(
      "@/features/payments/actions/paymentActions"
    );
    const balance = await getPaymentBalanceSummary(orderUuid);
    if (balance.outstanding > 0) {
      throw new Error(
        `Cannot complete order: ₹${balance.outstanding.toLocaleString("en-IN")} is still outstanding. Confirm all payments first.`
      );
    }
  }

  const logMsg = isJobDonePending
    ? `Admin reviewed payments and marked the order Completed (from "${o.stage}").`
    : `Admin approved stage progression from "${o.stage}" to "${nextStage}".`;

  const result = await updateOrder(orderUuid, {
    stage: nextStage,
    stage_status: "Normal",
    stage_admin_notes: "",
  });

  await insertOrderActivity(supabase, {
    order_id: o.order_id || orderId,
    company_id: o.company_id,
    actor_name: "System",
    actor_role: "System",
    content: logMsg,
    metadata: { action: "stage_approved", old: o.stage, new: nextStage }
  });

  // Don't block the admin UI on WhatsApp delivery.
  if (nextStage !== o.stage) {
    void dispatchWhatsAppForPipelineStage(supabase, orderUuid, nextStage).catch((err) =>
      console.error("WhatsApp pipeline notify failed:", err)
    );
    // Notify relevant staff that stage was approved and advanced
    void notifyOrderStageChange(supabase, orderUuid, nextStage, o.stage).catch((err) =>
      console.error("Stage change notify failed:", err)
    );
  }

  return result;
}

export async function adminRejectStageAction(orderId: string, notes: string) {
  await assertAdminOnly();
  const trimmed = notes.trim();
  if (!trimmed) {
    throw new Error("Notes are required when requesting changes.");
  }

  const supabase = await getSupabase();
  const orderUuid = await resolveOrderUuid(supabase, orderId);
  const { data: o, error: fetchError } = await supabase
    .from("orders")
    .select("stage, order_id, stage_status, company_id")
    .eq("id", orderUuid)
    .single();
  if (fetchError) throw new Error(fetchError.message);

  if (!o.stage_status || o.stage_status === "Normal") {
    throw new Error("No pending admin approval to reject.");
  }

  const result = await updateOrder(orderUuid, {
    stage_status: "Normal",
    stage_admin_notes: trimmed,
  });

  // If rejecting job-done, reopen the installation work package for staff edits.
  if (o.stage_status === "Pending Admin Approval: Job Done") {
    await supabase
      .from("installations")
      .update({ status: "Pending" })
      .eq("order_id", orderUuid);
  }

  await insertOrderActivity(supabase, {
    order_id: o.order_id || orderId,
    company_id: o.company_id,
    actor_name: "Admin",
    actor_role: "Admin",
    content: `Admin requested changes at "${o.stage}": ${trimmed}`,
    metadata: { action: "stage_rejected", stage: o.stage, notes: trimmed },
  });

  // Notify relevant staff that changes were requested (rejection)
  await dispatchAdminNotification(o.company_id, {
    title: `Changes Requested on Order ${o.order_id || orderId}`,
    message: `Admin has requested changes at "${o.stage}": ${trimmed.slice(0, 80)}`,
    type: "warning",
    link: `/admin/orders/${o.order_id || orderId}`,
  });

  return result;
}

/**
 * Called when Admin chooses a workflow path after approving Site Visit.
 * Persists the workflow_type and advances the stage to the first post-site-visit step.
 */
export async function setWorkflowTypeAction(
  orderId: string,
  workflowType: "quote_first" | "design_first"
) {
  await assertAdminOnly();
  const {
    buildWorkflowChoiceActivity,
    buildWorkflowChoiceUpdate,
    isValidWorkflowType,
    resolveConcurrentWorkflowChoice,
  } = await import("@/features/orders/workflowSelectionLogic");

  if (!isValidWorkflowType(workflowType)) {
    throw new Error("Invalid workflow type.");
  }

  const supabase = await getSupabase();
  const orderUuid = await resolveOrderUuid(supabase, orderId);
  const { data: o, error: fetchError } = await supabase
    .from("orders")
    .select("order_id, stage, company_id, workflow_type")
    .eq("id", orderUuid)
    .single();
  if (fetchError) throw new Error(fetchError.message);

  // Orders default to quote_first in DB — only treat as conflict once stage has left Site Visit.
  if (!(o.stage || "").startsWith("Site Visit")) {
    const conflict = resolveConcurrentWorkflowChoice({
      attempted: workflowType,
      existing: o.workflow_type,
    });
    throw new Error(
      conflict.reason || "Workflow already selected for this order."
    );
  }

  const updates = buildWorkflowChoiceUpdate(workflowType);
  const result = await updateOrder(orderUuid, updates);

  const activity = buildWorkflowChoiceActivity(workflowType);
  await insertOrderActivity(supabase, {
    order_id: o.order_id || orderId,
    company_id: o.company_id,
    actor_name: "System",
    actor_role: "System",
    content: activity.content,
    metadata: activity.metadata,
  });

  await dispatchWhatsAppForPipelineStage(supabase, orderUuid, updates.stage);

  return result;
}


export async function updateOrderStageAction(id: string, stage: string) {
  await assertAdminOnly();
  const supabase = await getSupabase();
  const orderUuid = await resolveOrderUuid(supabase, id);
  const { data: o, error: fetchError } = await supabase
    .from("orders")
    .select("stage, order_id, company_id")
    .eq("id", orderUuid)
    .single();
  if (fetchError) throw new Error(fetchError.message);

  // Hard gate: cannot manually close an order while balance is outstanding.
  if (stage === "Completed" && stage !== o.stage) {
    const { getPaymentBalanceSummary } = await import(
      "@/features/payments/actions/paymentActions"
    );
    const balance = await getPaymentBalanceSummary(orderUuid);
    if (balance.outstanding > 0) {
      throw new Error(
        `Cannot complete order: ₹${balance.outstanding.toLocaleString("en-IN")} is still outstanding. Confirm all payments first.`
      );
    }
  }

  const isChanged = stage !== o.stage;
  const result = await updateOrder(orderUuid, { stage });

  if (isChanged) {
    await insertOrderActivity(supabase, {
      order_id: o.order_id || id,
      company_id: o.company_id,
      actor_name: "System",
      actor_role: "System",
      content: `Order stage manually changed from "${o.stage}" to "${stage}".`,
      metadata: { action: "stage_changed", old: o.stage, new: stage }
    });
    await notifyOrderStageChange(supabase, orderUuid, stage, o.stage);
  }

  return result;
}

export async function addChatMessageAction(orderId: string, sender: string, message: string) {
  const supabase = await getSupabase();
  const { data: o, error: fetchError } = await supabase
    .from("orders")
    .select("order_id, company_id")
    .eq("id", orderId)
    .single();
  if (fetchError) throw new Error(fetchError.message);

  // Timeline-only — internal/customer chat was removed.
  await insertOrderActivity(supabase, {
    order_id: o.order_id || orderId,
    company_id: o.company_id,
    actor_name: sender,
    actor_role: sender === "System" ? "System" : sender === "Admin" ? "Admin" : "Employee",
    content: message
  });
}

export async function assignEmployeesToOrderAction(orderId: string, employeeIds: string[]) {
  return await assignTeamToOrder(orderId, employeeIds);
}

/**
 * Server action for portal client mutations. Scoped to the affected order —
 * does not invalidate every staff queue page.
 */
export async function revalidateOrderPathsAction(orderId?: string) {
  if (!orderId) return;
  const supabase = await getSupabase();
  const orderUuid = await resolveOrderUuid(supabase, orderId);
  const { data } = await supabase
    .from("orders")
    .select("order_id, company_id")
    .eq("id", orderUuid)
    .maybeSingle();
  revalidateOrderDetailPaths(data?.order_id || orderId);
}

/** Invalidate all staff/floor queue pages after assignment or order creation. */
export async function revalidateStaffQueuePaths() {
  revalidatePath("/admin/orders");
  revalidatePath("/admin/dashboard");
  revalidatePath("/staff/my-orders");
  revalidatePath("/staff/orders");
  revalidatePath("/staff/site-visit");
  revalidatePath("/staff/design");
  revalidatePath("/staff/production");
  revalidatePath("/staff/installation");
  revalidatePath("/staff");
  revalidatePath("/production/orders");
  revalidatePath("/installation/orders");
  revalidatePath("/installation/site-visit");
}

export async function fetchEmployeeStats() {
  const supabase = await getSupabase();
  
  const { data: staff, error: staffError } = await supabase
    .from("users")
    .select("id, name, email, staff_role")
    .eq("role", "staff")
    .order("name");
  if (staffError) throw new Error(staffError.message);

  // Load active assignments from order_assignments joined to active orders
  const { data: assignments, error: assignError } = await supabase
    .from("order_assignments")
    .select("employee_id, orders!inner(id, client_name, business_name, stage)")
    .neq("orders.stage", "Completed")
    .neq("orders.stage", "Closed");
  if (assignError) throw new Error(assignError.message);

  const stats = (staff || []).map(emp => {
    const myAssignments = (assignments || []).filter(a => a.employee_id === emp.id);
    return {
      id: emp.id,
      name: emp.name,
      staff_role: emp.staff_role,
      activeJobs: myAssignments.length,
      jobTitles: myAssignments.map(a => {
        const ord = (a.orders as any);
        return ord ? `${ord.business_name || ""} - ${ord.client_name || ""}`.trim() : "";
      }).filter(Boolean)
    };
  });
  
  return stats;
}

export async function assignTeamToOrder(orderId: string, employeeIds: string[]) {
  await assertCanAssignOrderTeam();
  const supabase = await getSupabase();

  // Resolve UUID in case a friendly order_id was passed
  const orderUuid = await resolveOrderUuid(supabase, orderId);

  const { data: o } = await supabase.from("orders").select("order_id, company_id").eq("id", orderUuid).single();
  if (!o?.company_id) throw new Error("company_id is required to log team assignment");

  // Delete existing assignments for this order, then insert new ones
  await supabase.from("order_assignments").delete().eq("order_id", orderUuid);
  
  if (employeeIds.length > 0) {
    const rows = employeeIds.map(eid => ({ order_id: orderUuid, employee_id: eid }));
    const { error: insertError } = await supabase.from("order_assignments").insert(rows);
    if (insertError) throw new Error(insertError.message);
  }

  await insertOrderActivity(supabase, {
    order_id: o.order_id || orderId,
    company_id: o.company_id,
    actor_name: "System",
    actor_role: "System",
    content: `Team assigned: ${employeeIds.length} employee(s) allocated to this order.`,
    metadata: { action: "team_assigned", count: employeeIds.length }
  });

  // Notify each assigned employee directly
  if (employeeIds.length > 0) {
    const { data: employees } = await supabase
      .from("users")
      .select("id, name")
      .in("id", employeeIds);
    for (const emp of employees || []) {
      await dispatchDirectNotification(
        emp.id,
        o.company_id,
        {
          title: `You've been assigned to Order ${o.order_id || orderId}`,
          message: `You have been added to the team for this order.`,
          type: "info",
          link: `/staff/orders/${o.order_id || orderUuid}`,
        }
      );
    }
  }

  await revalidateStaffQueuePaths();
  if (o?.order_id) {
    revalidatePath(`/admin/orders/${o.order_id}`);
    revalidatePath(`/staff/orders/${o.order_id}`);
  }
  revalidatePath(`/admin/orders/${orderUuid}`);
  revalidatePath(`/staff/orders/${orderUuid}`);
  return { success: true };
}

export async function updateOrderHealthAction(
  orderId: string,
  health: string,
  lostReason?: string,
  callRemarks?: string
) {
  await assertAdminOnly();
  const { isOrderHealth } = await import("@/features/orders/lib/orderHealth");
  if (!isOrderHealth(health)) {
    throw new Error("Invalid health. Use Active, Needs Attention, On Hold, or Lost.");
  }
  if (health === "Lost" && !lostReason?.trim()) {
    throw new Error("A reason is required when marking an order as Lost.");
  }

  const supabase = await getSupabase();
  const { data: o, error: fetchError } = await supabase
    .from("orders")
    .select("order_id, company_id")
    .eq("id", orderId)
    .single();
  if (fetchError) throw new Error(fetchError.message);

  const result = await updateOrder(orderId, {
    health,
    lost_reason: health === "Lost" ? lostReason!.trim() : null,
  });

  const remarks = callRemarks?.trim();
  if (remarks) {
    await insertOrderActivity(supabase, {
      order_id: o.order_id || orderId,
      company_id: o.company_id,
      actor_name: "System",
      actor_role: "System",
      content: `Admin call: ${remarks}`,
      metadata: { action: "call_remarks", health },
    });
  }

  await insertOrderActivity(supabase, {
    order_id: o.order_id || orderId,
    company_id: o.company_id,
    actor_name: "System",
    actor_role: "System",
    content: `Order health status updated to "${health}"${
      health === "Lost" && lostReason?.trim() ? ` with reason: "${lostReason.trim()}"` : ""
    }.`,
    metadata: {
      action: "health_changed",
      health,
      lost_reason: health === "Lost" ? lostReason!.trim() : null,
    },
  });

  return result;
}

/** Mark Active orders stalled past the slug threshold as Needs Attention. Idempotent. */
export async function flagStalledOrdersAction(): Promise<{ flagged: number }> {
  const { loadClientConfig, getDeployCompanyId } = await import("@/config/loadClientConfig");
  const config = loadClientConfig();
  const days = config.features.needsAttentionAfterDays ?? 6;
  const companyId = getDeployCompanyId();

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffIso = cutoff.toISOString();

  const supabase = await getSupabase();
  const { data: stalled, error } = await supabase
    .from("orders")
    .select("id, order_id, company_id")
    .eq("company_id", companyId)
    .eq("health", "Active")
    .not("stage", "in", '("Completed","Closed")')
    .lte("stage_changed_at", cutoffIso);

  if (error) throw new Error(error.message);
  if (!stalled || stalled.length === 0) return { flagged: 0 };

  const ids = stalled.map((o) => o.id);
  const { error: updateError } = await supabase
    .from("orders")
    .update({ health: "Needs Attention" })
    .in("id", ids);
  if (updateError) throw new Error(updateError.message);

  for (const o of stalled) {
    await insertOrderActivity(supabase, {
      order_id: o.order_id || o.id,
      company_id: o.company_id,
      actor_name: "System",
      actor_role: "System",
      content: `Order health set to "Needs Attention" — no stage progress for ${days}+ days.`,
      metadata: {
        action: "health_changed",
        health: "Needs Attention",
        reason: "stalled_stage",
        days,
      },
    });
  }

  return { flagged: stalled.length };
}

export async function reopenOrderAction(orderId: string) {
  await assertAdminOnly();
  const supabase = await getSupabase();
  const { data: o, error: fetchError } = await supabase
    .from("orders")
    .select("order_id, company_id")
    .eq("id", orderId)
    .single();
  if (fetchError) throw new Error(fetchError.message);

  const result = await updateOrder(orderId, { health: "Active", lost_reason: null });

  await insertOrderActivity(supabase, {
    order_id: o.order_id || orderId,
    company_id: o.company_id,
    actor_name: "System",
    actor_role: "System",
    content: `Order reopened. Health status set to "Active".`,
    metadata: { action: "order_reopened" }
  });

  return result;
}

function requireAdminClient() {
  const admin = createAdminClient();
  if (!admin) throw new Error("Server configuration error");
  return admin;
}

/** Portal session cookie, or raw magic-link token (schedule_visit scope). */
async function assertPortalCanScheduleVisit(
  orderUuid: string,
  portalToken?: string
): Promise<void> {
  const { assertPortalTenantAccess } = await import(
    "@/utils/portal/portalTenantAuth"
  );
  await assertPortalTenantAccess({
    orderId: orderUuid,
    portalToken,
    requiredScope: "schedule_visit",
  });
}

/**
 * Staff (cookie auth + RLS) or customer portal (token/session + service role).
 * Portal customers have no Supabase Auth session — anon RLS cannot update site_visits.
 */
export async function scheduleSiteVisitAction(
  orderId: string,
  scheduleData: any,
  portalToken?: string
) {
  const profile = await getCurrentUser();
  const admin = requireAdminClient();

  let supabase: Awaited<ReturnType<typeof getSupabase>>;
  let orderUuid: string;

  if (profile) {
    await assertStageEditPermission("site_visit");
    supabase = await getSupabase();
    orderUuid = await resolveOrderUuid(supabase, orderId);
  } else {
    orderUuid = await resolveOrderUuid(admin, orderId);
    await assertPortalCanScheduleVisit(orderUuid, portalToken);
    supabase = admin;
  }

  const { data: order, error: fetchError } = await supabase
    .from("orders")
    .select("company_id, order_id, customer_id, business_name, health, stage")
    .eq("id", orderUuid)
    .single();

  if (fetchError || !order) throw new Error(fetchError?.message || "Order not found");
  if (!order.company_id) {
    throw new Error("Order is missing company_id — cannot schedule site visit.");
  }

  // Never persist a pasted Maps URL — store resolved address + coordinates only.
  const { isGoogleMapsUrl, formatGpsCoords } = await import("@/components/maps/mapsUrl");
  let sanitizedSchedule = { ...scheduleData };
  if (
    isGoogleMapsUrl(String(scheduleData.customerAddress || "")) ||
    isGoogleMapsUrl(String(scheduleData.gpsLocation || ""))
  ) {
    const { resolveMapsUrlToLocation } = await import(
      "@/components/maps/resolveMapsUrlServer"
    );
    const link = isGoogleMapsUrl(String(scheduleData.customerAddress || ""))
      ? String(scheduleData.customerAddress)
      : String(scheduleData.gpsLocation);
    const resolved = await resolveMapsUrlToLocation(link);
    if (!resolved) {
      throw new Error(
        "Could not resolve that Google Maps link to an address and coordinates."
      );
    }
    sanitizedSchedule = {
      ...scheduleData,
      customerAddress: resolved.address,
      gpsLocation: formatGpsCoords(resolved.lat, resolved.lng),
    };
  }

  const { data: existingSv } = await supabase
    .from("site_visits")
    .select("*")
    .eq("order_id", orderUuid)
    .maybeSingle();
  const mappedExisting = mapSiteVisitFromDb(existingSv) || {};
  const updatedSiteVisit = {
    ...mappedExisting,
    ...sanitizedSchedule,
    completed: false,
    reviewStatus: "Pending" as const,
  };
  // Always use the order's tenant — never invent a default company id.
  const dbPayload = mapSiteVisitToDb(orderUuid, order.company_id, updatedSiteVisit);

  const { data: siteVisit, error: svError } = await supabase
    .from("site_visits")
    .upsert(dbPayload, { onConflict: "order_id" })
    .select()
    .single();
  if (svError) throw new Error(svError.message);

  const date = sanitizedSchedule.auditDate || sanitizedSchedule.preferredDate;
  const time = sanitizedSchedule.preferredTime || sanitizedSchedule.auditTime;

  const { stageProgressPatch } = await import("@/features/orders/lib/orderHealth");
  const stagePatch =
    order.stage === "Site Visit Scheduled"
      ? { stage_status: "Normal" as const }
      : { stage: "Site Visit Scheduled", stage_status: "Normal" as const, ...stageProgressPatch(order.health) };

  const { data: updatedOrderRow, error: updateError } = await supabase
    .from("orders")
    .update(stagePatch)
    .eq("id", orderUuid)
    .select()
    .single();
  if (updateError) throw new Error(updateError.message);

  await insertOrderActivity(supabase, {
    order_id: order.order_id || orderId,
    company_id: order.company_id,
    actor_name: "System",
    actor_role: "System",
    content: `📅 Site visit scheduled for ${date} at ${time} by client.`,
    metadata: {
      action: "site_visit_scheduled",
      date,
      time,
      address: sanitizedSchedule.customerAddress,
    },
  });

  const baseUrl = await getRequestBaseUrl();
  await dispatchWhatsAppNotification(supabase, {
    templateKey: "site_visit_scheduled",
    orderUuid,
    date: String(date),
    time: String(time),
    idempotencyKey: `site_visit_scheduled:${orderUuid}:${date}:${time}`,
    baseUrl,
  });

  await revalidateStaffQueuePaths();
  revalidatePath(`/admin/orders/${order.order_id || orderId}`);
  revalidatePath(`/staff/orders/${order.order_id || orderId}`);

  return {
    success: true,
    order: {
      id: updatedOrderRow.id,
      stage: updatedOrderRow.stage,
      stageStatus: updatedOrderRow.stage_status,
      siteVisitDetails: mapSiteVisitFromDb(siteVisit),
    },
  };
}

export async function approveSiteVisitAction(orderId: string) {
  await assertStageEditPermission("site_visit");
  const supabase = await getSupabase();
  const orderUuid = await resolveOrderUuid(supabase, orderId);
  
  const { data: order, error: fetchError } = await supabase
    .from("orders")
    .select("company_id, order_id, customer_id, health, stage")
    .eq("id", orderUuid)
    .single();
    
  if (fetchError || !order) throw new Error(fetchError?.message || "Order not found");

  const { data: existingSv } = await supabase.from("site_visits").select("*").eq("order_id", orderUuid).maybeSingle();
  const mappedExisting = mapSiteVisitFromDb(existingSv) || {};
  if (!order.company_id) {
    throw new Error("Order is missing company_id — cannot approve site visit.");
  }
  const companyId = order.company_id;
  const dbPayload = mapSiteVisitToDb(orderUuid, companyId, { ...mappedExisting, reviewStatus: "Staff Approved" as const });

  const { data: siteVisit, error: svError } = await supabase.from("site_visits").upsert(dbPayload, { onConflict: "order_id" }).select().single();
  if (svError) throw new Error(svError.message);

  const { stageProgressPatch } = await import("@/features/orders/lib/orderHealth");
  const approveStagePatch =
    order.stage === "Site Visit Scheduled"
      ? { stage_status: "Pending Admin Approval: Site Visit Schedule" as const }
      : {
          stage: "Site Visit Scheduled",
          stage_status: "Pending Admin Approval: Site Visit Schedule",
          ...stageProgressPatch(order.health),
        };

  const { data: updatedOrderRow, error: updateError } = await supabase
    .from("orders")
    .update(approveStagePatch)
    .eq("id", orderUuid)
    .select()
    .single();
  if (updateError) throw new Error(updateError.message);

  await insertOrderActivity(supabase, {
    order_id: order.order_id || orderId,
    company_id: order.company_id,
    actor_name: "System",
    actor_role: "System",
    content: `Site visit time approved by assigned staff. Pending Admin Approval.`,
    metadata: { action: "site_visit_staff_approved" }
  });

  await revalidateStaffQueuePaths();
  revalidatePath(`/admin/orders/${order.order_id || orderId}`);
  revalidatePath(`/staff/orders/${order.order_id || orderId}`);
  
  return { success: true, order: { ...updatedOrderRow, siteVisitDetails: mapSiteVisitFromDb(siteVisit) } };
}

/**
 * Freeze the site visit: marks completed=true on site_visits and sets
 * stage_status to "Pending Admin Approval: Site Visit Completed" so the
 * Admin sees it in AdminControlModule and can approve to advance the order.
 */
export async function freezeSiteVisitAction(orderId: string) {
  await assertStageEditPermission("site_visit");
  const supabase = await getSupabase();
  const orderUuid = await resolveOrderUuid(supabase, orderId);

  // 1. Mark the site_visit row as completed (frozen)
  const { error: svError } = await supabase
    .from("site_visits")
    .update({ completed: true })
    .eq("order_id", orderUuid);
  if (svError) throw new Error(svError.message);

  // 2. Fetch order for activity log
  const { data: order, error: fetchError } = await supabase
    .from("orders")
    .select("order_id, stage, company_id")
    .eq("id", orderUuid)
    .single();
  if (fetchError || !order) throw new Error(fetchError?.message || "Order not found");

  // 3. Flag the order as pending admin approval
  const { data: updatedOrder, error: orderError } = await supabase
    .from("orders")
    .update({ stage_status: "Pending Admin Approval: Site Visit Completed" })
    .eq("id", orderUuid)
    .select()
    .single();
  if (orderError) throw new Error(orderError.message);

  // 4. Activity log
  await insertOrderActivity(supabase, {
    order_id: order.order_id || orderId,
    company_id: order.company_id,
    actor_name: "System",
    actor_role: "System",
    content: "Site visit data confirmed and locked. Pending admin review.",
    metadata: { action: "site_visit_frozen" }
  });

  const baseUrl = await getRequestBaseUrl();
  await dispatchWhatsAppNotification(supabase, {
    templateKey: "site_visit_completed",
    orderUuid,
    idempotencyKey: `site_visit_completed:${orderUuid}`,
    baseUrl,
  });

  // 5. Revalidate all views
  await revalidateStaffQueuePaths();
  revalidatePath(`/admin/orders/${order.order_id || orderId}`);
  revalidatePath(`/staff/orders/${order.order_id || orderId}`);

  return { success: true, updatedOrder };
}
