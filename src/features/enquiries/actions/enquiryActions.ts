"use server";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { generateAndStorePortalToken } from "@/utils/portal-tokens";
import { dispatchWhatsAppNotification } from "@/features/notifications/actions/dispatchNotification";
import { getRequestBaseUrl } from "@/features/notifications/whatsapp/requestBaseUrl";


import { createAdminClient } from "@/utils/supabase/admin";
import { revalidateStaffQueuePaths } from "@/features/orders/actions/orderActions";

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

export async function getEnquiries() {
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

  const orClauses: string[] = [];
  if (enq.phone) orClauses.push(`phone.eq."${enq.phone}"`);
  if (enq.whatsapp) orClauses.push(`whatsapp.eq."${enq.whatsapp}"`);
  if (enq.email) orClauses.push(`email.eq."${enq.email}"`);

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

  const companyId =
    (enq.company_id as string) || "11111111-1111-1111-1111-111111111111";
  const { data: created, error } = await db
    .from("customers")
    .insert({
      company_id: companyId,
      name: (enq.business_name as string) || (enq.lead_name as string) || "Customer",
      phone: enq.phone,
      whatsapp: enq.whatsapp,
      email: enq.email,
      billing_address: "Address Details Pending Intake",
      shipping_address: (enq.location as string) || "Installation Address Pending Survey",
    })
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
  let addedBy = "System";
  let companyId = "11111111-1111-1111-1111-111111111111"; // default fallback
  if (user) {
    const { data: profile } = await supabase.from("users").select("name, company_id").eq("id", user.id).single();
    if (profile) {
      if (profile.name) addedBy = profile.name;
      if (profile.company_id) companyId = profile.company_id;
    } else {
      addedBy = user.email || "Admin";
    }
  } else {
    const { data: cos } = await supabase.from("companies").select("id").limit(1);
    if (cos && cos.length > 0) {
      companyId = cos[0].id;
    }
  }
  formData.added_by = addedBy;
  if (!formData.company_id) {
    formData.company_id = companyId;
  }

  const { data, error } = await supabase.from("enquiries").insert([formData]).select();
  if (error) throw new Error(error.message);

  const enq = data?.[0];
  if (enq?.whatsapp || enq?.phone) {
    const customer = await ensureCustomerForEnquiry(supabase, enq);
    const baseUrl = await getRequestBaseUrl();
    const notifyResult = await dispatchWhatsAppNotification(supabase, {
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

  revalidatePath("/admin/enquire");
  return data;
}

export async function resendEnquiryWhatsAppAction(enquiryId: string) {
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
  const supabase = await getSupabase();
  const { data, error } = await supabase.from("enquiries").update(updates).eq("id", id).select();
  if (error) throw new Error(error.message);
  revalidatePath("/admin/enquire");
  return data;
}

export async function convertEnquiryToOrderAction(enquiryId: string, clientName: string, businessName: string, productType?: string, requirements?: string) {
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

  // 2. Check if customer already exists using phone, whatsapp, email
  let existingCust = null;
  
  const orClauses = [];
  if (enq.phone) orClauses.push(`phone.eq."${enq.phone}"`);
  if (enq.whatsapp) orClauses.push(`whatsapp.eq."${enq.whatsapp}"`);
  if (enq.email) orClauses.push(`email.eq."${enq.email}"`);

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
  const { data: { user: authUser } } = await supabase.auth.getUser();
  let companyId = "11111111-1111-1111-1111-111111111111"; // default fallback
  if (authUser) {
    const { data: profile } = await supabase.from("users").select("company_id").eq("id", authUser.id).single();
    if (profile && profile.company_id) {
      companyId = profile.company_id;
    }
  }

  if (existingCust && existingCust.length > 0) {
    customerId = existingCust[0].id;
    customerName = existingCust[0].name;
    friendlyCustomerId = existingCust[0].customer_id;
  } else {
    // 3. Customer does not exist -> Create new customer record
    const { data: newCust, error: insertCustErr } = await supabase
      .from("customers")
      .insert([{
        company_id: companyId,
        name: businessName || clientName,
        phone: enq.phone,
        whatsapp: enq.whatsapp,
        email: enq.email,
        billing_address: "Address Details Pending Intake",
        shipping_address: enq.location || "Installation Address Pending Survey"
      }])
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
  const { data: newOrder, error: insertOrderErr } = await supabase
    .from("orders")
    .insert([{
      company_id: companyId,
      client_name: clientName,
      business_name: businessName || customerName,
      customer_id: customerId,
      stage: "Site Visit Pending",
      health: "Active",
      product_type: productType || "",
      requirements: requirements || "",
    }])
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
  await supabase.from("order_activity").insert([
    {
      order_id: friendlyOrderId,
      activity_type: "timeline",
      actor_name: "System",
      actor_role: "System",
      content: `Order created from Enquiry ${enq.enquire_id || enquiryId}. Customer: ${customerName}.`,
      metadata: { action: "order_created", method: "enquiry_conversion", enquiry_id: enq.enquire_id }
    },
    {
      order_id: friendlyOrderId,
      activity_type: "timeline",
      actor_name: "System",
      actor_role: "System",
      content: `Secure portal link generated for client. Order ID: ${friendlyOrderId}.`,
      metadata: { action: "portal_link_generated" }
    }
  ]);

  // 5. Update enquiry record
  const { error: updateEnqErr } = await supabase
    .from("enquiries")
    .update({ status: "Converted", customer_id: customerId, order_id: orderId })
    .eq("id", enquiryId);
  if (updateEnqErr) console.error("Failed to update enquiry status:", updateEnqErr.message);

  const baseUrl = await getRequestBaseUrl();
  const { url: portalLink } = await generateAndStorePortalToken(
    supabase, friendlyCustomerId, friendlyOrderId,
    { expiresInDays: 30, createdBy: "enquiry_conversion", baseUrl }
  );

  await dispatchWhatsAppNotification(supabase, {
    templateKey: "order_created",
    orderUuid: orderId,
    orderFriendlyId: friendlyOrderId,
    customerFriendlyId: friendlyCustomerId,
    idempotencyKey: `order_created:${friendlyOrderId}`,
    baseUrl,
  });

  // 6. Revalidate cache (all staff queues — not only /staff/orders)
  revalidatePath("/admin/enquire");
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
