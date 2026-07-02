"use server";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

import { mapSiteVisitFromDb, mapSiteVisitToDb } from "./siteVisitMapper";

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
    productions(*)
  `).order("date_created", { ascending: false });
  if (error) throw new Error(error.message);
  
  return data.map(order => {
    const sv = Array.isArray(order.site_visits)
      ? (order.site_visits.length > 0 ? order.site_visits[0] : null)
      : (order.site_visits || null);
    const assignedEmployees = (order.order_assignments || []).map((a: any) => a.employee_id);
    return {
      ...order,
      assigned_employees: assignedEmployees,
      siteVisitDetails: mapSiteVisitFromDb(sv),
      installationDetails: Array.isArray(order.installations) ? order.installations[0] : order.installations,
      productionDetails: Array.isArray(order.productions) ? order.productions[0] : order.productions
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
    productions(*)
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
        productions(*)
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
    installationDetails: Array.isArray(data.installations) ? data.installations[0] : data.installations,
    productionDetails: Array.isArray(data.productions) ? data.productions[0] : data.productions
  };
}

export async function createOrder(formData: any) {
  const supabase = await getSupabase();
  
  const { data: { user } } = await supabase.auth.getUser();
  let companyId = "11111111-1111-1111-1111-111111111111"; // default fallback
  if (user) {
    const { data: profile } = await supabase.from("users").select("company_id").eq("id", user.id).single();
    if (profile && profile.company_id) {
      companyId = profile.company_id;
    }
  }

  const orderWithDefaults = {
    company_id: companyId,
    ...formData,
    health: formData.health || "Active",
  };

  const { data, error } = await supabase.from("orders").insert([orderWithDefaults]).select();
  if (error) throw new Error(error.message);
  
  const createdOrder = data[0];
  await supabase.from("order_activity").insert({
    order_id: createdOrder.order_id || createdOrder.id,
    activity_type: "timeline",
    actor_name: "System",
    actor_role: "System",
    content: `Order "${createdOrder.project_name}" created manually by Admin.`,
    metadata: { action: "order_created", method: "manual" }
  });

  revalidatePath("/admin/orders");
  revalidatePath("/staff/orders");
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
  const supabase = await getSupabase();
  // Resolve UUID in case a friendly order_id was passed
  const orderUuid = await resolveOrderUuid(supabase, id);

  const { data, error } = await supabase.from("orders").update(updates).eq("id", orderUuid).select();
  if (error) throw new Error(error.message);
  if (data && data.length > 0) {
    const orderIdFriendly = data[0].order_id || id;
    revalidatePath("/admin/orders");
    revalidatePath(`/admin/orders/${orderIdFriendly}`);
    revalidatePath(`/admin/orders/${orderUuid}`);
    revalidatePath("/staff/orders");
    revalidatePath(`/staff/orders/${orderIdFriendly}`);
    revalidatePath(`/staff/orders/${orderUuid}`);
    revalidatePath("/portal");
    revalidatePath(`/portal/${orderIdFriendly}`);
    revalidatePath(`/portal/${orderUuid}`);
  }
  return data;
}

export async function deleteOrder(id: string) {
  const supabase = await getSupabase();
  const { data: o } = await supabase.from("orders").select("order_id").eq("id", id).single();
  const { error } = await supabase.from("orders").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/orders");
  revalidatePath("/staff/orders");
  if (o) {
    revalidatePath(`/admin/orders/${o.order_id}`);
    revalidatePath(`/staff/orders/${o.order_id}`);
  }
}

export async function updateSiteVisitDetailsAction(orderId: string, details: any) {
  const supabase = await getSupabase();
  const orderUuid = await resolveOrderUuid(supabase, orderId);

  // 1. Get company ID and order_id
  const { data: order } = await supabase.from("orders").select("company_id, order_id").eq("id", orderUuid).single();
  const companyId = order?.company_id || "11111111-1111-1111-1111-111111111111";

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
  if (details.locations && Array.isArray(details.locations)) {
    if (details.locations.length > 0) {
      const locationsPayload = details.locations.map((loc: any) => {
        const isValidUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(loc.id);
        return {
          ...(isValidUuid ? { id: loc.id } : {}),
          site_visit_id: siteVisit.id,
          name: loc.name || "Unknown",
        width: loc.width,
        width_unit: loc.widthUnit || "ft",
        height: loc.height,
        height_unit: loc.heightUnit || "ft",
        depth: loc.depth,
        depth_unit: loc.depthUnit || "ft",
        ground_clearance: loc.groundClearance,
        ground_clearance_unit: loc.groundClearanceUnit || "ft",
        notes: loc.notes,
        photos: loc.photos || [],
        power_available: loc.powerAvailable,
        distance_to_power_source: loc.distanceToPowerSource,
        distance_to_power_source_unit: loc.distanceToPowerSourceUnit,
        electrical_notes: loc.electricalNotes || "",
        wall_type: loc.wallType || "",
        mounting_method: loc.mountingMethod,
        surface_condition: loc.surfaceCondition,
        obstacles: loc.obstacles || [],
        structural_notes: loc.structuralNotes
      };
      });
      const { error: locError } = await supabase.from("site_visit_measurements").upsert(locationsPayload, { onConflict: "id" });
      if (locError) console.error("Failed to upsert measurements:", locError.message);
    }
  }

  // Revalidate cache for all possible URLs
  const orderCode = order?.order_id;
  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/staff/orders");
  revalidatePath(`/staff/orders/${orderId}`);
  revalidatePath("/portal");
  revalidatePath(`/portal/${orderId}`);
  if (orderCode) {
    revalidatePath(`/admin/orders/${orderCode}`);
    revalidatePath(`/staff/orders/${orderCode}`);
    revalidatePath(`/portal/${orderCode}`);
  }

  return { success: true };
}



export async function updateDesignDetailsAction(orderId: string, details: any) {
  const supabase = await getSupabase();
  const { data: current, error: fetchError } = await supabase.from("orders").select("design_details").eq("id", orderId).single();
  if (fetchError) throw new Error(fetchError.message);
  
  const updatedDetails = {
    ...(current?.design_details || {}),
    ...details
  };
  
  return await updateOrder(orderId, { design_details: updatedDetails });
}

export async function updateProductionDetailsAction(orderId: string, details: any) {
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
  
  // Revalidate cache
  revalidatePath("/production/orders");
  revalidatePath(`/production/orders/${orderId}`);
  revalidatePath(`/production/orders/${orderUuid}`);
  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath(`/admin/orders/${orderUuid}`);
  revalidatePath("/staff/orders");
  revalidatePath(`/staff/orders/${orderId}`);
  revalidatePath(`/staff/orders/${orderUuid}`);
  revalidatePath("/portal");
  revalidatePath(`/portal/${orderId}`);
  revalidatePath(`/portal/${orderUuid}`);
  
  return { success: true };
}

export async function updateInstallationDetailsAction(orderId: string, details: any) {
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
  
  // Revalidate cache
  revalidatePath("/installation/orders");
  revalidatePath(`/installation/orders/${orderId}`);
  revalidatePath(`/installation/orders/${orderUuid}`);
  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath(`/admin/orders/${orderUuid}`);
  revalidatePath("/staff/orders");
  revalidatePath(`/staff/orders/${orderId}`);
  revalidatePath(`/staff/orders/${orderUuid}`);
  revalidatePath("/portal");
  revalidatePath(`/portal/${orderId}`);
  revalidatePath(`/portal/${orderUuid}`);
  
  return { success: true };
}

export async function requestStageAdvancementAction(orderId: string) {
  const supabase = await getSupabase();
  const { data: current, error: fetchError } = await supabase.from("orders").select("stage, workflow_type").eq("id", orderId).single();
  if (fetchError) throw new Error(fetchError.message);

  let nextStatus = "Normal";
  const stage = current.stage;
  const isDesignFirst = (current.workflow_type || "quote_first") === "design_first";
  
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
      : "Pending Admin Approval: Design Approval";
  } else if (stage === "Design In Progress") {
    nextStatus = "Pending Admin Approval: Design Approval";
  } else if (stage === "Design Approved") {
    nextStatus = isDesignFirst
      ? "Pending Admin Approval: Quote Stage"
      : "Pending Admin Approval: Production Ready";
  } else if (stage === "Production") {
    nextStatus = "Pending Admin Approval: Production Ready";
  } else if (stage === "Ready For Installation" || stage === "Installation Scheduled") {
    nextStatus = "Pending Admin Approval: Job Done";
  }
  
  return await updateOrder(orderId, { stage_status: nextStatus, stage_admin_notes: "" });
}

export async function adminApproveStageAction(orderId: string) {
  const supabase = await getSupabase();
  const orderUuid = await resolveOrderUuid(supabase, orderId);
  const { data: o, error: fetchError } = await supabase
    .from("orders")
    .select("stage, order_id, workflow_type")
    .eq("id", orderUuid)
    .single();
  if (fetchError) throw new Error(fetchError.message);

  const isDesignFirst = (o.workflow_type || "quote_first") === "design_first";

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

  const nextStage = nextStageMap[o.stage] || o.stage;
  const logMsg = `Admin approved stage progression from "${o.stage}" to "${nextStage}".`;

  const result = await updateOrder(orderUuid, {
    stage: nextStage,
    stage_status: "Normal",
    stage_admin_notes: "",
  });

  await supabase.from("order_activity").insert({
    order_id: o.order_id || orderId,
    activity_type: "timeline",
    actor_name: "System",
    actor_role: "System",
    content: logMsg,
    metadata: { action: "stage_approved", old: o.stage, new: nextStage }
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
  const supabase = await getSupabase();
  const orderUuid = await resolveOrderUuid(supabase, orderId);
  const { data: o, error: fetchError } = await supabase
    .from("orders")
    .select("order_id, stage")
    .eq("id", orderUuid)
    .single();
  if (fetchError) throw new Error(fetchError.message);

  const firstStage = workflowType === "design_first"
    ? "Design In Progress"
    : "Quotation In Progress";

  const result = await updateOrder(orderUuid, {
    workflow_type: workflowType,
    stage: firstStage,
    stage_status: "Normal",
    stage_admin_notes: "",
  });

  await supabase.from("order_activity").insert({
    order_id: o.order_id || orderId,
    activity_type: "timeline",
    actor_name: "System",
    actor_role: "System",
    content: `Workflow path set to "${workflowType === "design_first" ? "Design First" : "Quote First"}". Order advanced to ${firstStage}.`,
    metadata: { action: "workflow_type_set", workflow_type: workflowType, stage: firstStage }
  });

  return result;
}


export async function updateOrderStageAction(id: string, stage: string) {
  const supabase = await getSupabase();
  const orderUuid = await resolveOrderUuid(supabase, id);
  const { data: o, error: fetchError } = await supabase
    .from("orders")
    .select("stage, order_id")
    .eq("id", orderUuid)
    .single();
  if (fetchError) throw new Error(fetchError.message);

  const isChanged = stage !== o.stage;
  const result = await updateOrder(orderUuid, { stage });

  if (isChanged) {
    await supabase.from("order_activity").insert({
      order_id: o.order_id || id,
      activity_type: "timeline",
      actor_name: "System",
      actor_role: "System",
      content: `Order stage manually changed from "${o.stage}" to "${stage}".`,
      metadata: { action: "stage_changed", old: o.stage, new: stage }
    });
  }

  return result;
}

export async function addChatMessageAction(orderId: string, sender: string, message: string) {
  const supabase = await getSupabase();
  const { data: o, error: fetchError } = await supabase
    .from("orders")
    .select("order_id")
    .eq("id", orderId)
    .single();
  if (fetchError) throw new Error(fetchError.message);

  const isSystem = sender === "System";
  await supabase.from("order_activity").insert({
    order_id: o.order_id || orderId,
    activity_type: isSystem ? "timeline" : "internal",
    actor_name: sender,
    actor_role: isSystem ? "System" : sender === "Admin" ? "Admin" : "Employee",
    content: message
  });
}

export async function assignEmployeesToOrderAction(orderId: string, employeeIds: string[]) {
  return await assignTeamToOrder(orderId, employeeIds);
}

export async function fetchEmployeeStats() {
  const supabase = await getSupabase();
  
  const { data: staff, error: staffError } = await supabase
    .from("users")
    .select("id, name, email, staff_role")
    .eq("role", "staff")
    .neq("staff_role", "Production");
  if (staffError) throw new Error(staffError.message);

  // Load active assignments from order_assignments joined to active orders
  const { data: assignments, error: assignError } = await supabase
    .from("order_assignments")
    .select("employee_id, orders!inner(id, project_name, stage)")
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
      jobTitles: myAssignments.map(a => (a.orders as any)?.project_name).filter(Boolean)
    };
  });
  
  return stats;
}

export async function assignTeamToOrder(orderId: string, employeeIds: string[]) {
  const supabase = await getSupabase();

  // Resolve UUID in case a friendly order_id was passed
  const orderUuid = await resolveOrderUuid(supabase, orderId);

  const { data: o } = await supabase.from("orders").select("order_id").eq("id", orderUuid).single();

  // Delete existing assignments for this order, then insert new ones
  await supabase.from("order_assignments").delete().eq("order_id", orderUuid);
  
  if (employeeIds.length > 0) {
    const rows = employeeIds.map(eid => ({ order_id: orderUuid, employee_id: eid }));
    const { error: insertError } = await supabase.from("order_assignments").insert(rows);
    if (insertError) throw new Error(insertError.message);
  }

  const msg = `Team assigned: ${employeeIds.length} employee(s) allocated to this order.`;

  await supabase.from("order_activity").insert({
    order_id: o?.order_id || orderId,
    activity_type: "timeline",
    actor_name: "System",
    actor_role: "System",
    content: `Team assigned: ${employeeIds.length} employee(s) allocated to this order.`,
    metadata: { action: "team_assigned", count: employeeIds.length }
  });

  revalidatePath("/admin/orders");
  revalidatePath("/staff/orders");
  return { success: true };
}

export async function updateOrderHealthAction(orderId: string, health: string, lostReason?: string) {
  const supabase = await getSupabase();
  const { data: o, error: fetchError } = await supabase
    .from("orders")
    .select("order_id")
    .eq("id", orderId)
    .single();
  if (fetchError) throw new Error(fetchError.message);

  const result = await updateOrder(orderId, {
    health,
    lost_reason: lostReason || null,
  });

  await supabase.from("order_activity").insert({
    order_id: o.order_id || orderId,
    activity_type: "timeline",
    actor_name: "System",
    actor_role: "System",
    content: `Order health status updated to "${health}"${lostReason ? ` with reason: "${lostReason}"` : ""}.`,
    metadata: { action: "health_changed", health, lost_reason: lostReason || null }
  });

  return result;
}

export async function reopenOrderAction(orderId: string) {
  const supabase = await getSupabase();
  const { data: o, error: fetchError } = await supabase
    .from("orders")
    .select("order_id")
    .eq("id", orderId)
    .single();
  if (fetchError) throw new Error(fetchError.message);

  const result = await updateOrder(orderId, { health: "Active", lost_reason: null });

  await supabase.from("order_activity").insert({
    order_id: o.order_id || orderId,
    activity_type: "timeline",
    actor_name: "System",
    actor_role: "System",
    content: `Order reopened. Health status set to "Active".`,
    metadata: { action: "order_reopened" }
  });

  return result;
}

export async function scheduleSiteVisitAction(orderId: string, scheduleData: any) {
  const supabase = await getSupabase();
  const orderUuid = await resolveOrderUuid(supabase, orderId);
  
  const { data: order, error: fetchError } = await supabase
    .from("orders")
    .select("company_id, order_id, customer_id, business_name")
    .eq("id", orderUuid)
    .single();
    
  if (fetchError || !order) throw new Error(fetchError?.message || "Order not found");

  const { data: existingSv } = await supabase.from("site_visits").select("*").eq("order_id", orderUuid).maybeSingle();
  const mappedExisting = mapSiteVisitFromDb(existingSv) || {};
  const updatedSiteVisit = { ...mappedExisting, ...scheduleData, completed: false, reviewStatus: "Pending" as const };
  const companyId = order.company_id || "11111111-1111-1111-1111-111111111111";
  const dbPayload = mapSiteVisitToDb(orderId, companyId, updatedSiteVisit);

  const { data: siteVisit, error: svError } = await supabase.from("site_visits").upsert(dbPayload, { onConflict: "order_id" }).select().single();
  if (svError) throw new Error(svError.message);

  const date = scheduleData.auditDate || scheduleData.preferredDate;
  const time = scheduleData.preferredTime || scheduleData.auditTime;

  const { data: updatedOrderRow, error: updateError } = await supabase
    .from("orders")
    .update({ stage: "Site Visit Scheduled", stage_status: "Normal" })
    .eq("id", orderUuid)
    .select()
    .single();
  if (updateError) throw new Error(updateError.message);

  await supabase.from("order_activity").insert({
    order_id: order.order_id || orderId,
    activity_type: "timeline",
    actor_name: "System",
    actor_role: "System",
    content: `📅 Site visit scheduled for ${date} at ${time} by client.`,
    metadata: { action: "site_visit_scheduled", date, time, address: scheduleData.customerAddress }
  });

  revalidatePath("/admin/orders");
  revalidatePath("/staff/orders");
  revalidatePath(`/admin/orders/${order.order_id || orderId}`);
  revalidatePath(`/staff/orders/${order.order_id || orderId}`);
  
  return { success: true, order: { ...updatedOrderRow, siteVisitDetails: mapSiteVisitFromDb(siteVisit) } };
}

export async function approveSiteVisitAction(orderId: string) {
  const supabase = await getSupabase();
  const orderUuid = await resolveOrderUuid(supabase, orderId);
  
  const { data: order, error: fetchError } = await supabase
    .from("orders")
    .select("company_id, order_id, customer_id")
    .eq("id", orderUuid)
    .single();
    
  if (fetchError || !order) throw new Error(fetchError?.message || "Order not found");

  const { data: existingSv } = await supabase.from("site_visits").select("*").eq("order_id", orderUuid).maybeSingle();
  const mappedExisting = mapSiteVisitFromDb(existingSv) || {};
  const companyId = order.company_id || "11111111-1111-1111-1111-111111111111";
  const dbPayload = mapSiteVisitToDb(orderId, companyId, { ...mappedExisting, reviewStatus: "Staff Approved" as const });

  const { data: siteVisit, error: svError } = await supabase.from("site_visits").upsert(dbPayload, { onConflict: "order_id" }).select().single();
  if (svError) throw new Error(svError.message);

  const { data: updatedOrderRow, error: updateError } = await supabase
    .from("orders")
    .update({ stage: "Site Visit Scheduled", stage_status: "Pending Admin Approval: Site Visit Schedule" })
    .eq("id", orderUuid)
    .select()
    .single();
  if (updateError) throw new Error(updateError.message);

  await supabase.from("order_activity").insert({
    order_id: order.order_id || orderId,
    activity_type: "timeline",
    actor_name: "System",
    actor_role: "System",
    content: `Site visit time approved by assigned staff. Pending Admin Approval.`,
    metadata: { action: "site_visit_staff_approved" }
  });

  revalidatePath("/admin/orders");
  revalidatePath("/staff/orders");
  revalidatePath(`/staff/site-visit`);
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
    .select("order_id, stage")
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
  await supabase.from("order_activity").insert({
    order_id: order.order_id || orderId,
    activity_type: "timeline",
    actor_name: "System",
    actor_role: "System",
    content: "Site visit data confirmed and locked. Pending admin review.",
    metadata: { action: "site_visit_frozen" }
  });

  // 5. Revalidate all views
  revalidatePath("/admin/orders");
  revalidatePath("/staff/orders");
  revalidatePath(`/admin/orders/${order.order_id || orderId}`);
  revalidatePath(`/staff/orders/${order.order_id || orderId}`);

  return { success: true, updatedOrder };
}
