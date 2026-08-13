"use client";

import React, { useState, useEffect, useRef, useCallback, startTransition } from "react";
import dynamic from "next/dynamic";
import {
  ArrowLeft,
  MapPin,
  FileCheck,
  Layout,
  CreditCard,
  CheckCircle,
  Clock,
  Calendar,
  User,
  Check,
  RefreshCw,
  AlertCircle,
  Loader2,
  ArrowRight,
  Wrench,
  Info,
  X,
  Package,
  ZoomIn,
  ZoomOut,
  UploadCloud
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { establishPortalSession } from "../../establishPortalSession";
import { scheduleSiteVisitAction } from "@/features/orders/actions/orderActions";
import { isSkippedSiteVisit } from "@/features/orders/workspace/modules/site-visit/siteVisitUiLogic";
import {
  mergeOrderDetailPatch,
  useOrderDetailSync,
} from "@/features/orders/realtime/useOrderDetailSync";
import type { OrderDetailPatch } from "@/features/orders/realtime/orderDetailPatch";
import { useQuotationActions } from "@/app/portal/hooks/useQuotationActions";
import {
  didStageAdvance,
  getDetailTabPipeline,
  getTabForStage,
} from "@/app/portal/utils/portalStageNavigation";
import { ensureResolvedSiteLocation } from "@/components/maps/resolveGoogleMapsLocation";
import type { InvoiceProfile } from "@/features/quotations/types/invoiceProfile";
import { getStagesForOp, reorderModulesForWorkflowType } from "@/features/orders/businessOperations";
import type { BusinessStageKey } from "@/config/schema/businessOperations";

const DETAIL_TAB_META: Record<
  string,
  { label: string; icon: typeof MapPin }
> = {
  site_visit: { label: "Site Visit", icon: MapPin },
  quotation: { label: "Quotation", icon: FileCheck },
  design: { label: "Design", icon: Layout },
  payments: { label: "Payments", icon: CreditCard },
  billing: { label: "Invoice", icon: FileCheck },
};

const STAGE_LABELS: Record<string, string> = {
  enquiry: "Enquiries",
  site_visit: "Site Visit",
  quotation: "Quotations",
  design: "Design",
  production: "Production",
  installation: "Installation",
};

const TabFallback = () => (
  <div className="flex items-center justify-center py-16 text-sm text-slate-400">
    <Loader2 size={18} className="animate-spin mr-2" /> Loading…
  </div>
);

const QuotationTab = dynamic(
  () => import("@/app/portal/components/QuotationTab").then((m) => m.QuotationTab),
  { ssr: false, loading: TabFallback }
);
const InvoiceTab = dynamic(
  () => import("@/app/portal/components/InvoiceTab").then((m) => m.InvoiceTab),
  { ssr: false, loading: TabFallback }
);
const DesignTab = dynamic(
  () => import("@/app/portal/components/DesignTab").then((m) => m.DesignTab),
  { ssr: false, loading: TabFallback }
);
const PaymentsTab = dynamic(
  () => import("@/app/portal/components/PaymentsTab").then((m) => m.PaymentsTab),
  { ssr: false, loading: TabFallback }
);
const SiteVisitLocationPicker = dynamic(
  () =>
    import("@/app/portal/components/SiteVisitLocationPicker").then(
      (m) => m.SiteVisitLocationPicker
    ),
  { ssr: false, loading: () => (
    <div className="h-40 rounded-xl border border-gray-200 bg-gray-50 flex items-center justify-center text-xs text-slate-500">
      Loading map…
    </div>
  ) }
);

// Default center: India/Bangalore as an example
const defaultCenter = {
  lat: 12.9716,
  lng: 77.5946
};

interface Customer {
  id: string;
  name: string;
  phone: string;
  whatsapp: string;
  email: string;
  city?: string;
  billingAddress: string;
  shippingAddress: string;
  status?: string;
  customerCode?: string;
  customerId?: string;
}

interface Order {
  id: string;
  clientName: string;
  businessName: string;
  customerId: string;
  customerName?: string;
  stage: string;
  assignedEmployees: string[];
  dateCreated: string;
  versionHistory: any[];
  chatHistory: any[];
  siteVisitDetails?: any;
  quoteDetails?: any;
  invoiceDetails?: any;
  design?: any;
  productionDetails?: any;
  installationDetails?: any;
  stageStatus?: string;
  stageAdminNotes?: string;
  orderCode?: string;
  orderId?: string;
  workflow_type?: string;
  business_operation?: string;
}

interface OrderDetailClientProps {
  customer: Customer;
  order: Order;
  siteVisitItems?: any[];
  token: string;
  invoiceProfile?: InvoiceProfile | null;
}

export function OrderDetailClient({ customer, order: initialOrder, siteVisitItems = [], token, invoiceProfile = null }: OrderDetailClientProps) {
  const [order, setOrder] = useState(initialOrder);
  const businessOperation = order.business_operation || "signage";
  const workflowType = order.workflow_type || null;

  const stages = reorderModulesForWorkflowType(
    getStagesForOp(businessOperation) as BusinessStageKey[],
    workflowType
  ).map((key) => STAGE_LABELS[key] || key);

  const tabs = getDetailTabPipeline(businessOperation, workflowType).map((id) => {
    const meta = DETAIL_TAB_META[id] || { label: id, icon: FileCheck };
    return { id, label: meta.label, icon: meta.icon };
  });

  // Initial tab follows server-rendered stage; realtime advances switch forward only (below).
  const [activeTab, setActiveTab] = useState(() =>
    getTabForStage(
      initialOrder.stage || "",
      initialOrder.business_operation || "signage",
      initialOrder.workflow_type
    )
  );
  const orderRef = useRef(order);
  orderRef.current = order;
  const prevStageRef = useRef(order.stage);

  useEffect(() => {
    setOrder(initialOrder);
  }, [initialOrder]);

  // Establish HttpOnly portal_session cookie (required for design/quote server actions).
  useEffect(() => {
    establishPortalSession(token);
  }, [token]);

  // Follow pipeline forward when staff advances stage (realtime or refresh).
  useEffect(() => {
    const prevStage = prevStageRef.current || "";
    const nextStage = order.stage || "";
    const op = order.business_operation || businessOperation;
    const wt = order.workflow_type || workflowType;
    if (!didStageAdvance(prevStage, nextStage, op, wt)) {
      prevStageRef.current = nextStage;
      return;
    }
    prevStageRef.current = nextStage;
    const nextTab = getTabForStage(nextStage, op, wt);
    startTransition(() => {
      setActiveTab(nextTab);
      setMountedTabs((prev) => {
        if (prev.has(nextTab)) return prev;
        const next = new Set(prev);
        next.add(nextTab);
        return next;
      });
    });
  }, [order.stage, order.business_operation, order.workflow_type, businessOperation, workflowType]);

  const applyPortalPatch = useCallback((patch: OrderDetailPatch) => {
    setOrder((prev) => mergeOrderDetailPatch(prev, patch));
  }, []);

  // Supabase realtime (instant when portal anon RLS policies are present).
  useOrderDetailSync({
    orderId: order.id,
    businessOrderId: order.orderId || order.orderCode || order.id,
    siteVisitId: order.siteVisitDetails?.id ?? null,
    enabled: Boolean(order.id),
    getOrderSnapshot: () => orderRef.current as unknown as Record<string, unknown>,
    onPatch: applyPortalPatch,
  });

  const [products, setProducts] = useState<any[]>([]);
  const [selectedProductInfo, setSelectedProductInfo] = useState<any | null>(null);
  const [mountedTabs, setMountedTabs] = useState<Set<string>>(
    () =>
      new Set([
        getTabForStage(
          initialOrder.stage || "",
          initialOrder.business_operation || "signage",
          initialOrder.workflow_type
        ),
      ])
  );

  const {
    quoteFeedback,
    setQuoteFeedback,
    showQuoteDeclineInput,
    setShowQuoteDeclineInput,
    updatingStatus,
    actionError,
    handleApproveQuote,
    handleDeclineQuote,
  } = useQuotationActions(order?.id ?? "", customer.name, setOrder, token);

  const selectTab = useCallback((tabId: string) => {
    startTransition(() => {
      setActiveTab(tabId);
      setMountedTabs((prev) => {
        if (prev.has(tabId)) return prev;
        const next = new Set(prev);
        next.add(tabId);
        return next;
      });
    });
  }, []);

  // Only fetch products when quotation tab is opened (not on every portal load).
  useEffect(() => {
    if (!mountedTabs.has("quotation") || products.length > 0) return;
    const supabase = createClient();
    let cancelled = false;
    void supabase
      .from("products")
      .select("*")
      .eq("is_active", true)
      .then(({ data }) => {
        if (!cancelled && data) setProducts(data);
      });
    return () => {
      cancelled = true;
    };
  }, [mountedTabs, products.length]);
  
  // Site Visit scheduling states
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [siteAddress, setSiteAddress] = useState(customer.shippingAddress || "");
  const [gpsCoords, setGpsCoords] = useState("12.9716, 77.5946");
  const [isRescheduling, setIsRescheduling] = useState(false);
  const [schedulingLoading, setSchedulingLoading] = useState(false);

  const [markerPosition, setMarkerPosition] = useState(defaultCenter);
  const [mapCenter, setMapCenter] = useState(defaultCenter);

  const applyLocation = useCallback((lat: number, lng: number, address?: string) => {
    setMarkerPosition({ lat, lng });
    setMapCenter({ lat, lng });
    setGpsCoords(`${lat.toFixed(6)}, ${lng.toFixed(6)}`);
    if (address) setSiteAddress(address);
  }, []);

  // Make sure we map the order stage to our stages array
  const stageMapping: Record<string, string> = {
    "Site Visit Pending": "Enquiries",
    "Site Visit Scheduled": "Site Visit",
    "Site Visit Completed": "Site Visit",
    "Quotation In Progress": "Quotations",
    "Quotation Sent": "Quotations",
    "Quotation Negotiation": "Quotations",
    "Quotation Approved": "Quotations",
    "Design In Progress": "Design",
    "Design Approved": "Design",
    "Production": "Production",
    "Ready For Installation": "Installation",
    "Installation Scheduled": "Installation",
    "Completed": "Installation",
    "Closed": "Installation",
  };
  const mappedStage = stageMapping[order.stage] || "Enquiries";
  const currentStageIndex = stages.indexOf(mappedStage) !== -1 ? stages.indexOf(mappedStage) : 0;
  const sv = order.siteVisitDetails || {};
  const qd = order.quoteDetails || {};
  const dd = order.design || {};

  // Sync site visit details
  useEffect(() => {
    if (order?.siteVisitDetails) {
      const sv = order.siteVisitDetails;
      setSelectedDate(sv.auditDate || "");
      setSelectedTime(sv.auditTime || "");
      setSiteAddress(sv.customerAddress || customer.shippingAddress || "");
      setGpsCoords(sv.gpsLocation || "12.9716° N, 77.5946° E");
    }
  }, [order.id, order.siteVisitDetails]);

  const getBusinessDays = () => {
    const days: Date[] = [];
    const cur = new Date();
    while (days.length < 7) {
      cur.setDate(cur.getDate() + 1);
      if (cur.getDay() !== 0) days.push(new Date(cur));
    }
    return days;
  };

  const isSlotBooked = (date: string, time: string) => false;

  const handleScheduleSiteVisit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!order || !selectedDate || !selectedTime || !siteAddress) return;
    setSchedulingLoading(true);
    try {
      const location = await ensureResolvedSiteLocation({
        customerAddress: siteAddress,
        gpsLocation: gpsCoords,
      });
      setSiteAddress(location.customerAddress);
      setGpsCoords(location.gpsLocation);
      const payload = {
        auditDate: selectedDate,
        auditTime: selectedTime,
        customerAddress: location.customerAddress,
        gpsLocation: location.gpsLocation,
        completed: false,
        reviewStatus: "Pending" as const,
      };
      const res = await scheduleSiteVisitAction(order.id, payload, token);
      if (res.success && res.order) {
        setOrder(prev => ({ ...prev, stage: res.order.stage, siteVisitDetails: res.order.siteVisitDetails }));
        setIsRescheduling(false);
      }
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : "Failed to confirm site visit. Please try again.");
    }
    finally { setSchedulingLoading(false); }
  };

  const handleBackToPortal = () => {
    const url = new URL("/printoms/portal", window.location.origin);
    url.searchParams.set("customer_id", customer.customerId || customer.id);
    url.searchParams.set("token", token);
    window.location.href = url.toString();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-3 sm:py-4 flex items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0">
            <button
              onClick={handleBackToPortal}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors shrink-0"
            >
              <ArrowLeft size={20} className="text-gray-600" />
            </button>
            <div className="min-w-0">
              <h1 className="text-base sm:text-2xl font-extrabold text-gray-900 truncate">{order.businessName} - {order.clientName}</h1>
              <p className="text-xs sm:text-sm text-gray-500">Order {order.orderCode || order.id}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className={`px-2.5 sm:px-3 py-1 rounded-full text-[10px] sm:text-xs font-bold whitespace-nowrap ${
              currentStageIndex >= 2
                ? "bg-green-50 text-green-700 border border-green-200"
                : "bg-blue-50 text-blue-700 border border-blue-200"
            }`}>
              {order.stage}
            </span>
          </div>
        </div>
      </header>

      {/* Progress Bar */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-6">
          <div className="flex items-center gap-1 sm:justify-between overflow-x-auto pb-1 -mx-1 px-1">
            {stages.map((stage, idx) => {
              const isCompleted = idx < currentStageIndex;
              const isActive = idx === currentStageIndex;
              
              const tabMap: Record<string, string> = {
                "Enquiries": "site_visit",
                "Site Visit": "site_visit",
                "Quotations": "quotation",
                "Design": "design",
                "Production": "billing",
                "Installation": "billing"
              };
              
              const targetTab = tabMap[stage];
              const isTabActive = activeTab === targetTab;
              
              const iconMap: Record<string, any> = {
                "Enquiries": CheckCircle,
                "Site Visit": MapPin,
                "Quotations": FileCheck,
                "Design": Layout,
                "Production": Package,
                "Installation": Wrench
              };
              
              const Icon = iconMap[stage] || CheckCircle;

              return (
                <React.Fragment key={idx}>
                  <button
                    onClick={() => selectTab(targetTab)}
                    className="flex flex-col items-center gap-1.5 sm:gap-2 focus:outline-none focus:ring-4 focus:ring-blue-200 rounded-xl p-1.5 sm:p-2 shrink-0"
                    style={{ cursor: "pointer" }}
                  >
                    <div
                      className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center transition-all ${
                        isTabActive || isActive
                          ? "bg-blue-500 text-white"
                          : isCompleted
                            ? "bg-emerald-500 text-white"
                            : "bg-gray-200 text-gray-400"
                      } hover:scale-110`}
                    >
                      <Icon size={16} />
                    </div>
                    <span
                      className={`text-[9px] sm:text-sm font-semibold max-w-[3.5rem] sm:max-w-none text-center leading-tight ${
                        isTabActive || isActive
                          ? "text-blue-600"
                          : isCompleted
                            ? "text-green-600"
                            : "text-gray-500"
                      }`}
                    >
                      {stage}
                    </span>
                  </button>
                  {idx < stages.length - 1 && (
                    <div className={`hidden sm:block flex-1 h-1 mx-2 sm:mx-4 rounded-full ${
                      idx < currentStageIndex ? "bg-green-500" : "bg-gray-200"
                    }`} />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-3 sm:px-6">
          <div className="flex gap-2 overflow-x-auto py-2 scrollbar-none">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => selectTab(tab.id)}
                  className={`px-3 sm:px-5 py-2.5 sm:py-3 rounded-lg text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 whitespace-nowrap shrink-0 ${
                    activeTab === tab.id
                      ? "bg-blue-50 text-blue-600 border border-blue-200"
                      : "text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  <Icon size={16} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Tab Content */}
      <main className="max-w-7xl mx-auto px-3 sm:px-6 py-5 sm:py-8 pb-24">
        {activeTab === "site_visit" && (
          <div className="space-y-6">
            {isSkippedSiteVisit(sv) ? (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-center">
                <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <CheckCircle size={24} className="text-amber-600" />
                </div>
                <h2 className="text-xl font-black text-amber-900 mb-2">Site Visit Skipped</h2>
                <p className="text-sm text-amber-700 max-w-md mx-auto">
                  The site visit has been skipped by our team. We will directly proceed with adding measurements for your project.
                </p>
              </div>
            ) : (!sv.auditDate || isRescheduling) ? (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-black text-gray-900 mb-1.5">
                    Schedule Your Physical Site Audit
                  </h2>
                  <p className="text-sm text-gray-500 leading-relaxed max-w-lg">
                    Our technical survey team needs to verify dimensions and substrate conditions before we can finalize the structural design. Estimated duration: 45 mins.
                  </p>
                </div>

                <form onSubmit={handleScheduleSiteVisit} className="space-y-5">
                  {/* Date Picker */}
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
                      Pick a Date
                    </label>
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {getBusinessDays().map((day, idx) => {
                        const ds = day.toISOString().split("T")[0];
                        const dayName = day.toLocaleDateString("en-US", { weekday: "short" });
                        const monthName = day.toLocaleDateString("en-US", { month: "short" });
                        const selected = selectedDate === ds;
                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => { setSelectedDate(ds); setSelectedTime(""); }}
                            className={`flex flex-col items-center p-3 rounded-xl border text-center min-w-[64px] transition-all cursor-pointer ${
                              selected
                                ? "bg-blue-50 border-blue-600 text-blue-600 ring-2 ring-blue-100"
                                : "bg-white border-gray-200 text-gray-600 hover:border-gray-300"
                            }`}
                          >
                            <span className="text-[9px] uppercase tracking-wider text-gray-400">{dayName}</span>
                            <span className="text-sm font-black mt-0.5">{day.getDate()}</span>
                            <span className="text-[9px] text-gray-400">{monthName}</span>
                          </button>
                        );
                      })}
                    </div>

                    {selectedDate && (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 mt-3">
                        {["10 AM - 11 AM", "11 AM - 12 PM", "12 PM - 1 PM", "1 PM - 2 PM", "2 PM - 3 PM", "3 PM - 4 PM", "4 PM - 5 PM"].map(slot => {
                          const booked = isSlotBooked(selectedDate, slot);
                          const sel = selectedTime === slot;
                          return (
                            <button
                              key={slot}
                              type="button"
                              disabled={booked}
                              onClick={() => setSelectedTime(slot)}
                              className={`py-2.5 rounded-xl border text-xs font-bold transition-all ${
                                booked ? "bg-gray-50 border-gray-100 text-gray-300 cursor-not-allowed"
                                  : sel ? "bg-blue-50 border-blue-600 text-blue-600 ring-2 ring-blue-100"
                                    : "bg-white border-gray-200 text-gray-600 hover:border-gray-300 cursor-pointer"
                              }`}
                            >
                              {slot}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Location */}
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                      Choose Location in Maps
                    </label>
                    <SiteVisitLocationPicker
                      siteAddress={siteAddress}
                      onAddressChange={setSiteAddress}
                      gpsCoords={gpsCoords}
                      onLocationChange={applyLocation}
                      markerPosition={markerPosition}
                      mapCenter={mapCenter}
                    />
                  </div>

                  <div className="flex items-center gap-3 pt-2">
                    <button
                      type="submit"
                      disabled={!selectedDate || !selectedTime || schedulingLoading}
                      className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 transition-all disabled:opacity-50 shadow-sm"
                    >
                      {schedulingLoading ? <Loader2 size={14} className="animate-spin" /> : null}
                      Confirm Site Visit
                      <Check size={14} />
                    </button>
                  </div>
                </form>
              </div>
            ) : sv.completed === false ? (
              // Scheduled confirmation
              <div className="text-center space-y-5 py-4">
                <div className="w-14 h-14 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center mx-auto">
                  <Check size={24} className="text-emerald-600 stroke-[3]" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-gray-900">Site Visit Scheduled</h2>
                  <p className="text-sm text-gray-500 mt-1">Our team will arrive at the scheduled time.</p>
                </div>
                <div className="max-w-sm mx-auto bg-gray-50 border border-gray-200 rounded-xl p-4 text-left grid grid-cols-2 gap-3 text-xs">
                  <div><span className="text-[10px] text-gray-400 uppercase font-bold block">Date</span><p className="font-bold text-gray-800 font-mono mt-0.5">{sv.auditDate}</p></div>
                  <div><span className="text-[10px] text-gray-400 uppercase font-bold block">Time</span><p className="font-bold text-gray-800 font-mono mt-0.5">{sv.auditTime}</p></div>
                  <div className="col-span-2">
                    <span className="text-[10px] text-gray-400 uppercase font-bold block">Address</span>
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(sv.customerAddress || "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-indigo-600 hover:text-indigo-800 hover:underline mt-0.5 block"
                    >
                      {sv.customerAddress}
                    </a>
                  </div>
                </div>
                <button onClick={() => setIsRescheduling(true)} className="px-4 py-2 border border-gray-200 text-gray-600 rounded-xl text-xs font-bold hover:bg-gray-50 transition-all flex items-center gap-2 mx-auto">
                  <RefreshCw size={12} /> Reschedule Appointment
                </button>
              </div>
            ) : (
              // Completed or pending approval
              <div className="space-y-6">
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-start gap-3">
                  <CheckCircle size={18} className="text-emerald-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-emerald-800">Site Survey Completed</p>
                    <p className="text-xs text-emerald-700 mt-0.5">Below are the finalized measurements and details collected by our engineering team.</p>
                  </div>
                </div>

                <div className="space-y-4">
                  {(sv.locations || []).map((loc: any, idx: number) => (
                    <div key={loc.id || idx} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                      <div className="bg-gray-50 border-b border-gray-200 px-4 py-3 font-bold text-gray-800 flex justify-between items-center">
                        <span>{loc.name || `Location ${idx + 1}`}</span>
                      </div>
                      <div className="p-4 space-y-4">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          <div className="bg-gray-50 rounded-lg p-2.5 text-center">
                            <span className="text-[10px] uppercase font-bold text-gray-400 block mb-1">Width</span>
                            <span className="text-sm font-mono font-bold text-gray-800">{loc.width ? `${loc.width} ${loc.widthUnit || 'ft'}` : '-'}</span>
                          </div>
                          <div className="bg-gray-50 rounded-lg p-2.5 text-center">
                            <span className="text-[10px] uppercase font-bold text-gray-400 block mb-1">Height</span>
                            <span className="text-sm font-mono font-bold text-gray-800">{loc.height ? `${loc.height} ${loc.heightUnit || 'ft'}` : '-'}</span>
                          </div>
                          <div className="bg-gray-50 rounded-lg p-2.5 text-center">
                            <span className="text-[10px] uppercase font-bold text-gray-400 block mb-1">Depth</span>
                            <span className="text-sm font-mono font-bold text-gray-800">{loc.depth ? `${loc.depth} ${loc.depthUnit || 'ft'}` : '-'}</span>
                          </div>
                          <div className="bg-gray-50 rounded-lg p-2.5 text-center">
                            <span className="text-[10px] uppercase font-bold text-gray-400 block mb-1">Clearance</span>
                            <span className="text-sm font-mono font-bold text-gray-800">{loc.groundClearance ? `${loc.groundClearance} ${loc.groundClearanceUnit || 'ft'}` : '-'}</span>
                          </div>
                        </div>

                        {loc.notes && (
                          <div className="text-xs text-gray-600 bg-gray-50 p-3 rounded-lg">
                            <span className="font-bold text-gray-800 block mb-1">Notes</span>
                            {loc.notes}
                          </div>
                        )}

                        {loc.photos && loc.photos.length > 0 && (
                          <div>
                            <span className="text-[10px] uppercase font-bold text-gray-400 block mb-2">Photos</span>
                            <div className="flex gap-2 overflow-x-auto pb-2">
                              {loc.photos.map((url: string, i: number) => (
                                <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="block w-20 h-20 shrink-0 rounded-lg border border-gray-200 overflow-hidden hover:opacity-80 transition-opacity">
                                  <img src={url} alt="Site Photo" className="w-full h-full object-cover" />
                                </a>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  
                  {(!sv.locations || sv.locations.length === 0) && (
                    <div className="text-center py-8 text-gray-500 text-sm">
                      No specific location data recorded.
                    </div>
                  )}
                </div>

                {/* ── Installation Requirements ── */}
                {(sv.scaffoldingRequired || sv.craneRequired || sv.overnightInstallation !== undefined) && (
                  <div className="bg-white border border-gray-200 rounded-xl p-4">
                    <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-3">Installation Requirements</p>
                    <div className="flex flex-wrap gap-2">
                      {sv.scaffoldingRequired && (
                        <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200">🏗️ Scaffolding Required</span>
                      )}
                      {sv.craneRequired && (
                        <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-purple-50 text-purple-700 border border-purple-200">🏗️ Crane Required</span>
                      )}
                      {sv.overnightInstallation !== undefined && (
                        <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${sv.overnightInstallation ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-gray-100 text-gray-500 border-gray-200"}`}>
                          🌙 Overnight: {sv.overnightInstallation ? "Yes" : "No"}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* ── Fabrication Requirements ── */}
                {(sv.extraAnglesRequired !== undefined || sv.extraAcpSheetRequired !== undefined || sv.oldBoardRemovalRequired !== undefined || sv.extraWireRequired !== undefined) && (
                  <div className="bg-white border border-gray-200 rounded-xl p-4">
                    <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-3">Fabrication Requirements</p>
                    <div className="space-y-2">
                      {[
                        { label: "Extra Angles Required", value: sv.extraAnglesRequired, note: sv.extraAnglesRequired && sv.extraAnglesLength ? ` — ${sv.extraAnglesLength}` : "" },
                        { label: "Extra ACP Sheet to Cover Gap", value: sv.extraAcpSheetRequired },
                        { label: "Old Board Removal", value: sv.oldBoardRemovalRequired },
                        { label: "Extra Wire Required", value: sv.extraWireRequired },
                      ].filter(item => item.value !== undefined).map(item => (
                        <div key={item.label} className="flex items-center justify-between text-xs">
                          <span className="text-gray-700 font-medium">{item.label}{"note" in item ? item.note : ""}</span>
                          <span className={`font-bold px-2 py-0.5 rounded-full border text-[10px] ${item.value ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-gray-100 text-gray-500 border-gray-200"}`}>
                            {item.value ? "Yes" : "No"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── Design Inputs ── */}
                {(sv.designBriefAvailable || sv.fabricationRequired !== undefined || sv.civilWorkRequired !== undefined) && (
                  <div className="bg-white border border-gray-200 rounded-xl p-4">
                    <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-3">Design Inputs</p>
                    <div className="space-y-2">
                      {sv.designBriefAvailable && (
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-700 font-medium">Design Brief Available</span>
                          <span className="font-bold px-2 py-0.5 rounded-full border text-[10px] bg-indigo-50 text-indigo-700 border-indigo-200">{sv.designBriefAvailable}</span>
                        </div>
                      )}
                      {sv.fabricationRequired !== undefined && (
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-700 font-medium">Fabrication Required</span>
                          <span className={`font-bold px-2 py-0.5 rounded-full border text-[10px] ${sv.fabricationRequired ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-gray-100 text-gray-500 border-gray-200"}`}>{sv.fabricationRequired ? "Yes" : "No"}</span>
                        </div>
                      )}
                      {sv.civilWorkRequired !== undefined && (
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-700 font-medium">Civil Work Required</span>
                          <span className={`font-bold px-2 py-0.5 rounded-full border text-[10px] ${sv.civilWorkRequired ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-gray-100 text-gray-500 border-gray-200"}`}>{sv.civilWorkRequired ? "Yes" : "No"}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        {mountedTabs.has("quotation") && (
          <div hidden={activeTab !== "quotation"}>
            <QuotationTab
              order={order}
              products={products}
              siteVisitItems={siteVisitItems}
              setSelectedProductInfo={setSelectedProductInfo}
              showQuoteDeclineInput={showQuoteDeclineInput}
              setShowQuoteDeclineInput={setShowQuoteDeclineInput}
              quoteFeedback={quoteFeedback}
              setQuoteFeedback={setQuoteFeedback}
              updatingStatus={updatingStatus}
              actionError={actionError}
              handleApproveQuote={handleApproveQuote}
              handleDeclineQuote={handleDeclineQuote}
              invoiceProfile={invoiceProfile}
              billingAddress={customer.billingAddress}
              customerCity={customer.city}
            />
          </div>
        )}
        {mountedTabs.has("design") && (
          <div hidden={activeTab !== "design"}>
            <DesignTab
              order={order}
              customer={customer}
              siteVisitItems={siteVisitItems}
              portalToken={token}
              onDesignUpdated={(design) => setOrder((prev) => ({ ...prev, design }))}
            />
          </div>
        )}
        {mountedTabs.has("payments") && (
          <div hidden={activeTab !== "payments"}>
            <PaymentsTab orderId={order.id} />
          </div>
        )}
        {mountedTabs.has("billing") && (
          <div hidden={activeTab !== "billing"}>
            <InvoiceTab
              order={order}
              invoiceDetails={order.invoiceDetails}
              invoiceProfile={invoiceProfile}
              billingAddress={customer.billingAddress}
              customerCity={customer.city}
            />
          </div>
        )}
      </main>

      {selectedProductInfo && (
        <ProductInfoModal
          product={selectedProductInfo}
          onClose={() => setSelectedProductInfo(null)}
        />
      )}
    </div>
  );
}



// ─────────────────────────────────────────────────────────────────────────────
// Product Info Popup Modal Component (identical to PortalClient.tsx)
// ─────────────────────────────────────────────────────────────────────────────
function ProductInfoModal({ product, onClose }: { product: any; onClose: () => void }) {
  const [activeImgIdx, setActiveImgIdx] = useState(0);
  const images = product.images && product.images.length > 0 ? product.images : [];

  return (
    <div 
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.6)",
        backdropFilter: "blur(4px)",
        zIndex: 99999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
      }}
    >
      <div 
        style={{
          backgroundColor: "white",
          borderRadius: "24px",
          maxWidth: "500px",
          width: "100%",
          overflow: "hidden",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
          border: "1px solid #f1f5f9",
          display: "flex",
          flexDirection: "column",
          maxHeight: "90vh",
        }}
      >
        {/* Header */}
        <div 
          style={{
            padding: "16px 24px",
            borderBottom: "1px solid #f1f5f9",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            backgroundColor: "#f8fafc",
          }}
        >
          <div>
            <h4 style={{ margin: 0, fontSize: "14px", fontWeight: 900, color: "#1e293b", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              {product.name}
            </h4>
            <span style={{ fontSize: "10px", color: "#94a3b8", fontWeight: 700, textTransform: "uppercase", marginTop: "2px", display: "block" }}>
              {product.product_id} • {product.category || "General"}
            </span>
          </div>
          <button 
            onClick={onClose} 
            style={{
              padding: "6px",
              backgroundColor: "transparent",
              border: "none",
              cursor: "pointer",
              borderRadius: "9999px",
              color: "#94a3b8",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#e2e8f0"; e.currentTarget.style.color = "#475569"; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; e.currentTarget.style.color = "#94a3b8"; }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Scrollable Content */}
        <div style={{ padding: "24px", overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* Images Section */}
          {images.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <div 
                style={{
                  aspectRatio: "16/9",
                  backgroundColor: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  borderRadius: "16px",
                  overflow: "hidden",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  position: "relative",
                }}
              >
                <img
                  src={images[activeImgIdx]}
                  alt={product.name}
                  style={{ maxHeight: "100%", maxWidth: "100%", objectFit: "contain" }}
                  onError={(e) => { e.currentTarget.src = "https://images.unsplash.com/photo-1542744094-3a31f103e35f?w=400&auto=format&fit=crop"; }}
                />
              </div>
              {images.length > 1 && (
                <div style={{ display: "flex", gap: "8px", overflowX: "auto", paddingBottom: "4px" }}>
                  {images.map((img: string, idx: number) => (
                    <button
                      key={idx}
                      onClick={() => setActiveImgIdx(idx)}
                      style={{
                        width: "56px",
                        height: "56px",
                        borderRadius: "8px",
                        overflow: "hidden",
                        border: activeImgIdx === idx ? "2px solid #2563eb" : "2px solid #cbd5e1",
                        padding: 0,
                        backgroundColor: "transparent",
                        cursor: "pointer",
                        flexShrink: 0,
                        transition: "all 0.2s",
                      }}
                    >
                      <img src={img} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div 
              style={{
                aspectRatio: "16/9",
                backgroundColor: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: "16px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                color: "#cbd5e1",
                gap: "4px",
              }}
            >
              <Package size={32} style={{ strokeWidth: 1.5 }} />
              <span style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase" }}>No images uploaded</span>
            </div>
          )}

          {/* Pricing Info */}
          <div 
            style={{
              backgroundColor: "rgba(219, 234, 254, 0.3)",
              border: "1px solid #dbeafe",
              borderRadius: "16px",
              padding: "16px",
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "16px",
            }}
          >
            <div>
              <span style={{ fontSize: "9px", color: "#94a3b8", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.05em", display: "block" }}>Pricing Type</span>
              <span style={{ fontSize: "12px", fontWeight: 800, color: "#334155", textTransform: "capitalize", display: "block", marginTop: "2px" }}>
                {product.pricing_type?.replace("_", " ")}
              </span>
            </div>
            <div>
              <span style={{ fontSize: "9px", color: "#94a3b8", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.05em", display: "block" }}>Standard Rate</span>
              <span style={{ fontSize: "12px", fontWeight: 900, color: "#1d4ed8", fontFamily: "monospace", display: "block", marginTop: "2px" }}>
                ₹{(product.price_per_unit || product.price_per_sqft || 0).toLocaleString("en-IN")}
                <span style={{ fontSize: "10px", color: "#94a3b8", fontWeight: 500, fontFamily: "sans-serif" }}>
                  /{product.pricing_type === "per_sqft" ? "sqft" : "unit"}
                </span>
              </span>
            </div>
          </div>

          {/* Additional details */}
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <span style={{ fontSize: "9px", color: "#94a3b8", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.05em" }}>Product Description</span>
            <p style={{ margin: 0, fontSize: "12px", color: "#475569", lineHeight: 1.6, fontWeight: 500 }}>
              High-quality {product.name} suitable for premium indoor and outdoor signage applications. Manufactured with durable materials to ensure long-lasting visibility and brand representation.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div 
          style={{
            padding: "12px 24px",
            borderTop: "1px solid #f1f5f9",
            backgroundColor: "#f8fafc",
            display: "flex",
            justifyContent: "end",
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: "8px 16px",
              backgroundColor: "#1e293b",
              color: "white",
              border: "none",
              borderRadius: "12px",
              fontSize: "12px",
              fontWeight: 700,
              cursor: "pointer",
              transition: "background-color 0.2s",
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#0f172a"}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "#1e293b"}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
