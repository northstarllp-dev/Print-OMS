import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import {
  verifyPortalToken,
  isTokenRevoked,
} from "@/utils/portal-tokens";
import { checkRateLimit } from "@/utils/rate-limiter";
import { Info, Clock, CheckCircle, Check, Loader2, PlayCircle, MapPin, Search } from "lucide-react";
import { mapSiteVisitFromDb, mapSiteVisitMeasurementFromDb } from "@/features/orders/actions/siteVisitMapper";
import { mapDesignFromDb } from "@/features/designs/actions/designMapper";
import { OrderDetailClient } from "./OrderDetailClient";
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

  // ── Rate limiting ──
  const clientIp = "anonymous";
  const rate = checkRateLimit(`portal-order-${clientIp}`);
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
        message="This secure portal link is invalid or has expired. Please request a new link."
      />
    );
  }

  // ── DB Revocation check ──
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  let isRevoked: boolean;
  try {
    isRevoked = await isTokenRevoked(supabase, payload.jti);
  } catch {
    isRevoked = true;
  }

  if (isRevoked) {
    return (
      <PortalError
        title="Access Revoked"
        message="This portal link has been revoked. Please contact Printoms support for a new link."
      />
    );
  }

  // ── Fetch data ──
  const { data: customerData, error: customerError } = await supabase
    .from("customers")
    .select("*")
    .eq("customer_id", payload.customerId)
    .single();

  if (customerError || !customerData) {
    return (
      <PortalError
        title="Customer Not Found"
        message={`Could not locate customer profile for ID ${payload.customerId}.`}
      />
    );
  }

  // Fetch the specific order
  const { data: orderData, error: orderError } = await supabase
    .from("orders")
    .select("*, site_visits(*, site_visit_measurements(*)), installations(*), productions(*), designs(*)")
    .eq("id", payload.orderId)
    .single();

  if (orderError || !orderData) {
    return (
      <PortalError
        title="Order Not Found"
        message={`Could not locate order with ID ${orderId}.`}
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

  // Fetch quotation for this order
  const { data: quotationData } = await supabase
    .from("quotations")
    .select("*")
    .eq("order_id", orderData.id)
    .maybeSingle();

  const quoteDetails = quotationData ? {
    id: quotationData.id,
    quotationId: quotationData.quotation_id,
    items: quotationData.items || [],
    signageOptions: quotationData.signage_options || [],
    discount: Number(quotationData.discount || 0),
    shipping: Number(quotationData.shipping || 0),
    subtotal: Number(quotationData.subtotal || 0),
    tax: Number(quotationData.tax || 0),
    grandTotal: Number(quotationData.grand_total || 0),
    status: quotationData.status,
    notes: quotationData.notes,
    terms: quotationData.terms,
  } : null;

  // Find the site visit for this order
  const { data: sv } = await supabase
    .from("site_visits")
    .select("id")
    .eq("order_id", orderData.id)
    .maybeSingle();

  // Fetch measurements from site_visit_measurements (include unit columns)
  const { data: siteVisitItemsData } = sv
    ? await supabase
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
    siteVisitDetails: mapSiteVisitFromDb(
      Array.isArray(orderData.site_visits)
        ? (orderData.site_visits.length > 0 ? orderData.site_visits[0] : null)
        : (orderData.site_visits || null)
    ),
    quoteDetails,
    design: (Array.isArray(orderData.designs) && orderData.designs.length > 0 ? mapDesignFromDb(orderData.designs[0]) : orderData.designs ? mapDesignFromDb(orderData.designs) : null),
    productionDetails: Array.isArray(orderData.productions) && orderData.productions.length > 0 ? orderData.productions[0] : (orderData.productions || null),
    installationDetails: Array.isArray(orderData.installations) && orderData.installations.length > 0 ? orderData.installations[0] : (orderData.installations || null),
    stageStatus: orderData.stage_status || null,
    stageAdminNotes: orderData.stage_admin_notes || null,
    orderCode: orderData.order_id || orderData.id,
    orderId: orderData.order_id || orderData.id,
  };

  return (
    <OrderDetailClient
      customer={customer}
      order={order}
      siteVisitItems={siteVisitItems}
      token={tokenParam}
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
