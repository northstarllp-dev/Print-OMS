import { headers } from "next/headers";
import { resolvePortalToken } from "@/utils/portal-tokens";
import { checkRateLimit, clientIpFromHeaders } from "@/utils/rate-limiter";
import { PortalClient } from "./PortalClient";
import React from "react";
import { mapSiteVisitFromDb, mapSiteVisitMeasurementFromDb } from "@/features/orders/actions/siteVisitMapper";
import { mapDesignFromDb } from "@/features/designs/actions/designMapper";
import { mapProductionDetails } from "@/features/orders/actions/productionMapper";
import { toCustomerVisibleDesign } from "@/features/designs/utils/customerVisibleDesign";
import { createAdminClient } from "@/utils/supabase/admin";
import { isQuotationVisibleToCustomer } from "@/features/quotations/utils/lineAmount";
import { normalizeInvoiceProfile } from "@/features/quotations/types/invoiceProfile";

export const dynamic = "force-dynamic";

export default async function PortalPage({
  searchParams,
}: {
  searchParams: Promise<{ customer_id?: string; token?: string; order_id?: string }>;
}) {
  const params = await searchParams;
  const tokenParam = params.token;

  if (!tokenParam) {
    return (
      <PortalError
        title="Invalid Magic Link"
        message="The magic link you clicked is incomplete or has expired. Please ask Printoms Admin to send it again."
      />
    );
  }

  // ── Rate limiting ──
  const headersList = await headers();
  const clientIp = clientIpFromHeaders(headersList);
  const rate = checkRateLimit(`portal-page-${clientIp}-${tokenParam.slice(0, 16)}`);
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
        message="This secure portal link is invalid or has expired. Please request a new link from Printoms."
      />
    );
  }

  const admin = createAdminClient();

  // ── Fetch data from Supabase ──
  if (!admin) {
    return (
      <PortalError
        title="Server Configuration Error"
        message="Portal service is temporarily unavailable. Please contact support."
      />
    );
  }

  // Find customer safely, accommodating both UUID and friendly ID
  let customerQuery = admin.from("customers").select("*");
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(payload.customerId);
  
  if (isUUID) {
    customerQuery = customerQuery.eq("id", payload.customerId);
  } else {
    customerQuery = customerQuery.eq("customer_id", payload.customerId);
  }

  const { data: customersMatch, error: customerError } = await customerQuery;

  if (customerError || !customersMatch || customersMatch.length === 0) {
    return (
      <PortalError
        title="Customer Not Found"
        message={`Could not locate a customer profile for ID ${payload.customerId}.`}
      />
    );
  }

  let customerData = customersMatch[0];

  // Prefer customer row matching this deploy's company_id
  let deployId: string | null = null;
  let tenantMatches = customersMatch;
  try {
    const { getPortalDeployCompanyId } = await import(
      "@/utils/portal/portalTenantAuth"
    );
    deployId = getPortalDeployCompanyId();
    tenantMatches = customersMatch.filter((c) => c.company_id === deployId);
    if (tenantMatches.length >= 1) {
      customerData = tenantMatches[0];
    }
  } catch {
    /* continue — assert below */
  }

  // Deploy slug + company_id must match (prevent cross-tenant portal access)
  try {
    const { assertCompanyMatchesDeploy } = await import(
      "@/utils/portal/portalTenantAuth"
    );
    assertCompanyMatchesDeploy(customerData.company_id);
  } catch {
    return (
      <PortalError
        title="Wrong Workspace"
        message="Unauthorized access. This portal link belongs to a different client workspace."
      />
    );
  }

  // Ambiguous only when multiple profiles exist for THIS deploy (not cross-tenant)
  if (tenantMatches.length > 1) {
    if (payload.orderId) {
      let orderQuery = admin.from("orders").select("customer_id, company_id");
      const isOrderUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(payload.orderId);
      
      if (isOrderUUID) {
        orderQuery = orderQuery.eq("id", payload.orderId);
      } else {
        orderQuery = orderQuery.eq("order_id", payload.orderId);
      }
      if (deployId) {
        orderQuery = orderQuery.eq("company_id", deployId);
      }

      const { data: ordersMatch } = await orderQuery;
        
      if (ordersMatch && ordersMatch.length > 0) {
        const exactMatch = tenantMatches.find(c => 
          ordersMatch.some(o => o.customer_id === c.id)
        );
        if (exactMatch) {
          customerData = exactMatch;
        } else {
          return (
            <PortalError
              title="Access Denied"
              message="The requested order does not belong to this customer profile."
            />
          );
        }
      } else {
        return (
          <PortalError
            title="Order Not Found"
            message={`Could not locate the requested order ${payload.orderId}.`}
          />
        );
      }
    } else {
      return (
        <PortalError
          title="Ambiguous Customer ID"
          message={`Multiple profiles found for ID ${payload.customerId}. Please use an order-specific link.`}
        />
      );
    }
  }

  const { data: ordersData, error: ordersError } = await admin
    .from("orders")
    .select("*, site_visits(*, site_visit_measurements(*)), installations(*), productions(*), designs(*)")
    .eq("customer_id", customerData.id)
    .order("date_created", { ascending: false });

  if (ordersError) {
    return (
      <PortalError
        title="Database Error"
        message="Unable to load order details. Please try again later."
      />
    );
  }

  // Fetch quotations for these orders
  const orderIds = (ordersData || []).map((o) => o.id);
  let quotationsData: any[] = [];
  let siteVisitsData: any[] = [];
  let siteVisitMeasurementsData: any[] = [];

  if (orderIds.length > 0) {
    const [qtsRes, svsRes] = await Promise.all([
      admin
        ? admin.from("quotations").select("*").in("order_id", orderIds)
        : Promise.resolve({ data: [], error: null }),
      admin.from("site_visits").select("id, order_id").in("order_id", orderIds),
    ]);
    if (!qtsRes.error && qtsRes.data) {
      quotationsData = qtsRes.data;
    }
    if (!svsRes.error && svsRes.data) siteVisitsData = svsRes.data;

    if (siteVisitsData.length > 0) {
      const svIds = siteVisitsData.map((sv: any) => sv.id);
      const { data: measData } = await admin
        .from("site_visit_measurements")
        .select("id, site_visit_id, name, width, width_unit, height, height_unit, depth, depth_unit, notes, ground_clearance, ground_clearance_unit")
        .in("site_visit_id", svIds);
      if (measData) siteVisitMeasurementsData = measData;
    }
  }

  // If orderId is provided, perform an explicit IDOR verification check:
  // ensure the requested order_id belongs to the validated customer_id.
  if (payload.orderId) {
    const linkedOrder = (ordersData || []).find(
      (o) => o.order_id === payload.orderId || o.id === payload.orderId
    );
    if (!linkedOrder) {
      return (
        <PortalError
          title="Access Denied"
          message="You do not have permission to view the requested order details."
        />
      );
    }
    if (linkedOrder.stage === "Completed" || linkedOrder.stage === "Closed") {
      return (
        <PortalError
          title="Portal Link Inactive"
          message="This order has been closed. The customer portal link is no longer active. Please contact us if you need help."
        />
      );
    }
  } else if (
    (ordersData || []).length > 0 &&
    (ordersData || []).every(
      (o) => o.stage === "Completed" || o.stage === "Closed"
    )
  ) {
    return (
      <PortalError
        title="Portal Link Inactive"
        message="All linked orders have been closed. The customer portal link is no longer active. Please contact us if you need help."
      />
    );
  }

  // ── Map to camelCase for frontend ──
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

  const mappedQuotations = quotationsData.map((q: any) => ({
    id: q.id,
    quotationId: q.quotation_id,
    orderId: q.order_id,
    signageOptions: q.signage_options || [],
    discount: Number(q.discount || 0),
    shipping: Number(q.shipping || 0),
    subtotal: Number(q.subtotal || 0),
    tax: Number(q.tax || 0),
    grandTotal: Number(q.grand_total || 0),
    status: q.status,
    notes: q.notes,
    terms: q.terms,
  }));

  const orders = ordersData.map((o: any) => {
    const q = quotationsData.find((qt: any) => qt.order_id === o.id);
    const sv = siteVisitsData.find((sv: any) => sv.order_id === o.id);
    const siteVisitItems = sv
      ? siteVisitMeasurementsData
          .filter((m: any) => m.site_visit_id === sv.id)
          .map(mapSiteVisitMeasurementFromDb)
      : [];

    return {
      id: o.id,
      clientName: o.client_name,
      businessName: o.business_name || "",
      customerId: o.customer_id,
      customerName: o.business_name,
      stage: o.stage,
      budget: Number(o.budget || 0),
      depositPaid: Number(o.deposit_paid || 0),
      dimensions: o.dimensions,
      notes: o.notes,
      productType: o.product_type,
      requirements: o.requirements,
      assignedEmployees: o.assigned_employees || [],
      dateCreated: o.date_created,
      imageMockup: o.image_mockup,
      versionHistory: o.version_history || [],
      chatHistory: o.chat_history || [],
      workflow_type: o.workflow_type,
      siteVisitDetails: mapSiteVisitFromDb(
        Array.isArray(o.site_visits)
          ? (o.site_visits.length > 0 ? o.site_visits[0] : null)
          : (o.site_visits || null)
      ),
      quoteDetails: q ? (
        isQuotationVisibleToCustomer(q.status) ? {
          id: q.id,
          quotationId: q.quotation_id,
          signageOptions: q.signage_options || [],
          discount: Number(q.discount || 0),
          shipping: Number(q.shipping || 0),
          subtotal: Number(q.subtotal || 0),
          tax: Number(q.tax || 0),
          grandTotal: Number(q.grand_total || 0),
          status: q.status,
          notes: q.notes,
          terms: q.terms,
          rejectionReason: q.rejection_reason,
          createdAt: q.created_at,
          updatedAt: q.updated_at,
        } : {
          status: q.status,
          rejectionReason: q.rejection_reason,
        }
      ) : null,
      design: toCustomerVisibleDesign(
        Array.isArray(o.designs) && o.designs.length > 0
          ? mapDesignFromDb(o.designs[0])
          : o.designs
            ? mapDesignFromDb(o.designs)
            : null
      ),
      productionDetails: mapProductionDetails(
        Array.isArray(o.productions) && o.productions.length > 0 ? o.productions[0] : (o.productions || null)
      ),
      installationDetails: Array.isArray(o.installations) && o.installations.length > 0 ? o.installations[0] : (o.installations || null),
      stageStatus: o.stage_status || null,
      stageAdminNotes: o.stage_admin_notes || null,
      orderCode: o.order_id || o.id,
      orderId: o.order_id || o.id,

      siteVisitItems,
    };
  });

  // Fetch app settings using customer's company ID (admin client — portal has no staff session)
  const { data: settingsRow } = await admin
    .from("app_settings")
    .select(
      "site_visit_scheduling_enabled, installation_scheduling_enabled, invoice_profile"
    )
    .eq("company_id", customerData.company_id)
    .maybeSingle();

  const appSettings = {
    siteVisitSchedulingEnabled: settingsRow?.site_visit_scheduling_enabled ?? true,
    installationSchedulingEnabled: settingsRow?.installation_scheduling_enabled ?? true,
    invoiceProfile: normalizeInvoiceProfile(settingsRow?.invoice_profile),
  };

  return (
    <PortalClient
      customer={customer}
      orders={orders}
      quotations={mappedQuotations}
      initialActiveOrderId={payload.orderId || null}
      initialToken={tokenParam}
      token={tokenParam}
      appSettings={appSettings}
    />
  );
}

import { Logo } from "@/components/ui/Logo";
import { loadClientConfig } from "@/config/loadClientConfig";

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
        <div style={{ display: "flex", justifyContent: "center", marginBottom: "24px" }}>
          <Logo height={48} />
        </div>
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
