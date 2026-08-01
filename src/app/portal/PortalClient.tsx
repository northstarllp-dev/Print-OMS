"use client";

import Image from "next/image";
import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { GoogleMap, useJsApiLoader, Autocomplete } from "@react-google-maps/api";
import { AdvancedMapMarker } from "@/components/maps/AdvancedMapMarker";
import {
  GOOGLE_MAPS_DEFAULT_OPTIONS,
  GOOGLE_MAPS_LIBRARIES,
  GOOGLE_MAPS_SCRIPT_ID,
} from "@/components/maps/googleMapsConfig";
import { isGoogleMapsUrl } from "@/components/maps/mapsUrl";
import {
  ensureResolvedSiteLocation,
  resolveGoogleMapsLocation,
} from "@/components/maps/resolveGoogleMapsLocation";

const containerStyle = {
  width: "100%",
  height: "100%"
};

// Default center: India/Bangalore as an example
const defaultCenter = {
  lat: 12.9716,
  lng: 77.5946
};
import {
  Printer, MapPin, FileText, CheckSquare, CheckCircle2,
  ZoomIn, ZoomOut, Check, X, Info,
  AlertCircle, Calendar,
  ChevronLeft, ChevronRight, Phone,
  Package, Wrench, Palette, BarChart3, CreditCard,
  RefreshCw, AlertTriangle, Loader2,
  Download, CalendarDays, Hammer
} from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { PlatformMadeWithLove } from "@/components/ui/PlatformMadeWithLove";
import { withBasePath } from "@/lib/appBasePath";
import { loadClientConfig } from "@/config/loadClientConfig";
import { createClient } from "@/utils/supabase/client";
import { scheduleSiteVisitAction } from "@/features/orders/actions/orderActions";
import { getAppSettings } from "@/features/settings/actions/settingsActions";
import {
  DEFAULT_PRODUCTION_CHECKLIST_ITEMS,
  resolveChecklistProgress,
  type ProductionChecklistItem,
} from "@/features/settings/productionChecklist";
import { formatSiteMeasurementLabel } from "@/features/orders/actions/siteVisitMapper";
import {
  mergeOrderDetailPatch,
  useOrderDetailSync,
} from "@/features/orders/realtime/useOrderDetailSync";
import type { OrderDetailPatch } from "@/features/orders/realtime/orderDetailPatch";
import { PaymentsTab } from "./components/PaymentsTab";
import { QuotationTab } from "./components/QuotationTab";
import { useQuotationActions } from "./hooks/useQuotationActions";
import { InstallationScheduleModule } from "@/features/installations/components/InstallationScheduleModule";
import { DesignTab } from "./components/DesignTab";
import type { InvoiceProfile } from "@/features/quotations/types/invoiceProfile";

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
  budget: number;
  depositPaid: number;
  dimensions: string;
  notes: string;
  productType?: string;
  requirements?: string;
  assignedEmployees: string[];
  dateCreated: string;
  imageMockup: string;
  versionHistory: any[];
  chatHistory: any[];
  siteVisitDetails?: any;
  quoteDetails?: any;
  design?: any;
  productionDetails?: any;
  installationDetails?: any;
  stageStatus?: string;
  stageAdminNotes?: string;
  orderCode?: string;
  orderId?: string;
  workflow_type?: string;
  // New quotation workflow fields

  siteVisitItems?: Array<{
    id: string;
    name: string;
    width?: number | null;
    widthUnit?: string | null;
    height?: number | null;
    heightUnit?: string | null;
    depth?: number | null;
    depthUnit?: string | null;
    notes?: string | null;
  }>;
  materialPreferences?: any[];
}

interface PortalClientProps {
  customer: any;
  orders: any[];
  quotations?: any[];
  initialToken: string;
  initialActiveOrderId: string | null;
  token: string;
  appSettings?: {
    siteVisitSchedulingEnabled: boolean;
    installationSchedulingEnabled: boolean;
    invoiceProfile?: InvoiceProfile;
  };
}

// We moved STEPS inside the component to be dynamic
function getStepIndex(stage: string, workflowType: string = "quote_first"): number {
  const s = (stage || "").toLowerCase();
  const isDesignFirst = workflowType === "design_first";

  if (s.includes("site visit")) return 1;
  if (isDesignFirst) {
    if (s.includes("design")) return 2;
    if (s.includes("quotation")) return 3;
  } else {
    if (s.includes("quotation")) return 2;
    if (s.includes("design")) return 3;
  }
  // Installation stages before "ready" — "Ready For Installation" contains both.
  if (s.includes("installation") || s.includes("completed") || s.includes("closed")) return 5;
  if (s.includes("production") || s.includes("fabricat")) return 4;
  return 0;
}

export function PortalClient({ customer, orders: initialOrders, quotations = [], initialActiveOrderId, token, appSettings }: PortalClientProps) {
  const [orders, setOrders] = useState<Order[]>(initialOrders);

  useEffect(() => {
    setOrders(initialOrders);
  }, [initialOrders]);

  const initialOrder = initialOrders.find(
    o => o.id === initialActiveOrderId || o.orderId === initialActiveOrderId || o.orderCode === initialActiveOrderId
  ) || initialOrders[0];

  const [activeOrderId, setActiveOrderId] = useState<string>(
    initialOrder?.id || ""
  );

  const activeOrder = orders.find(o => o.id === activeOrderId) || orders[0];
  const activeOrderRef = useRef(activeOrder);
  activeOrderRef.current = activeOrder;

  const applyPortalPatch = useCallback((patch: OrderDetailPatch) => {
    const targetId = activeOrderRef.current?.id;
    if (!targetId) return;
    setOrders((prev) =>
      prev.map((o) =>
        o.id === targetId ? mergeOrderDetailPatch(o, patch) : o
      )
    );
  }, []);

  useOrderDetailSync({
    orderId: activeOrder?.id ?? "",
    businessOrderId: activeOrder?.orderId || activeOrder?.orderCode || activeOrder?.id,
    siteVisitId: activeOrder?.siteVisitDetails?.id ?? null,
    enabled: Boolean(activeOrder?.id),
    getOrderSnapshot: () => (activeOrderRef.current || {}) as unknown as Record<string, unknown>,
    onPatch: applyPortalPatch,
  });

  const workflowType = activeOrder?.workflow_type || "quote_first";
  const isDesignFirst = workflowType === "design_first";

  const STEPS = isDesignFirst
    ? [
      { key: "enquiry", label: "Enquiries", icon: FileText },
      { key: "site_visit", label: "Site Visit", icon: MapPin },
      { key: "design", label: "Design", icon: Palette },
      { key: "quotation", label: "Quotations", icon: BarChart3 },
      { key: "production", label: "Production", icon: Package },
      { key: "installation", label: "Installation", icon: Wrench },
      { key: "payments", label: "Payments", icon: CreditCard },
    ]
    : [
      { key: "enquiry", label: "Enquiries", icon: FileText },
      { key: "site_visit", label: "Site Visit", icon: MapPin },
      { key: "quotation", label: "Quotations", icon: BarChart3 },
      { key: "design", label: "Design", icon: Palette },
      { key: "production", label: "Production", icon: Package },
      { key: "installation", label: "Installation", icon: Wrench },
      { key: "payments", label: "Payments", icon: CreditCard },
    ];

  // Step 4: Establish session cookie on first load (avoids keeping token in URL)
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch(withBasePath("/api/portal/session"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        if (mounted && !res.ok) {
          const err = await res.json().catch(() => ({}));
          console.warn("[Portal] Session cookie setup failed:", err.error || res.status);
        }
      } catch (e) {
        console.warn("[Portal] Session cookie setup error:", e);
      }
    })();
    return () => { mounted = false; };
  }, [token]);

  // Site Visit scheduling states
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [siteAddress, setSiteAddress] = useState(customer.shippingAddress || "");
  const [gpsCoords, setGpsCoords] = useState("12.9716, 77.5946");
  const [isRescheduling, setIsRescheduling] = useState(false);
  const [schedulingLoading, setSchedulingLoading] = useState(false);
  const [mapsSearching, setMapsSearching] = useState(false);
  const [activeTab, setActiveTab] = useState<"site" | "quote" | "design" | "production" | "installation">("site");

  const [markerPosition, setMarkerPosition] = useState(defaultCenter);
  const [mapCenter, setMapCenter] = useState(defaultCenter);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const geocoder = useRef<any>(null);

  const { isLoaded } = useJsApiLoader({
    id: GOOGLE_MAPS_SCRIPT_ID,
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "",
    libraries: GOOGLE_MAPS_LIBRARIES,
  });

  const autocompleteRef = useRef<any>(null);

  const applyLocation = useCallback((lat: number, lng: number, address?: string) => {
    setMarkerPosition({ lat, lng });
    setMapCenter({ lat, lng });
    setGpsCoords(`${lat.toFixed(6)}, ${lng.toFixed(6)}`);
    if (address && !isGoogleMapsUrl(address)) setSiteAddress(address);
  }, []);

  const onPlaceChanged = () => {
    try {
      const place = autocompleteRef.current?.getPlace?.();
      const location = place?.geometry?.location;
      if (!location) return;
      const lat = typeof location.lat === "function" ? location.lat() : location.lat;
      const lng = typeof location.lng === "function" ? location.lng() : location.lng;
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      applyLocation(lat, lng, place.formatted_address || place.name || undefined);
    } catch (err) {
      console.warn("[Portal] onPlaceChanged ignored incomplete place:", err);
    }
  };

  const tryResolveMapsLink = useCallback(
    async (value: string) => {
      if (!isGoogleMapsUrl(value)) return;
      setMapsSearching(true);
      try {
        const resolved = await resolveGoogleMapsLocation(value);
        if (!resolved) {
          alert("Could not open that Google Maps link. Paste a full Maps URL or search for the address.");
          return;
        }
        applyLocation(resolved.lat, resolved.lng, resolved.address);
      } catch (err) {
        console.error("[Portal] Maps link resolve failed:", err);
        alert("Could not open that Google Maps link. Please try again.");
      } finally {
        setMapsSearching(false);
      }
    },
    [applyLocation]
  );

  useEffect(() => {
    if (isLoaded && !geocoder.current) {
      geocoder.current = new window.google.maps.Geocoder();
    }
  }, [isLoaded]);

  const reverseGeocode = (lat: number, lng: number) => {
    if (!geocoder.current) return;
    geocoder.current.geocode({ location: { lat, lng } }, (results: any, status: any) => {
      if (status === "OK" && results[0]) {
        setSiteAddress(results[0].formatted_address);
      }
    });
  };

  const onMapClick = useCallback((e: google.maps.MapMouseEvent) => {
    if (!e.latLng) return;
    const lat = e.latLng.lat();
    const lng = e.latLng.lng();
    applyLocation(lat, lng);
    reverseGeocode(lat, lng);
  }, [applyLocation]);

  const handleCurrentLocation = () => {
    setMapsSearching(true);
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          applyLocation(lat, lng);
          reverseGeocode(lat, lng);
          setMapsSearching(false);
        },
        () => {
          alert("Could not detect your location. Please check your browser permissions.");
          setMapsSearching(false);
        }
      );
    } else {
      alert("Geolocation is not supported by your browser.");
      setMapsSearching(false);
    }
  };

  const {
    quoteFeedback,
    setQuoteFeedback,
    showQuoteDeclineInput,
    setShowQuoteDeclineInput,
    updatingStatus: quoteUpdatingStatus,
    actionError: quoteActionError,
    handleApproveQuote,
    handleDeclineQuote,
  } = useQuotationActions(activeOrderId, customer.name, (updater) => {
    setOrders((prev) => prev.map((o) => (o.id === activeOrderId ? updater(o) : o)));
  }, token);

  const [products, setProducts] = useState<any[]>([]);
  const [selectedProductInfo, setSelectedProductInfo] = useState<any | null>(null);

  useEffect(() => {
    const supabase = createClient();
    async function loadProducts() {
      const { data } = await supabase.from("products").select("*").eq("is_active", true);
      if (data) setProducts(data);
    }
    loadProducts();
  }, []);

  // Photo viewer states for Customer Portal
  const [viewerPhotos, setViewerPhotos] = useState<string[]>([]);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  const openViewer = (photosArray: string[], index: number) => {
    setViewerPhotos(photosArray);
    setViewerIndex(index);
  };

  const currentStep = activeOrder ? getStepIndex(activeOrder.stage, activeOrder.workflow_type) : 0;

  const [viewedStep, setViewedStep] = useState<number | null>(null);
  const activeStepToRender = viewedStep !== null ? viewedStep : currentStep;
  const prevCurrentStepRef = useRef(currentStep);

  // Reset viewed step when order changes
  useEffect(() => {
    setViewedStep(null);
    prevCurrentStepRef.current = currentStep;
  }, [activeOrderId]);

  // When staff advances the pipeline, follow the new current step (clear history browse).
  useEffect(() => {
    if (currentStep > prevCurrentStepRef.current) {
      setViewedStep(null);
    }
    prevCurrentStepRef.current = currentStep;
  }, [currentStep]);

  // Sync site visit details
  useEffect(() => {
    if (activeOrder?.siteVisitDetails) {
      const sv = activeOrder.siteVisitDetails;
      setSelectedDate(sv.auditDate || "");
      setSelectedTime(sv.auditTime || "");
      setSiteAddress(sv.customerAddress || customer.shippingAddress || "");
      setGpsCoords(sv.gpsLocation || "12.9716° N, 77.5946° E");
    }
  }, [activeOrderId, activeOrder?.siteVisitDetails]);

  const getBusinessDays = () => {
    const days: Date[] = [];
    const cur = new Date();
    while (days.length < 7) {
      cur.setDate(cur.getDate() + 1);
      if (cur.getDay() !== 0) days.push(new Date(cur));
    }
    return days;
  };

  const isSlotBooked = (date: string, time: string) =>
    orders.some(o => o.id !== activeOrder?.id && o.siteVisitDetails?.auditDate === date && o.siteVisitDetails?.auditTime === time);

  const handleScheduleSiteVisit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOrder || !selectedDate || !selectedTime || !siteAddress) return;
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
      const res = await scheduleSiteVisitAction(activeOrder.id, payload, token);
      if (res.success && res.order) {
        setOrders(prev => prev.map(o => o.id === activeOrder.id ? { ...o, stage: res.order.stage, siteVisitDetails: res.order.siteVisitDetails } : o));
        setIsRescheduling(false);
      }
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : "Failed to confirm site visit. Please try again.");
    }
    finally { setSchedulingLoading(false); }
  };

  const sv = activeOrder?.siteVisitDetails || {};

  const uniquePhotos = useMemo(() => {
    if (!sv || !sv.locations) return [];
    const allPhotos: string[] = [];
    sv.locations.forEach((loc: any) => {
      allPhotos.push(...(loc.photos || []));
    });
    return Array.from(new Set(allPhotos));
  }, [sv]);

  const pd = activeOrder?.productionDetails || {};
  const inst = activeOrder?.installationDetails || {};
  const [productionChecklistItems, setProductionChecklistItems] = useState<ProductionChecklistItem[]>(
    DEFAULT_PRODUCTION_CHECKLIST_ITEMS
  );

  useEffect(() => {
    getAppSettings()
      .then((settings) => {
        if (settings?.productionChecklistItems?.length) {
          setProductionChecklistItems(settings.productionChecklistItems);
        }
      })
      .catch(() => {});
  }, []);

  const productionChecklistProgress = resolveChecklistProgress(pd, productionChecklistItems);

  if (orders.length === 0) {
    return (
      <div className="min-h-screen bg-[#f4f6fb] flex items-center justify-center p-6">
        <div className="bg-white border border-slate-200 rounded-2xl p-10 max-w-md w-full text-center shadow-lg">
          <AlertCircle size={48} className="text-slate-300 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-[#0b1c30] mb-2">No Active Orders</h1>
          <p className="text-sm text-slate-500">We couldn't find any active orders for your account.</p>
          <p className="text-xs text-slate-400 mt-6 font-bold">{loadClientConfig().name} Signage Solutions</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f4f6fb] font-sans">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');
        * { font-family: 'Inter', sans-serif; }
        .portal-stepper-line { transition: width 0.6s cubic-bezier(0.4,0,0.2,1); }
        .scope-item { transition: all 0.2s ease; }
        .portal-scroll::-webkit-scrollbar { width: 4px; }
        .portal-scroll::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 4px; }
        @keyframes slideUp { from { opacity:0; transform: translateY(8px); } to { opacity:1; transform: translateY(0); } }
        .animate-slide-up { animation: slideUp 0.3s ease forwards; }
        .stepper-scroll { scrollbar-width: none; -ms-overflow-style: none; }
        .stepper-scroll::-webkit-scrollbar { display: none; }
        .date-scroll { scrollbar-width: none; -ms-overflow-style: none; }
        .date-scroll::-webkit-scrollbar { display: none; }
      `}</style>

      {/* --- TOP HEADER --- */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2.5 sm:py-3 flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
          
          {/* Row 1 on mobile: Logo + Order Switcher */}
          <div className="flex items-center justify-between gap-3 w-full sm:w-auto min-w-0">
            <div className="min-w-0 shrink">
              <div className="sm:hidden">
                <Logo width={140} height={32} align="left" />
              </div>
              <div className="hidden sm:block">
                <Logo width={180} height={40} align="left" />
              </div>
            </div>
            
            {orders.length > 1 && (
              <div className="sm:hidden shrink-0">
                <select
                  value={activeOrderId}
                  onChange={e => setActiveOrderId(e.target.value)}
                  className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-600 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 font-semibold max-w-[120px]"
                >
                  {orders.map(o => (
                    <option key={o.id} value={o.id}>{o.orderCode || o.id}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Row 2 on mobile: Order Info + Call Button */}
          <div className="flex items-center justify-between gap-3 w-full sm:w-auto min-w-0 sm:border-l sm:border-slate-200 sm:pl-4 flex-1">
            <div className="min-w-0 flex-1">
              <h1 className="text-xs sm:text-sm font-black text-[#0b1c30] leading-none uppercase tracking-wider">
                Order #{activeOrder?.orderCode || activeOrder?.id}
              </h1>
              <p className="text-slate-500 mt-1 text-[10px] sm:text-xs truncate">
                {activeOrder?.clientName || customer.name}
                <span className="hidden sm:inline"> | {activeOrder?.businessName || "Signage Project"}</span>
              </p>
            </div>
            
            <div className="flex items-center gap-2 shrink-0">
              <a
                href="tel:+919876543210"
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-50 hover:bg-blue-100 border border-blue-100 hover:border-blue-200 text-[#1E40AF] rounded-lg text-xs font-bold transition-all shadow-sm"
                title="Call Manager"
              >
                <Phone size={12} className="stroke-[2.5]" />
                <span>Call Manager</span>
              </a>
            </div>

            {/* Desktop Switcher */}
            {orders.length > 1 && (
              <div className="hidden sm:block shrink-0 sm:ml-4">
                <select
                  value={activeOrderId}
                  onChange={e => setActiveOrderId(e.target.value)}
                  className="text-xs border border-slate-200 rounded-lg px-3 py-2 text-slate-600 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
                >
                  {orders.map(o => (
                    <option key={o.id} value={o.id}>{o.orderCode || o.id} — {o.stage}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

        </div>
      </header>

      {/* --- PROGRESS STEPPER --- */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-3 sm:py-5">
          <div className="flex items-start gap-0 sm:gap-1 sm:justify-between relative stepper-scroll overflow-x-auto pb-1">
            {/* Background line — sm and up */}
            <div className="hidden sm:block absolute top-[18px] left-0 right-0 h-[2px] bg-slate-100 z-0" />
            {/* Progress fill — sm and up */}
            <div
              className="hidden sm:block absolute top-[18px] left-0 h-[2px] bg-emerald-500 z-0 portal-stepper-line"
              style={{ width: `${(currentStep / Math.max(STEPS.filter(s => s.key !== "payments").length - 1, 1)) * 100}%` }}
            />

            {STEPS.map((step, idx) => {
              const Icon = step.icon;
              const isPaymentsTab = step.key === "payments";
              const isCompleted = !isPaymentsTab && idx < currentStep;
              const isActive = isPaymentsTab
                ? viewedStep === idx
                : (viewedStep !== null ? viewedStep === idx : idx === currentStep);
              const canOpen = isCompleted || isActive || isPaymentsTab || idx === currentStep || idx < currentStep;

              return (
                <div
                  key={step.key}
                  className={`flex flex-col items-center text-center relative z-10 shrink-0 sm:flex-1 min-w-[3rem] sm:min-w-0 px-1 sm:px-0 snap-start ${canOpen ? 'cursor-pointer hover:opacity-80 active:opacity-70' : ''}`}
                  onClick={() => {
                    if (canOpen) {
                      setViewedStep(idx);
                    }
                  }}
                >
                  <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${isActive
                    ? "bg-[#1E40AF] border-[#1E40AF] text-white shadow-[0_0_0_4px_rgba(30,64,175,0.12)]"
                    : isCompleted
                      ? "bg-emerald-500 border-emerald-500 text-white"
                      : isPaymentsTab
                        ? "bg-white border-blue-200 text-blue-500"
                        : "bg-white border-slate-200 text-slate-400"
                    }`}>
                    {isCompleted && !isActive ? <Check size={14} className="stroke-[3]" /> : <Icon size={14} />}
                  </div>
                  <span className={`text-[9px] sm:text-[11px] font-bold mt-1.5 sm:mt-2 block w-[3rem] sm:w-auto sm:max-w-none leading-tight ${isActive ? "text-[#1E40AF]" : isCompleted ? "text-emerald-600" : isPaymentsTab ? "text-blue-500" : "text-slate-400"
                    }`}>
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* --- MAIN CONTENT --- */}
      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-6 pb-24">
        <div className="grid grid-cols-1 gap-6">

          {/* --- LEFT: Stage Content --- */}
          <div className="space-y-5">

            {/* Current Stage Panel */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              {/* Stage label bar */}
              <div className="px-4 sm:px-6 pt-4 sm:pt-5 pb-3 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
                <span className={`text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full ${viewedStep !== null && viewedStep !== currentStep ? 'bg-slate-100 border border-slate-200 text-slate-600' : 'bg-blue-50 border border-blue-100 text-[#1E40AF]'}`}>
                  {viewedStep !== null && viewedStep !== currentStep ? "PAST STAGE" : "CURRENT STAGE"}: {STEPS[activeStepToRender]?.label?.toUpperCase()}
                </span>
                {viewedStep !== null && viewedStep !== currentStep && (
                  <button
                    onClick={() => setViewedStep(null)}
                    className="text-[10px] font-bold text-[#1E40AF] hover:underline"
                  >
                    Return to Current Stage &rarr;
                  </button>
                )}
              </div>

              <div className="p-4 sm:p-6">
                {/* ------ ENQUIRIES STAGE ------ */}
                {STEPS[activeStepToRender]?.key === "enquiry" && (
                  <div className="space-y-6">
                    <div>
                      <h2 className="text-xl font-black text-[#0b1c30] mb-1">Enquiry Details</h2>
                      <p className="text-sm text-slate-500">Your original request and project requirements.</p>
                    </div>

                    <div className="p-5 border border-slate-200 rounded-2xl bg-white shadow-sm space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-slate-50 rounded-lg p-4 border border-slate-100">
                          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block mb-1">Client Name</span>
                          <p className="font-semibold text-slate-800">{activeOrder.clientName}</p>
                        </div>
                        <div className="bg-slate-50 rounded-lg p-4 border border-slate-100">
                          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block mb-1">Business Name</span>
                          <p className="font-semibold text-slate-800">{activeOrder.businessName}</p>
                        </div>
                        <div className="bg-slate-50 rounded-lg p-4 border border-slate-100">
                          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block mb-1">Product Type</span>
                          <p className="font-semibold text-slate-800">{activeOrder.productType || "Not Specified"}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-slate-50 rounded-lg p-4 border border-slate-100">
                          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block mb-1">Requirements</span>
                          <p className="font-semibold text-slate-800 whitespace-pre-line">{activeOrder.requirements || "No requirements provided."}</p>
                        </div>
                        <div className="bg-slate-50 rounded-lg p-4 border border-slate-100">
                          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block mb-1">Date Created</span>
                          <p className="font-semibold text-slate-800">{new Date(activeOrder.dateCreated).toLocaleDateString()}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* ------ SITE VISIT STAGE ------ */}
                {STEPS[activeStepToRender]?.key === "site_visit" && (
                  <>
                    {sv.customerAddress?.startsWith("Skipped") ? (
                      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-center">
                        <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-3">
                          <CheckCircle2 size={24} className="text-amber-600" />
                        </div>
                        <h2 className="text-xl font-black text-amber-900 mb-2">Site Visit Skipped</h2>
                        <p className="text-sm text-amber-700 max-w-md mx-auto">
                          The site visit has been skipped by our team. We will directly proceed with adding measurements for your project.
                        </p>
                      </div>
                    ) : currentStep <= 1 && (!sv.auditDate || isRescheduling) ? (
                      appSettings?.siteVisitSchedulingEnabled === false ? (
                        <div className="py-6 text-center text-slate-500 text-sm font-medium bg-slate-50 rounded-xl border border-dashed border-slate-200">
                          <Calendar size={24} className="mx-auto mb-2 opacity-30" />
                          Your site visit schedule is pending confirmation from our team.
                        </div>
                      ) : (
                        <div className="space-y-6">
                          <div>
                            <h2 className="text-xl font-black text-[#0b1c30] mb-1.5">Schedule Your Physical Site Audit</h2>
                            <p className="text-sm text-slate-500 leading-relaxed max-w-lg">
                              Our technical survey team needs to verify dimensions and substrate conditions before we can finalize the structural design for your exterior month signs. Estimated duration: 45 mins.
                            </p>
                          </div>

                          <form onSubmit={handleScheduleSiteVisit} className="space-y-5">
                            {/* Date Picker */}
                            <div>
                              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                                Pick a Date
                              </label>
                              <div className="flex gap-2 date-scroll overflow-x-auto pb-2 snap-x snap-mandatory">
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
                                      className={`flex flex-col items-center p-3 rounded-xl border text-center min-w-[64px] snap-start shrink-0 transition-all cursor-pointer ${selected
                                        ? "bg-[#eff4ff] border-[#1E40AF] text-[#1E40AF] ring-2 ring-blue-100"
                                        : "bg-white border-slate-200 text-slate-600 hover:border-slate-300 active:bg-slate-50"
                                        }`}
                                    >
                                      <span className="text-[9px] uppercase tracking-wider text-slate-400">{dayName}</span>
                                      <span className="text-sm font-black mt-0.5">{day.getDate()}</span>
                                      <span className="text-[9px] text-slate-400">{monthName}</span>
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
                                        className={`py-2.5 rounded-xl border text-xs font-bold transition-all ${booked ? "bg-slate-50 border-slate-100 text-slate-300 cursor-not-allowed"
                                          : sel ? "bg-[#eff4ff] border-[#1E40AF] text-[#1E40AF] ring-2 ring-blue-100"
                                            : "bg-white border-slate-200 text-slate-600 hover:border-slate-300 cursor-pointer"
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
                              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                                Choose Location in Maps
                              </label>
                              {isLoaded ? (
                                <Autocomplete
                                  onLoad={autocomplete => (autocompleteRef.current = autocomplete)}
                                  onPlaceChanged={onPlaceChanged}
                                >
                                  <input
                                    type="text"
                                    required
                                    value={siteAddress}
                                    onChange={e => setSiteAddress(e.target.value)}
                                    onPaste={(e) => {
                                      const pasted = e.clipboardData.getData("text");
                                      if (isGoogleMapsUrl(pasted)) {
                                        e.preventDefault();
                                        setSiteAddress(pasted.trim());
                                        void tryResolveMapsLink(pasted);
                                      }
                                    }}
                                    onBlur={() => {
                                      void tryResolveMapsLink(siteAddress);
                                    }}
                                    placeholder="Search address or paste a Google Maps link..."
                                    className="w-full p-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none bg-slate-50 focus:bg-white transition-all"
                                  />
                                </Autocomplete>
                              ) : (
                                <input
                                  type="text"
                                  required
                                  value={siteAddress}
                                  onChange={e => setSiteAddress(e.target.value)}
                                  placeholder="Full address where signage will be installed"
                                  className="w-full p-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none bg-slate-50 focus:bg-white transition-all"
                                />
                              )}

                              {/* Map visual */}
                              <div className="mt-2 border border-slate-200 rounded-xl overflow-hidden bg-slate-50">
                                <div className="h-40 bg-[#e8edf2] relative">
                                  {isLoaded ? (
                                    <GoogleMap
                                      mapContainerStyle={containerStyle}
                                      center={mapCenter}
                                      zoom={14}
                                      onClick={onMapClick}
                                      onLoad={setMap}
                                      onUnmount={() => setMap(null)}
                                      options={GOOGLE_MAPS_DEFAULT_OPTIONS}
                                    >
                                      <AdvancedMapMarker map={map} position={markerPosition} />
                                    </GoogleMap>
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center text-xs text-slate-500">
                                      Loading Map...
                                    </div>
                                  )}
                                </div>
                                <div className="px-3 py-2 bg-white border-t border-slate-200 flex items-center justify-between">
                                  <span className="text-[10px] font-mono font-semibold text-slate-600">📍 {gpsCoords}</span>
                                  <button
                                    type="button"
                                    onClick={handleCurrentLocation}
                                    className="flex items-center gap-1 text-[10px] font-bold text-[#1E40AF] hover:underline cursor-pointer"
                                  >
                                    {mapsSearching ? <Loader2 size={10} className="animate-spin" /> : null}
                                    {mapsSearching ? "Detecting..." : "Auto-detect"}
                                  </button>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-3 pt-2">
                              <button
                                type="submit"
                                disabled={!selectedDate || !selectedTime || schedulingLoading}
                                className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-3 sm:py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 active:bg-emerald-800 transition-all disabled:opacity-50 shadow-sm"
                              >
                                {schedulingLoading ? <Loader2 size={14} className="animate-spin" /> : null}
                                Confirm Site Visit
                                <Check size={14} />
                              </button>
                            </div>
                          </form>
                        </div>
                      )
                    ) : currentStep <= 1 && sv.completed === false ? (
                      // Scheduled confirmation
                      <div className="text-center space-y-5 py-4">
                        <div className="w-14 h-14 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center mx-auto">
                          <Check size={24} className="text-emerald-600 stroke-[3]" />
                        </div>
                        <div>
                          <h2 className="text-lg font-black text-[#0b1c30]">Site Visit Scheduled</h2>
                          <p className="text-sm text-slate-500 mt-1">Our team will arrive at the scheduled time.</p>
                        </div>
                        <div className="max-w-sm mx-auto bg-slate-50 border border-slate-200 rounded-xl p-4 text-left grid grid-cols-2 gap-3 text-xs">
                          <div><span className="text-[10px] text-slate-400 uppercase font-bold block">Date</span><p className="font-bold text-slate-800 font-mono mt-0.5">{sv.auditDate}</p></div>
                          <div><span className="text-[10px] text-slate-400 uppercase font-bold block">Time</span><p className="font-bold text-slate-800 font-mono mt-0.5">{sv.auditTime}</p></div>
                          <div className="col-span-2">
                            <span className="text-[10px] text-slate-400 uppercase font-bold block">Address</span>
                            <a
                              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(sv.customerAddress || "")}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-medium text-blue-600 hover:text-blue-800 hover:underline mt-0.5 block"
                            >
                              {sv.customerAddress}
                            </a>
                          </div>
                        </div>
                        {appSettings?.siteVisitSchedulingEnabled !== false && (
                          <button onClick={() => setIsRescheduling(true)} className="w-full sm:w-auto px-4 py-3 sm:py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-50 active:bg-slate-100 transition-all flex items-center justify-center gap-2 mx-auto">
                            <RefreshCw size={12} /> Reschedule Appointment
                          </button>
                        )}
                      </div>
                    ) : (
                      // Completed or pending approval
                      <div className="space-y-6">
                        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-start gap-3">
                          <CheckCircle2 size={18} className="text-emerald-600 shrink-0 mt-0.5" />
                          <div>
                            <p className="text-sm font-bold text-emerald-800">Site Survey Completed</p>
                            <p className="text-xs text-emerald-700 mt-0.5">Measurements have been recorded by our engineering team.</p>
                          </div>
                        </div>

                        {/* Recorded Measurements */}
                        {sv.locations && sv.locations.length > 0 && (
                          <div className="space-y-4">
                            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-2">
                              <MapPin size={16} className="text-[#1E40AF]" />
                              Recorded Measurements
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                              {sv.locations.map((loc: any, idx: number) => (
                                <div key={idx} className={`group bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-300 ${sv.locations.length % 2 !== 0 && idx === sv.locations.length - 1 ? 'md:col-span-2' : ''}`}>
                                  {/* Header */}
                                  <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                                    <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                                      <span className="w-1.5 h-1.5 rounded-full bg-[#1E40AF]" />
                                      {loc.name || `Location ${idx + 1}`}
                                    </h4>
                                  </div>

                                  {/* Body */}
                                  <div className="p-5 space-y-5">
                                    {/* Measurements */}
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                      {loc.width ? (
                                        <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                                          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block mb-1">Width</span>
                                          <p className="font-semibold text-slate-800 font-mono">{loc.width} {loc.widthUnit || "in"}</p>
                                        </div>
                                      ) : null}
                                      {loc.height ? (
                                        <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                                          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block mb-1">Height</span>
                                          <p className="font-semibold text-slate-800 font-mono">{loc.height} {loc.heightUnit || "in"}</p>
                                        </div>
                                      ) : null}
                                      {loc.depth ? (
                                        <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                                          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block mb-1">Depth</span>
                                          <p className="font-semibold text-slate-800 font-mono">{loc.depth} {loc.depthUnit || "in"}</p>
                                        </div>
                                      ) : null}
                                      {loc.groundClearance ? (
                                        <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                                          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block mb-1">Ground Clr.</span>
                                          <p className="font-semibold text-slate-800 font-mono">{loc.groundClearance} {loc.groundClearanceUnit || "in"}</p>
                                        </div>
                                      ) : null}
                                    </div>

                                    {/* Notes */}
                                    {loc.notes && (
                                      <div className="bg-amber-50/50 rounded-lg p-3 border border-amber-100/50">
                                        <span className="text-[10px] text-amber-700 font-bold uppercase tracking-wider block mb-1">Notes</span>
                                        <p className="text-xs text-amber-900/80 leading-relaxed">{loc.notes}</p>
                                      </div>
                                    )}

                                    {/* Photos */}
                                    {loc.photos && loc.photos.length > 0 && (
                                      <div>
                                        <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block mb-3">Location Photos</span>
                                        <div className="flex flex-wrap gap-3">
                                          {loc.photos.map((photo: string, pIdx: number) => (
                                            <div
                                              key={pIdx}
                                              onClick={() => openViewer(loc.photos, pIdx)}
                                              className="relative w-16 h-16 rounded-xl border border-slate-200 overflow-hidden cursor-pointer group/photo shadow-sm"
                                            >
                                              <img src={photo} alt="Ref" className="w-full h-full object-cover transition-transform duration-500 group-hover/photo:scale-110" />
                                              <div className="absolute inset-0 bg-black/0 group-hover/photo:bg-black/20 transition-colors flex items-center justify-center">
                                                <ZoomIn size={14} className="text-white opacity-0 group-hover/photo:opacity-100 transition-opacity" />
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* ------ Installation Requirements ------ */}
                        {(sv.scaffoldingRequired || sv.craneRequired || sv.overnightInstallation !== undefined) && (
                          <div className="space-y-3">
                            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-2">
                              🏗️ Installation Requirements
                            </h3>
                            <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-wrap gap-2">
                              {sv.scaffoldingRequired && (
                                <span className="text-[11px] font-bold px-3 py-1.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">Scaffolding Required</span>
                              )}
                              {sv.craneRequired && (
                                <span className="text-[11px] font-bold px-3 py-1.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">Crane Required</span>
                              )}
                              {sv.overnightInstallation !== undefined && (
                                <span className={`text-[11px] font-bold px-3 py-1.5 rounded-full border ${sv.overnightInstallation ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-slate-50 text-slate-500 border-slate-200"}`}>
                                  🌙 Overnight Installation: {sv.overnightInstallation ? "Yes" : "No"}
                                </span>
                              )}
                            </div>
                          </div>
                        )}

                        {/* ------ Fabrication Requirements ------ */}
                        {(sv.extraAnglesRequired !== undefined || sv.extraAcpSheetRequired !== undefined || sv.oldBoardRemovalRequired !== undefined || sv.extraWireRequired !== undefined) && (
                          <div className="space-y-3">
                            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-2">
                              🔧 Fabrication Requirements
                            </h3>
                            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                              {[
                                { label: "Extra Angles Required", value: sv.extraAnglesRequired, note: sv.extraAnglesRequired && sv.extraAnglesLength ? ` — ${sv.extraAnglesLength}` : "" },
                                { label: "Extra ACP Sheet to Cover Gap", value: sv.extraAcpSheetRequired },
                                { label: "Old Board Removal Required", value: sv.oldBoardRemovalRequired },
                                { label: "Extra Wire Required", value: sv.extraWireRequired },
                              ].filter(item => item.value !== undefined).map((item, i, arr) => (
                                <div key={item.label} className={`flex items-center justify-between px-4 py-3 text-sm ${i < arr.length - 1 ? "border-b border-slate-100" : ""}`}>
                                  <span className="text-slate-700 font-medium">
                                    {item.label}{"note" in item ? <span className="text-slate-400 font-normal">{item.note}</span> : null}
                                  </span>
                                  <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${item.value ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-50 text-slate-500 border-slate-200"}`}>
                                    {item.value ? "Yes" : "No"}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* ------ Design Inputs ------ */}
                        {(sv.designBriefAvailable || sv.fabricationRequired !== undefined || sv.civilWorkRequired !== undefined) && (
                          <div className="space-y-3">
                            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-2">
                              🎨 Design Inputs
                            </h3>
                            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                              {[
                                ...(sv.designBriefAvailable ? [{ label: "Design Brief Available", value: sv.designBriefAvailable, isText: true }] : []),
                                ...(sv.fabricationRequired !== undefined ? [{ label: "Fabrication Required", value: sv.fabricationRequired }] : []),
                                ...(sv.civilWorkRequired !== undefined ? [{ label: "Civil Work Required", value: sv.civilWorkRequired }] : []),
                              ].map((item, i, arr) => (
                                <div key={item.label} className={`flex items-center justify-between px-4 py-3 text-sm ${i < arr.length - 1 ? "border-b border-slate-100" : ""}`}>
                                  <span className="text-slate-700 font-medium">{item.label}</span>
                                  {"isText" in item && item.isText ? (
                                    <span className="text-[11px] font-bold px-2.5 py-1 rounded-full border bg-indigo-50 text-indigo-700 border-indigo-200">{item.value as string}</span>
                                  ) : (
                                    <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${item.value ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-50 text-slate-500 border-slate-200"}`}>
                                      {item.value ? "Yes" : "No"}
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}

                {/* ------ QUOTATION STAGE ------ */}
                {STEPS[activeStepToRender]?.key === "quotation" && (
                  <div className="space-y-6">
                    {/* Header */}
                    <div>
                      <h2 className="text-xl font-black text-[#0b1c30] mb-1">Quotation</h2>
                      <p className="text-sm text-slate-500">Review pricing options, set material preferences, and approve to proceed.</p>
                    </div>
                    <QuotationTab
                      layout="portal-step"
                      order={{
                        businessName: activeOrder.businessName,
                        clientName: activeOrder.clientName,
                        workflow_type: activeOrder.workflow_type,
                        quoteDetails: activeOrder.quoteDetails,
                      }}
                      products={products}
                      siteVisitItems={activeOrder.siteVisitItems || []}
                      setSelectedProductInfo={setSelectedProductInfo}
                      showQuoteDeclineInput={showQuoteDeclineInput}
                      setShowQuoteDeclineInput={setShowQuoteDeclineInput}
                      quoteFeedback={quoteFeedback}
                      setQuoteFeedback={setQuoteFeedback}
                      updatingStatus={quoteUpdatingStatus}
                      actionError={quoteActionError}
                      handleApproveQuote={handleApproveQuote}
                      handleDeclineQuote={handleDeclineQuote}
                      invoiceProfile={appSettings?.invoiceProfile}
                      billingAddress={customer.billingAddress}
                      customerCity={customer.city}
                    />
                  </div>
                )}

                {/* ------ DESIGN STAGE ------ */}
                {STEPS[activeStepToRender]?.key === "design" && (
                  <DesignTab order={activeOrder as any} customer={customer} siteVisitItems={activeOrder?.siteVisitItems || []} portalToken={token} />
                )}

                {/* ------ PRODUCTION STAGE ------ */}
                {STEPS[activeStepToRender]?.key === "production" && (
                  <div className="space-y-5">
                    <div>
                      <h2 className="text-xl font-black text-[#0b1c30] mb-1">Workshop Fabrication Status</h2>
                      <p className="text-sm text-slate-500">Real-time checklist of production milestones.</p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {productionChecklistItems.map((item) => {
                        const done = !!productionChecklistProgress[item.id];
                        return (
                        <div key={item.id} className={`p-4 border rounded-xl flex items-center justify-between ${done ? "bg-emerald-50/50 border-emerald-200 text-emerald-800" : "bg-slate-50 border-slate-200 text-slate-500"}`}>
                          <span className="text-xs font-semibold">{item.label}</span>
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${done ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-500"}`}>{done ? "Done" : "Pending"}</span>
                        </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* ------ INSTALLATION STAGE ------ */}
                {STEPS[activeStepToRender]?.key === "installation" && (
                  <div className="space-y-5">
                    <div>
                      <h2 className="text-xl font-black text-[#0b1c30] mb-1">Field Installation</h2>
                      <p className="text-sm text-slate-500">Installation scheduling and completion records.</p>
                    </div>

                    {/* INSTALLATION SCHEDULING (Customer Side) */}
                    <div className="mb-6">
                      <InstallationScheduleModule
                        orderId={activeOrder.id}
                        initialScheduledDate={inst.scheduledDate}
                        initialScheduledTime={inst.scheduledTime}
                        isCompleted={activeOrder.stage === "Completed" || activeOrder.stage === "Closed"}
                        isCustomerView={true}
                        customerSchedulingEnabled={appSettings?.installationSchedulingEnabled !== false}
                      />
                    </div>

                    {(() => {
                      const installPhotos: string[] = Array.from(
                        new Set(
                          [
                            ...(Array.isArray(inst.afterPhotos) ? inst.afterPhotos : []),
                            ...(Array.isArray(inst.photos) ? inst.photos : []),
                            ...(inst.photoUrl ? [inst.photoUrl] : []),
                          ].filter((u): u is string => typeof u === "string" && !!u.trim())
                        )
                      );
                      const installDone =
                        installPhotos.length > 0 ||
                        inst.status === "Completed" ||
                        activeOrder.stage === "Completed" ||
                        activeOrder.stage === "Closed";

                      if (!installDone) {
                        return (
                          <div className="p-8 bg-slate-50 border border-slate-200 rounded-xl text-center text-slate-400 text-sm">
                            Installation records will appear here once complete.
                          </div>
                        );
                      }

                      return (
                        <div className="space-y-4">
                          {installPhotos.length > 0 ? (
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                              {installPhotos.map((url, index) => (
                                <div
                                  key={`${url}-${index}`}
                                  className="border border-slate-200 rounded-xl overflow-hidden aspect-video bg-slate-100"
                                >
                                  <img
                                    src={url}
                                    alt={`Installation photo ${index + 1}`}
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                              ))}
                            </div>
                          ) : null}
                          <div className="space-y-3">
                            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-bold text-emerald-800">
                              Job completed{inst.customerSignature ? " & signed off by client" : ""}
                            </div>
                            {inst.customerSignature ? (
                              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs">
                                <span className="text-slate-400 uppercase font-bold text-[10px] block mb-1">
                                  Signature
                                </span>
                                <span className="font-serif italic text-slate-800 text-sm">
                                  {inst.customerSignature}
                                </span>
                              </div>
                            ) : null}
                            {inst.notes ? (
                              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 whitespace-pre-wrap">
                                {inst.notes}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}

                {STEPS[activeStepToRender]?.key === "payments" && activeOrder && (
                  <div className="p-4 sm:p-6">
                    <PaymentsTab orderId={activeOrder.id} />
                  </div>
                )}
              </div>
            </div>




          </div>

        </div>

        <div style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          textAlign: "center",
          padding: "8px 0 calc(8px + env(safe-area-inset-bottom, 0px))",
          borderTop: "1px solid #E2E8F0",
          color: "#94A3B8",
          fontSize: "13px",
          fontWeight: "600",
          width: "100%",
          background: "#f4f6fb",
          zIndex: 40,
          pointerEvents: "none",
        }}>
          <PlatformMadeWithLove variant="portal" />
        </div>
      </div>



      {selectedProductInfo && (
        <ProductInfoModal
          product={selectedProductInfo}
          onClose={() => setSelectedProductInfo(null)}
        />
      )}

      {/* ------ PHOTO VIEWER MODAL ------ */}
      {viewerIndex !== null && viewerPhotos.length > 0 && (
        <div
          className="fixed inset-0 z-[99999] bg-black/90 flex items-center justify-center backdrop-blur-sm"
          onClick={() => setViewerIndex(null)}
        >
          {/* Top action bar */}
          <div className="absolute top-0 left-0 right-0 flex items-center justify-end gap-2 p-3 sm:p-4 bg-gradient-to-b from-black/60 to-transparent z-10">
            <a
              href={viewerPhotos[viewerIndex]}
              download
              target="_blank"
              rel="noopener noreferrer"
              className="text-white/80 hover:text-white bg-black/40 hover:bg-black/70 rounded-xl px-3 py-2 transition-all focus:outline-none flex items-center gap-2 text-xs font-bold"
              onClick={(e) => e.stopPropagation()}
            >
              <Download size={15} />
              <span className="hidden sm:inline">Download</span>
            </a>
            <button
              className="text-white/80 hover:text-white bg-black/40 hover:bg-black/70 rounded-full p-2 transition-all focus:outline-none"
              onClick={() => setViewerIndex(null)}
            >
              <X size={20} />
            </button>
          </div>

          {/* Main Image */}
          <div className="relative w-full h-full flex items-center justify-center p-10 sm:p-16">
            <img
              src={viewerPhotos[viewerIndex]}
              className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
              alt="Viewed full size"
              onClick={(e) => e.stopPropagation()}
            />
          </div>

          {/* Previous button */}
          {viewerIndex > 0 && (
            <button
              className="absolute left-2 sm:left-6 top-1/2 -translate-y-1/2 text-white/70 hover:text-white bg-black/50 hover:bg-black/80 rounded-full p-2 sm:p-3 transition-all focus:outline-none"
              onClick={(e) => { e.stopPropagation(); setViewerIndex(viewerIndex - 1); }}
            >
              <ChevronLeft size={24} className="sm:hidden" />
              <ChevronLeft size={32} className="hidden sm:block" />
            </button>
          )}

          {/* Next button */}
          {viewerIndex < viewerPhotos.length - 1 && (
            <button
              className="absolute right-2 sm:right-6 top-1/2 -translate-y-1/2 text-white/70 hover:text-white bg-black/50 hover:bg-black/80 rounded-full p-2 sm:p-3 transition-all focus:outline-none"
              onClick={(e) => { e.stopPropagation(); setViewerIndex(viewerIndex + 1); }}
            >
              <ChevronRight size={24} className="sm:hidden" />
              <ChevronRight size={32} className="hidden sm:block" />
            </button>
          )}

          {/* Image Counter */}
          <div className="absolute bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 bg-black/60 text-white text-xs sm:text-sm font-medium px-3 sm:px-4 py-1.5 rounded-full backdrop-blur-md">
            {viewerIndex + 1} / {viewerPhotos.length}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// Product Info Popup Modal Component
// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
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
                ?{(product.price_per_unit || product.price_per_sqft || 0).toLocaleString("en-IN")}
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
