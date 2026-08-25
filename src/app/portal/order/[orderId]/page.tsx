import { headers } from "next/headers";
import { createAdminClient } from "@/utils/supabase/admin";
import { resolvePortalToken } from "@/utils/portal-tokens";
import { checkRateLimit, clientIpFromHeaders } from "@/utils/rate-limiter";
import { Info, Clock, CheckCircle, Check, Loader2, PlayCircle, MapPin, Search } from "lucide-react";
import { mapSiteVisitFromDb, mapSiteVisitMeasurementFromDb } from "@/features/orders/actions/siteVisitMapper";
import { mapDesignFromDb } from "@/features/designs/actions/designMapper";
import { mapProductionDetails } from "@/features/orders/actions/productionMapper";
import { toCustomerVisibleQuotation } from "@/features/quotations/utils/quotationSecurity";
import { toCustomerVisibleDesign } from "@/features/designs/utils/customerVisibleDesign";
import { OrderDetailClient } from "./OrderDetailClient";
import { normalizeInvoiceProfile } from "@/features/quotations/types/invoiceProfile";
import { loadClientConfig } from "@/config/loadClientConfig";
import React from "react";

export const dynamic = "force-dynamic";

export default async function OrderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ orderId: string }>;
  searchParams: Promise<{ customer_id?: string; token?: string }>;
}) {
  const { orderId } = await params;
  const { token: tokenParam } = await searchParams;

  // ── Token required ──
  if (!tokenParam) {
    return (
      <PortalError
        title="Invalid Access"
        message="This order detail link is missing authentication. Please access the portal from your original welcome link."
      />
    );
  }

  // ── Rate limiting (per IP + token — never a shared "anonymous" bucket) ──
  const headersList = await headers();
  const clientIp = clientIpFromHeaders(headersList);
  const rate = checkRateLimit(`portal-order-${clientIp}-${tokenParam.slice(0, 16)}`);
  if (!rate.allowed) {
    return (
      <PortalError
        title="Too Many Requests"
        message={`Please wait ${rate.retryAfter ?? 30} seconds and try again.`}
      />
    );
  }

  // ── Resolve short opaque token (or legacy HMAC) + expiry / revocation ──
  const payload = await resolvePortalToken(tokenParam);
  if (!payload) {
    return (
      <PortalError
        title="Invalid or Expired Link"
        message="This secure portal link is invalid or has expired. Please request a new link."
      />
    );
  }

  const admin = createAdminClient();

  if (!admin) {
    return (
      <PortalError
        title="Server Configuration Error"
        message="Portal service is temporarily unavailable. Please contact support."
      />
    );
  }

  // ── Fetch customer (friendly IDs collide across tenants) ──
  let customerData: any = null;
  try {
    const { assertCustomerTenantAccess } = await import(
      "@/utils/portal/portalTenantAuth"
    );
    const tenantCustomer = await assertCustomerTenantAccess(payload.customerId);
    const { data, error } = await admin
      .from("customers")
      .select("*")
      .eq("id", tenantCustomer.id)
      .single();
    if (error || !data) {
      return (
        <PortalError
          title="Customer Not Found"
          message={`Could not locate a customer profile for ID ${payload.customerId}.`}
        />
      );
    }
    customerData = data;
  } catch {
    return (
      <PortalError
        title="Wrong Workspace"
        message="Unauthorized access. This portal link belongs to a different client workspace."
      />
    );
  }

  // Fetch the specific order — prefer route param, then token orderId; scope by tenant
  const orderRef = orderId || payload.orderId;
  if (!orderRef) {
    return (
      <PortalError
        title="Order Not Found"
        message="This portal link is missing an order reference."
      />
    );
  }

  let orderData: Record<string, any> | null = null;
  try {
    const { assertOrderTenantAccess } = await import(
      "@/utils/portal/portalTenantAuth"
    );
    const tenantOrder = await assertOrderTenantAccess(orderRef);
    const { data, error } = await admin
      .from("orders")
      .select("*, site_visits(*, site_visit_measurements(*)), installations(*), productions(*), designs(*)")
      .eq("id", tenantOrder.id)
      .single();
    if (error || !data) {
      return (
        <PortalError
          title="Order Not Found"
          message={`Could not locate order with ID ${orderId}.`}
        />
      );
    }
    orderData = data;
  } catch {
    return (
      <PortalError
        title="Wrong Workspace"
        message="Unauthorized access. This portal link belongs to a different client workspace."
      />
    );
  }

  if (!customerData || !orderData) {
    return (
      <PortalError
        title="Access Denied"
        message="Unable to load this portal order."
      />
    );
  }

  // Ensure the order belongs to the verified customer
  if (orderData.customer_id !== customerData.id) {
    return (
      <PortalError
        title="Access Denied"
        message="You do not have permission to view this order."
      />
    );
  }

  if (orderData.stage === "Completed" || orderData.stage === "Closed") {
    return (
      <PortalError
        title="Portal Link Inactive"
        message="This order has been closed. The customer portal link is no longer active. Please contact us if you need help."
      />
    );
  }

  // Fetch quotation for this order (service role; customer-visible statuses only)
  const { data: quotationRow } = await admin
    .from("quotations")
    .select("*")
    .eq("order_id", orderData.id)
    .maybeSingle();
  const quotationData = toCustomerVisibleQuotation(quotationRow as Record<string, unknown> | null);

  const quoteDetails = quotationData ? {
    id: quotationData.id,
    quotationId: quotationData.quotation_id,
    items: [],
    signageOptions: quotationData.signage_options || [],
    discount: Number(quotationData.discount || 0),
    shipping: Number(quotationData.shipping || 0),
    installationCharges: Number(
      (quotationData as { installation_charges?: number }).installation_charges || 0
    ),
    subtotal: Number(quotationData.subtotal || 0),
    tax: Number(quotationData.tax || 0),
    grandTotal: Number(quotationData.grand_total || 0),
    status: quotationData.status,
    notes: quotationData.notes,
    terms: quotationData.terms,
    createdAt: quotationData.created_at as string | undefined,
    updatedAt: quotationData.updated_at as string | undefined,
  } : null;

  const { data: invoiceRow } = await admin
    .from("invoices")
    .select("*")
    .eq("order_id", orderData.id)
    .maybeSingle();
  const invoiceDetails = invoiceRow
    ? {
        invoiceId: invoiceRow.invoice_id as string,
        status: invoiceRow.status as string,
        invoiceDate: invoiceRow.invoice_date as string | null,
        dueDate: invoiceRow.due_date as string | null,
        signageOptions: invoiceRow.signage_options || [],
        discount: Number(invoiceRow.discount || 0),
        shipping: Number(invoiceRow.shipping || 0),
        subtotal: Number(invoiceRow.subtotal || 0),
        tax: Number(invoiceRow.tax || 0),
        grandTotal: Number(invoiceRow.grand_total || 0),
        notes: invoiceRow.notes as string | null,
        terms: invoiceRow.terms as string | null,
      }
    : null;

  // Find the site visit for this order
  const { data: sv } = await admin
    .from("site_visits")
    .select("id")
    .eq("order_id", orderData.id)
    .maybeSingle();

  // Fetch measurements from site_visit_measurements (include unit columns)
  const { data: siteVisitItemsData } = sv
    ? await admin
        .from("site_visit_measurements")
        .select("id, name, width, width_unit, height, height_unit, depth, depth_unit, notes, ground_clearance, ground_clearance_unit")
        .eq("site_visit_id", sv.id)
        .order("created_at", { ascending: true })
    : { data: null };
    
  const siteVisitItems = (siteVisitItemsData || []).map(mapSiteVisitMeasurementFromDb);

  // Map to camelCase
  const customer = {
    id: customerData.id,
    name: customerData.name,
    phone: customerData.phone,
    whatsapp: customerData.whatsapp,
    email: customerData.email,
    city: customerData.city,
    billingAddress: customerData.billing_address,
    shippingAddress: customerData.shipping_address,
    status: customerData.status,
    customerCode: customerData.customer_id || customerData.id,
    customerId: customerData.customer_id || customerData.id,
  };

  const order = {
    id: orderData.id,
    clientName: orderData.client_name,
    businessName: orderData.business_name || "",
    customerId: orderData.customer_id,
    customerName: orderData.business_name,
    stage: orderData.stage,
    productType: orderData.product_type,
    requirements: orderData.requirements,
    assignedEmployees: orderData.assigned_employees || [],
    dateCreated: orderData.date_created,
    versionHistory: orderData.version_history || [],
    chatHistory: orderData.chat_history || [],
    workflow_type: orderData.workflow_type,
    business_operation: orderData.business_operation || "signage",
    siteVisitDetails: mapSiteVisitFromDb(
      Array.isArray(orderData.site_visits)
        ? (orderData.site_visits.length > 0 ? orderData.site_visits[0] : null)
        : (orderData.site_visits || null)
    ),
    quoteDetails,
    invoiceDetails,
    design: toCustomerVisibleDesign(
      Array.isArray(orderData.designs) && orderData.designs.length > 0
        ? mapDesignFromDb(orderData.designs[0])
        : orderData.designs
          ? mapDesignFromDb(orderData.designs)
          : null
    ),
    productionDetails: mapProductionDetails(
      Array.isArray(orderData.productions) && orderData.productions.length > 0 ? orderData.productions[0] : (orderData.productions || null)
    ),
    installationDetails: Array.isArray(orderData.installations) && orderData.installations.length > 0 ? orderData.installations[0] : (orderData.installations || null),
    stageStatus: orderData.stage_status || null,
    stageAdminNotes: orderData.stage_admin_notes || null,
    orderCode: orderData.order_id || orderData.id,
    orderId: orderData.order_id || orderData.id,
  };

  const { data: settingsRow } = await admin
    .from("app_settings")
    .select("invoice_profile")
    .eq("company_id", customerData.company_id)
    .maybeSingle();
  const invoiceProfile = normalizeInvoiceProfile(settingsRow?.invoice_profile);

  return (
    <OrderDetailClient
      customer={customer}
      order={order}
      siteVisitItems={siteVisitItems}
      token={tokenParam}
      invoiceProfile={invoiceProfile}
    />
  );
}

function PortalError({ title, message }: { title: string; message: string }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f8f9ff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        fontFamily: "var(--font-sans), sans-serif",
      }}
    >
      <div
        style={{
          background: "white",
          border: "1px solid #c3c6d0",
          borderRadius: 16,
          padding: "40px 32px",
          maxWidth: 480,
          width: "100%",
          textAlign: "center",
          boxShadow: "0 8px 24px rgba(0, 0, 0, 0.08)",
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            background: "#FFF1F2",
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 24px",
            color: "#EF4444",
          }}
        >
          <svg
            width="24"
            height="24"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="2.5"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>
        <h1 style={{ fontSize: 20, fontWeight: 900, color: "#0b1c30", margin: "0 0 12px" }}>
          {title}
        </h1>
        <p style={{ fontSize: 13, color: "#43474f", lineHeight: 1.6, margin: 0 }}>
          {message}
        </p>
        <div style={{ marginTop: 32 }}>
          <p style={{ fontSize: 12, color: "#737780", margin: 0, fontWeight: 700 }}>
            {loadClientConfig().name} Signage Solutions
          </p>
        </div>
      </div>
    </div>
  );
}
