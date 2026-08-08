"use server";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { generateAndStorePortalToken } from "@/utils/portal-tokens";
import { dispatchWhatsAppNotification } from "@/features/notifications/actions/dispatchNotification";
import { getRequestBaseUrl } from "@/features/notifications/whatsapp/requestBaseUrl";


import { createAdminClient } from "@/utils/supabase/admin";
import { getDeployCompanyId } from "@/config/loadClientConfig";
import { revalidateStaffQueuePaths } from "@/features/orders/actions/orderActions";
import { insertOrderActivity } from "@/features/orders/activity/logOrderActivity";
import { getCurrentUser } from "@/features/auth/actions/authActions";
import { resolveStagePermission } from "@/features/orders/workspace/shared/permissions";
import { assertStageEditPermission } from "@/features/orders/workspace/shared/serverPermissions";
import {
  buildCustomerInsertFromEnquiry,
  buildCustomerMatchOrClauses,
} from "@/features/enquiries/enquiryFormLogic";
import { buildHealthUpdatePayload } from "@/features/enquiries/enquiryListLogic";
import {
  buildConvertCustomerOrClauses,
  buildCustomerInsertFromConvert,
  buildEnquiryConvertedUpdate,
  buildOrderInsertFromConvert,
  orderCreatedIdempotencyKey,
  shouldBlockConvert,
} from "@/features/enquiries/enquiryConvertLogic";

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
          } catch {}
        },
      },
    }
  );
}

function revalidateEnquiryPaths() {
  revalidatePath("/admin/enquire");
  revalidatePath("/staff/enquiries");
  revalidatePath("/admin/dashboard");
}

export async function getEnquiries() {
  const profile = await getCurrentUser();
  if (!profile) throw new Error("Unauthorized");
  if (profile.role !== "admin") {
    const { canView, canEdit } = resolveStagePermission("enquiry", {
      role: profile.role,
      staff_role: profile.staff_role ?? null,
      company_id: profile.company_id ?? null,
    });
    // Soft-deny for incidental callers (staff queues, reports) — return empty
    if (!canView && !canEdit) return [];
  }

  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from("enquiries")
    .select(`
      *,
      customers:customer_id(customer_id),
      orders:order_id(order_id)
    `)
    .order("date_received", { ascending: false });
  if (error) throw new Error(error.message);
  return data;
}

export async function getEnquiryByOrderId(orderId: string) {
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from("enquiries")
    .select("*")
    .eq("order_id", orderId)
    .single();
    
  if (error && error.code !== "PGRST116") { // Ignore not found error
    throw new Error(error.message);
  }
  return data;
}

async function ensureCustomerForEnquiry(
  supabase: Awaited<ReturnType<typeof getSupabase>>,
  enq: Record<string, unknown>
) {
  const db = createAdminClient() || supabase;
  if (enq.customer_id) {
    const { data: c } = await db
      .from("customers")
      .select("id, customer_id")
      .eq("id", enq.customer_id as string)
      .maybeSingle();
    if (c) return c;
  }

  const orClauses = buildCustomerMatchOrClauses(enq);

  if (orClauses.length > 0) {
    const { data: existing } = await db
      .from("customers")
      .select("id, customer_id")
      .or(orClauses.join(","))
      .limit(1);
    if (existing?.[0]) {
      await db
        .from("enquiries")
        .update({ customer_id: existing[0].id })
        .eq("id", enq.id);
      return existing[0];
    }
  }

  const { getDeployCompanyId } = await import("@/config/loadClientConfig");
  const companyId =
    (enq.company_id as string) || getDeployCompanyId();
  const { data: created, error } = await db
    .from("customers")
    .insert(buildCustomerInsertFromEnquiry(enq, companyId))
    .select("id, customer_id")
    .single();

  if (error || !created) return null;

  await db
    .from("enquiries")
    .update({ customer_id: created.id })
    .eq("id", enq.id);

  return created;
}

export async function createEnquiry(formData: any) {
  const supabase = await getSupabase();

  const { data: { user } } = await supabase.auth.getUser();
  // Public /quote may create without a session; logged-in users need edit grant
  if (user) {
    await assertStageEditPermission("enquiry");
  }

  let addedBy = "System";
  // Authenticated mutations resolve company from the user profile (strict).
  // The public /quote form has no session, so use the service-role client with
  // the deploy company id — anon RLS no longer permits direct enquiry inserts.
  let writeClient = supabase;
  let companyId: string;
  if (user) {
    const { resolveWriteCompanyId } = await import("@/lib/resolveWriteCompanyId");
    companyId = await resolveWriteCompanyId();
    const { data: profile } = await supabase.from("users").select("name, company_id").eq("id", user.id).single();
    if (profile) {
      if (profile.name) addedBy = profile.name;
    } else {
      addedBy = user.email || "Admin";
    }
  } else {
    const admin = createAdminClient();
    if (!admin) throw new Error("Service role client not configured");
    writeClient = admin;
    companyId = getDeployCompanyId();
  }
  formData.added_by = addedBy;
  if (!formData.company_id) {
    formData.company_id = companyId;
  }

  const { data, error } = await writeClient.from("enquiries").insert([formData]).select();
  if (error) throw new Error(error.message);

  const enq = data?.[0];
  if (enq?.whatsapp || enq?.phone) {
    const customer = await ensureCustomerForEnquiry(writeClient, enq);
    const baseUrl = await getRequestBaseUrl();
    const notifyResult = await dispatchWhatsAppNotification(writeClient, {
      templateKey: "enquiry_received",
      enquiryId: enq.id,
      enquiryRow: enq,
      customerUuid: customer?.id,
      customerFriendlyId: customer?.customer_id,
      idempotencyKey: `enquiry_received:${enq.id}`,
      baseUrl,
    });
    if (!notifyResult.sent) {
      console.warn(
        "[WhatsApp] enquiry_received not sent:",
        notifyResult.reason || notifyResult.error || "unknown"
      );
    }
  }
  if (enq) {
    const { dispatchStageNotification } = await import("@/features/notifications/lib/dispatchNotification");
    await dispatchStageNotification(
      "enquiry",
      enq.company_id,
      {
        title: "New Enquiry Received",
        message: `A new enquiry has been added by ${addedBy}.`,
        type: "success",
        link: "/staff/enquiries"
      }
    );
  }

  revalidateEnquiryPaths();
  return data;
}

export async function resendEnquiryWhatsAppAction(enquiryId: string) {
  await assertStageEditPermission("enquiry");
  const supabase = await getSupabase();
  const { data: enq, error } = await supabase
    .from("enquiries")
    .select("*")
    .eq("id", enquiryId)
    .single();
  if (error || !enq) throw new Error("Enquiry not found");
  if (!enq.whatsapp && !enq.phone) {
    throw new Error("Enquiry has no phone or WhatsApp number");
  }

  let customer: { id: string; customer_id: string } | null = null;
  if (enq.customer_id) {
    const { data: c } = await supabase
      .from("customers")
      .select("id, customer_id")
      .eq("id", enq.customer_id)
      .maybeSingle();
    customer = c;
  } else {
    customer = await ensureCustomerForEnquiry(supabase, enq);
  }

  const baseUrl = await getRequestBaseUrl();
  return dispatchWhatsAppNotification(supabase, {
    templateKey: "enquiry_received",
    enquiryId: enq.id,
    enquiryRow: enq,
    customerUuid: customer?.id,
    customerFriendlyId: customer?.customer_id,
    idempotencyKey: `enquiry_received:${enq.id}`,
    baseUrl,
  });
}

export async function updateEnquiry(id: string, updates: any) {
  await assertStageEditPermission("enquiry");
  const supabase = await getSupabase();
  const { data, error } = await supabase.from("enquiries").update(updates).eq("id", id).select();
  if (error) throw new Error(error.message);
  revalidateEnquiryPaths();
  return data;
}

export async function getAdmins() {
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from("users")
    .select("id, name, email")
    .eq("role", "admin");
    
  if (error) {
    console.error("Error fetching admins:", error);
    return [];
  }
  return data || [];
}

export async function convertEnquiryToOrderAction(enquiryId: string, clientName: string, businessName: string, productType?: string, requirements?: string, assignedAdmins?: string[]) {
  await assertStageEditPermission("enquiry");
  const supabase = await getSupabase();
  
  // 1. Fetch enquiry
  const { data: enq, error: fetchErr } = await supabase
    .from("enquiries")
    .select("*")
    .eq("id", enquiryId)
    .single();
    
  if (fetchErr || !enq) {
    throw new Error(fetchErr?.message || "Enquiry not found");
  }

  if (shouldBlockConvert(enq)) {
    throw new Error("Enquiry is already converted to an order");
  }

  // 2. Check if customer already exists using phone, whatsapp, email
  let existingCust = null;
  
  const orClauses = buildConvertCustomerOrClauses(enq);

  if (orClauses.length > 0) {
    const { data, error: custErr } = await supabase
      .from("customers")
      .select("*")
      .or(orClauses.join(","))
      .limit(1);
    existingCust = data;
  }
    
  let customerId: string;
  let friendlyCustomerId: string;
  let customerName: string;
  let customerPhone = enq.phone;
  let customerEmail = enq.email;
  let isNewCustomer = false;

  // 2b. Retrieve logged-in user's company ID dynamically
  const { resolveWriteCompanyId } = await import("@/lib/resolveWriteCompanyId");
  const companyId = await resolveWriteCompanyId();

  if (existingCust && existingCust.length > 0) {
    customerId = existingCust[0].id;
    customerName = existingCust[0].name;
    friendlyCustomerId = existingCust[0].customer_id;
  } else {
    // 3. Customer does not exist -> Create new customer record
    const { data: newCust, error: insertCustErr } = await supabase
      .from("customers")
      .insert([
        buildCustomerInsertFromConvert(companyId, enq, clientName, businessName),
      ])
      .select();
      
    if (insertCustErr || !newCust || newCust.length === 0) {
      throw new Error(insertCustErr?.message || "Failed to create new customer");
    }
    
    customerId = newCust[0].id;
    customerName = newCust[0].name;
    friendlyCustomerId = newCust[0].customer_id;
    isNewCustomer = true;
  }

  // 4. Create new order
  const { firstPipelineStageForOp } = await import(
    "@/features/orders/businessOperations"
  );
  const businessOperation = (enq.business_operation as string) || "signage";
  const { data: newOrder, error: insertOrderErr } = await supabase
    .from("orders")
    .insert([
      buildOrderInsertFromConvert(
        companyId,
        customerId,
        {
          clientName,
          businessName,
          productType,
          requirements,
          assignedAdmins,
        },
        customerName,
        {
          businessOperation,
          stage: firstPipelineStageForOp(businessOperation),
        }
      ),
    ])
    .select();

  if (insertOrderErr || !newOrder || newOrder.length === 0) {
    throw new Error(insertOrderErr?.message || "Failed to create order");
  }

  const orderId = newOrder[0].id;
  const friendlyOrderId = newOrder[0].order_id;

  // 4c. Create an empty designs record for the new order
  await supabase.from("designs").insert({
    order_id: orderId,
    resources: [],
    items: [],
  });

  // 4b. Log order creation to activity timeline
  await insertOrderActivity(supabase, [
    {
      order_id: friendlyOrderId,
      company_id: companyId,
      actor_name: "System",
      actor_role: "System",
      content: `Order created from Enquiry ${enq.enquire_id || enquiryId}. Customer: ${customerName}.`,
      metadata: { action: "order_created", method: "enquiry_conversion", enquiry_id: enq.enquire_id }
    },
    {
      order_id: friendlyOrderId,
      company_id: companyId,
      actor_name: "System",
      actor_role: "System",
      content: `Secure portal link generated for client. Order ID: ${friendlyOrderId}.`,
      metadata: { action: "portal_link_generated" }
    }
  ]);

  // 5. Update enquiry record
  const { error: updateEnqErr } = await supabase
    .from("enquiries")
    .update(buildEnquiryConvertedUpdate(customerId, orderId))
    .eq("id", enquiryId);
  if (updateEnqErr) console.error("Failed to update enquiry status:", updateEnqErr.message);

  const baseUrl = await getRequestBaseUrl();
  const { url: portalLink } = await generateAndStorePortalToken(
    supabase, customerId, friendlyOrderId,
    { expiresInDays: 30, createdBy: "enquiry_conversion", baseUrl }
  );

  await dispatchWhatsAppNotification(supabase, {
    templateKey: "order_created",
    orderUuid: orderId,
    orderFriendlyId: friendlyOrderId,
    customerFriendlyId: friendlyCustomerId,
    idempotencyKey: orderCreatedIdempotencyKey(friendlyOrderId),
    baseUrl,
  });

  // Dispatch internal notification to admins and relevant staff
  const { dispatchStageNotification } = await import("@/features/notifications/lib/dispatchNotification");
  await dispatchStageNotification(
    "Site Visit Pending",
    companyId,
    {
      title: `Enquiry Converted to Order`,
      message: `${businessName || clientName} enquiry has been converted to Order #${friendlyOrderId}.`,
      type: "success",
      link: `/admin/orders/${friendlyOrderId}`,
    }
  );

  // 6. Revalidate cache (all staff queues — not only /staff/orders)
  revalidateEnquiryPaths();
  await revalidateStaffQueuePaths();
  revalidatePath(`/admin/orders/${friendlyOrderId}`);
  revalidatePath(`/staff/orders/${friendlyOrderId}`);
  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath(`/staff/orders/${orderId}`);
  
  return {
    success: true,
    customerId: friendlyCustomerId,
    orderId: friendlyOrderId,
    portalLink
  };
}

/** 
 * Update an enquiry's health manually (e.g. Lost, Active, On Hold).
 * If Lost, a lostReason can be provided. 
 */
export async function updateEnquiryHealthAction(
  enquiryId: string,
  health: string,
  lostReason?: string | null,
  hold?: { note?: string | null; reachOutAt?: string | null } | null
) {
  const profile = await getCurrentUser();
  if (!profile || (profile.role !== "admin" && profile.role !== "staff")) {
    throw new Error("Unauthorized");
  }
  if (health === "On Hold") {
    if (!hold?.note?.trim() || !hold?.reachOutAt) {
      throw new Error("A note and reach-out date are required when putting an enquiry On Hold.");
    }
  }
  const companyId = profile.company_id ?? null;

  const supabase = await getSupabase();
  const { error } = await supabase
    .from("enquiries")
    .update(buildHealthUpdatePayload(health, lostReason, hold))
    .eq("id", enquiryId)
    .eq("company_id", companyId);

  if (error) {
    console.error("Error updating enquiry health:", error.message);
    throw new Error("Failed to update enquiry health");
  }

  revalidateEnquiryPaths();
  revalidatePath("/admin/calendar");
  revalidatePath("/staff/calendar");
}

/** Mark Active enquiries stalled past the threshold as Needs Attention. Idempotent. */
export async function flagStalledEnquiriesAction(): Promise<{ flagged: number }> {
  const { loadClientConfig, getDeployCompanyId } = await import("@/config/loadClientConfig");
  const config = loadClientConfig();
  const days = config.features.enquiryNeedsAttentionAfterDays ?? 5;
  const companyId = getDeployCompanyId();

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffIso = cutoff.toISOString();

  const supabase = await getSupabase();
  const { data: stalled, error } = await supabase
    .from("enquiries")
    .select("id, company_id")
    .eq("company_id", companyId)
    .eq("health", "Active")
    // If it's converted, we don't care about health stall.
    .neq("status", "Converted")
    .lt("date_received", cutoffIso);

  if (error) {
    console.error("Error fetching stalled enquiries:", error.message);
    return { flagged: 0 };
  }

  if (!stalled || stalled.length === 0) {
    return { flagged: 0 };
  }

  const ids = stalled.map((e) => e.id);
  const { error: updateErr } = await supabase
    .from("enquiries")
    .update({ health: "Needs Attention" })
    .in("id", ids);

  if (updateErr) {
    console.error("Error flagging stalled enquiries:", updateErr.message);
    return { flagged: 0 };
  }

  // We could dispatch internal notifications here if desired, 
  // but for now, we just update the UI state.
  return { flagged: ids.length };
}
