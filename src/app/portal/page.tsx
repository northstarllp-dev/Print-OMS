import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import {
  verifyPortalToken,
  isTokenRevoked,
} from "@/utils/portal-tokens";
import { checkRateLimit } from "@/utils/rate-limiter";
import { PortalClient } from "./PortalClient";
import React from "react";
import { mapSiteVisitFromDb, mapSiteVisitMeasurementFromDb } from "@/features/orders/actions/siteVisitMapper";
import { mapDesignFromDb } from "@/features/designs/actions/designMapper";
import { toCustomerVisibleDesign } from "@/features/designs/utils/customerVisibleDesign";
import { createAdminClient } from "@/utils/supabase/admin";
import { isQuotationVisibleToCustomer } from "@/features/quotations/utils/lineAmount";

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
  const clientIp = "anonymous"; // In production, use request IP from headers
  const rate = checkRateLimit(`portal-page-${clientIp}`);
  if (!rate.allowed) {
    return (
      <PortalError
        title="Too Many Requests"
        message="Please wait a few minutes and try again."
      />
    );
  }

  // ── Verify HMAC + expiry ──
  const payload = verifyPortalToken(tokenParam);
  if (!payload) {
    return (
      <PortalError
        title="Invalid or Expired Link"
        message="This secure portal link is invalid or has expired. Please request a new link from Printoms."
      />
    );
  }

  // ── DB Revocation check ──
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const admin = createAdminClient();

  let isRevoked: boolean;
  try {
    isRevoked = await isTokenRevoked(supabase, payload.jti);
  } catch {
    isRevoked = true; // treat DB errors as revoked for safety
  }

  if (isRevoked) {
    return (
      <PortalError
        title="Access Revoked"
        message="This portal link has been revoked. Please contact Printoms support for a new link."
      />
    );
  }

  // ── Fetch data from Supabase ──
  if (!admin) {
    return (
      <PortalError
        title="Server Configuration Error"
        message="Portal service is temporarily unavailable. Please contact support."
      />
    );
  }

  const { data: customerData, error: customerError } = await admin
    .from("customers")
    .select("*")
    .eq("customer_id", payload.customerId)
    .single();

  if (customerError || !customerData) {
    return (
      <PortalError
        title="Customer Not Found"
        message={`Could not locate a customer profile for ID ${payload.customerId}.`}
      />
    );
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
      quotationsData = qtsRes.data.filter((q) =>
        isQuotationVisibleToCustomer(q.status)
      );
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
    const hasOrder = ordersData.some((o) => o.order_id === payload.orderId);
    if (!hasOrder) {
      return (
        <PortalError
          title="Access Denied"
          message="You do not have permission to view the requested order details."
        />
      );
    }
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
      quoteDetails: q ? {
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
      } : null,
      design: toCustomerVisibleDesign(
        Array.isArray(o.designs) && o.designs.length > 0
          ? mapDesignFromDb(o.designs[0])
          : o.designs
            ? mapDesignFromDb(o.designs)
            : null
      ),
      productionDetails: Array.isArray(o.productions) && o.productions.length > 0 ? o.productions[0] : (o.productions || null),
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
    .select("site_visit_scheduling_enabled, installation_scheduling_enabled")
    .eq("company_id", customerData.company_id)
    .maybeSingle();

  const appSettings = {
    siteVisitSchedulingEnabled: settingsRow?.site_visit_scheduling_enabled ?? true,
    installationSchedulingEnabled: settingsRow?.installation_scheduling_enabled ?? true,
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
            PRINTOMS Signage Solutions
          </p>
        </div>
      </div>
    </div>
  );
}
