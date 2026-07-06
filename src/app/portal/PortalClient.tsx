"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { GoogleMap, useJsApiLoader, Marker, Autocomplete } from "@react-google-maps/api";

const libraries: ("places")[] = ["places"];

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
  MessageSquare, Send, ZoomIn, ZoomOut, Check, X, Info,
  AlertCircle, Calendar,
  ChevronLeft, ChevronRight, Phone,
  Package, Wrench, Palette, BarChart3, CreditCard,
  RefreshCw, AlertTriangle, Loader2, Maximize2, Minimize2, CheckCheck,
  Download
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { scheduleSiteVisitAction, revalidateOrderPathsAction } from "@/features/orders/actions/orderActions";
import { mapSiteVisitFromDb, formatSiteMeasurementLabel } from "@/features/orders/actions/siteVisitMapper";
import { calcLineAmount, getLineMeasurement, normalizePricingType } from "@/features/quotations/utils/lineAmount";
import { PaymentsTab } from "./components/PaymentsTab";
import { provideInstallationLocationAction, scheduleInstallationAction } from "@/features/installations/actions/installationActions";
import { InstallationScheduleModule } from "@/features/installations/components/InstallationScheduleModule";
import { DesignTab } from "./components/DesignTab";
import { approveAllDesignItemsAction, updateDesignDetailsAction } from "@/features/designs/actions/designActions";
import { mapDesignFromDb } from "@/features/designs/actions/designMapper";

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
  if (s.includes("production") || s.includes("fabricat") || s.includes("ready")) return 4;
  if (s.includes("installation") || s.includes("completed") || s.includes("closed")) return 5;
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
        const res = await fetch("/api/portal/session", {
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
  const [activeTab, setActiveTab] = useState<"site"|"quote"|"design"|"production"|"installation">("site");

  const [markerPosition, setMarkerPosition] = useState(defaultCenter);
  const [mapCenter, setMapCenter] = useState(defaultCenter);
  const geocoder = useRef<any>(null);

  const { isLoaded } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "",
    libraries,
  });

  const autocompleteRef = useRef<any>(null);

  const onPlaceChanged = () => {
    if (autocompleteRef.current !== null) {
      const place = autocompleteRef.current.getPlace();
      if (place.geometry && place.geometry.location) {
        const lat = place.geometry.location.lat();
        const lng = place.geometry.location.lng();
        setMarkerPosition({ lat, lng });
        setMapCenter({ lat, lng });
        setGpsCoords(`${lat.toFixed(6)}, ${lng.toFixed(6)}`);
        setSiteAddress(place.formatted_address || place.name || "");
      }
    }
  };

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
    setMarkerPosition({ lat, lng });
    setGpsCoords(`${lat.toFixed(6)}, ${lng.toFixed(6)}`);
    reverseGeocode(lat, lng);
  }, []);

  const handleCurrentLocation = () => {
    setMapsSearching(true);
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          setMarkerPosition({ lat, lng });
          setMapCenter({ lat, lng });
          setGpsCoords(`${lat.toFixed(6)}, ${lng.toFixed(6)}`);
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

  // Quote / design states
  const [quoteFeedback, setQuoteFeedback] = useState("");
  const [designFeedback, setDesignFeedback] = useState("");
  const [showQuoteDeclineInput, setShowQuoteDeclineInput] = useState(false);
  const [showDesignDeclineInput, setShowDesignDeclineInput] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState(100);

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

  const [unreadCount, setUnreadCount] = useState(0);

  // Photo viewer states for Customer Portal
  const [viewerPhotos, setViewerPhotos] = useState<string[]>([]);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  const [customerMapLink, setCustomerMapLink] = useState("");
  const [submittingMap, setSubmittingMap] = useState(false);

  const openViewer = (photosArray: string[], index: number) => {
    setViewerPhotos(photosArray);
    setViewerIndex(index);
  };

  const handleProvideLocation = async () => {
    if (!activeOrder || !customerMapLink.trim()) return;
    setSubmittingMap(true);
    try {
      await provideInstallationLocationAction(activeOrder.id, customerMapLink);
      // Optimistic update
      setOrders(prev => prev.map(o => o.id === activeOrder.id ? {
        ...o,
        installationDetails: {
          ...(o.installationDetails || {}),
          gmapLink: customerMapLink,
          gmapRequested: false
        }
      } : o));
      setCustomerMapLink("");
    } catch (err) {
      console.error(err);
    } finally {
      setSubmittingMap(false);
    }
  };



  const currentStep = activeOrder ? getStepIndex(activeOrder.stage, activeOrder.workflow_type) : 0;
  
  const [viewedStep, setViewedStep] = useState<number | null>(null);
  const activeStepToRender = viewedStep !== null ? viewedStep : currentStep;

  // Reset viewed step when order changes
  useEffect(() => {
    setViewedStep(null);
  }, [activeOrderId]);

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

  // Unread count
  useEffect(() => {
    if (!activeOrder) return;
    const supabase = createClient();
    async function loadUnread() {
      const { count } = await supabase
        .from("order_activity")
        .select("*", { count: "exact", head: true })
        .eq("order_id", activeOrder!.orderId || activeOrder!.id)
        .eq("activity_type", "customer")
        .eq("is_read", false);
      if (count !== null) setUnreadCount(count);
    }
    loadUnread();
    const channelName = `unread-${activeOrder.id}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const ch = supabase
      .channel(channelName)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "order_activity", filter: `order_id=eq.${activeOrder.orderId || activeOrder.id}` }, (p) => {
        const msg = p.new as any;
        if (msg.activity_type === "customer" && msg.actor_role !== "Customer") {
          setUnreadCount(prev => prev + 1);
        }
      })
      .subscribe();
  }, [activeOrder?.id]);

  // Realtime subscription to sync active order and quotation changes dynamically
  useEffect(() => {
    if (!activeOrder) return;
    const supabase = createClient();
    const orderChannelName = `portal-order-sync-${activeOrder.id}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    const channel = supabase
      .channel(orderChannelName)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders", filter: `id=eq.${activeOrder.id}` },
        (payload) => {
          if (payload.eventType === "UPDATE" || payload.eventType === "INSERT") {
            const updatedOrder = payload.new as any;
            if (updatedOrder) {
              setOrders(prev => prev.map(o => o.id === updatedOrder.id ? {
                ...o,
                stage: updatedOrder.stage,
                depositPaid: Number(updatedOrder.deposit_paid) || 0,

                siteVisitDetails: o.siteVisitDetails,
                productionDetails: updatedOrder.productionDetails,
                installationDetails: updatedOrder.installationDetails,
                stageStatus: updatedOrder.stage_status,
                stageAdminNotes: updatedOrder.stage_admin_notes,
              } : o));
            }
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "site_visits", filter: `order_id=eq.${activeOrder.id}` },
        (payload) => {
          if (payload.eventType === "DELETE") {
            setOrders(prev => prev.map(o => o.id === activeOrder.id ? {
              ...o,
              siteVisitDetails: undefined
            } : o));
          } else {
            const mapped = mapSiteVisitFromDb(payload.new);
            if (mapped) {
              setOrders(prev => prev.map(o => o.id === activeOrder.id ? {
                ...o,
                siteVisitDetails: {
                  ...mapped,
                  locations: mapped.locations && mapped.locations.length > 0 ? mapped.locations : (o.siteVisitDetails?.locations || [])
                }
              } : o));
            }
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "designs", filter: `order_id=eq.${activeOrder.id}` },
        (payload) => {
          if (payload.eventType === "DELETE") {
            setOrders(prev => prev.map(o => o.id === activeOrder.id ? {
              ...o,
              design: undefined
            } : o));
          } else {
            const mapped = mapDesignFromDb(payload.new);
            if (mapped) {
              setOrders(prev => prev.map(o => o.id === activeOrder.id ? {
                ...o,
                design: mapped
              } : o));
            }
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "quotations", filter: `order_id=eq.${activeOrder.id}` },
        (payload) => {
          if (payload.eventType === "UPDATE" || payload.eventType === "INSERT") {
            const updatedQuote = payload.new as any;
            if (updatedQuote) {
              setOrders(prev => prev.map(o => o.id === updatedQuote.order_id ? {
                ...o,
                quoteDetails: {
                  ...(o.quoteDetails || {}),
                  quotationId: updatedQuote.quotation_id,
                  status: updatedQuote.status,
                  grandTotal: Number(updatedQuote.grand_total) || 0,
                  subtotal: Number(updatedQuote.subtotal) || 0,
                  discount: Number(updatedQuote.discount) || 0,
                  tax: Number(updatedQuote.tax) || 0,
                  signageOptions: updatedQuote.signage_options || [],
                  shipping: Number(updatedQuote.shipping) || 0,
                  notes: updatedQuote.notes || "",
                  terms: updatedQuote.terms || "",
                }
              } : o));
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeOrder?.id]);

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
      const payload = { auditDate: selectedDate, auditTime: selectedTime, customerAddress: siteAddress, gpsLocation: gpsCoords, completed: false, reviewStatus: "Pending" };
      const res = await scheduleSiteVisitAction(activeOrder.id, payload);
      if (res.success && res.order) {
        setOrders(prev => prev.map(o => o.id === activeOrder.id ? { ...o, stage: res.order.stage, siteVisitDetails: res.order.siteVisitDetails } : o));
        setIsRescheduling(false);
      }
    } catch (err) { console.error(err); }
    finally { setSchedulingLoading(false); }
  };

  const handleApproveQuote = async () => {
    if (!activeOrder) return;
    setUpdatingStatus("quote-approve");
    const supabase = createClient();
    const updatedQuote = { ...activeOrder.quoteDetails, status: "Approved" };
    setOrders(prev => prev.map(o => o.id === activeOrder.id ? { ...o, stage: "Quotation Approved", quoteDetails: updatedQuote } : o));
    await supabase.from("order_activity").insert({ order_id: activeOrder.orderId || activeOrder.id, activity_type: "timeline", actor_name: "System", actor_role: "System", content: "Client approved the quotation details.", metadata: { action: "quotation_approved_by_customer" } });
    await supabase.from("quotations").update({ status: "Approved" }).eq("order_id", activeOrder.id);
    await supabase.from("orders").update({ stage: "Quotation Approved" }).eq("id", activeOrder.id);
    await revalidateOrderPathsAction(activeOrder.id);
    setUpdatingStatus(null);
  };

  const handleDeclineQuote = async () => {
    if (!activeOrder || !quoteFeedback.trim()) return;
    setUpdatingStatus("quote-decline");
    const supabase = createClient();
    const updatedQuote = { ...activeOrder.quoteDetails, status: "Rejected", rejectionReason: quoteFeedback };
    setOrders(prev => prev.map(o => o.id === activeOrder.id ? { ...o, stage: "Quotation Negotiation", quoteDetails: updatedQuote } : o));
    await supabase.from("order_activity").insert({ order_id: activeOrder.orderId || activeOrder.id, activity_type: "customer", actor_name: customer.name, actor_role: "Customer", content: `Quotation Declined. Feedback: ${quoteFeedback}`, metadata: { action: "quotation_declined" } });
    await supabase.from("quotations").update({ status: "Rejected", rejection_reason: quoteFeedback }).eq("order_id", activeOrder.id);
    await supabase.from("orders").update({ stage: "Quotation Negotiation" }).eq("id", activeOrder.id);
    await revalidateOrderPathsAction(activeOrder.id);
    setQuoteFeedback(""); setShowQuoteDeclineInput(false); setUpdatingStatus(null);
  };

  const handleApproveDesign = async () => {
    if (!activeOrder) return;
    setUpdatingStatus("design-approve");
    const updated = await approveAllDesignItemsAction(activeOrder.id);
    setOrders(prev => prev.map(o => o.id === activeOrder.id ? { ...o, stage: "Design Approved", design: updated } : o));
    const supabase = createClient();
    await supabase.from("order_activity").insert({ order_id: activeOrder.orderId || activeOrder.id, activity_type: "timeline", actor_name: "System", actor_role: "System", content: "Client approved the design proof layout.", metadata: { action: "design_approved_by_customer" } });
    setUpdatingStatus(null);
  };

  const handleDeclineDesign = async () => {
    if (!activeOrder || !designFeedback.trim()) return;
    setUpdatingStatus("design-decline");
    const design = activeOrder.design || { items: [] };
    const items = (design.items || []).map((item: any) => {
      const versions = item.versions || [];
      if (versions.length === 0) return item;
      const latest = versions[versions.length - 1];
      return { ...item, versions: versions.map((v: any) => v.id === latest.id ? { ...v, status: "Draft" as const } : v) };
    });
    const updated = await updateDesignDetailsAction(activeOrder.id, { items });
    setOrders(prev => prev.map(o => o.id === activeOrder.id ? { ...o, stage: "Design In Progress", design: updated } : o));
    const supabase = createClient();
    await supabase.from("order_activity").insert({ order_id: activeOrder.orderId || activeOrder.id, activity_type: "customer", actor_name: customer.name, actor_role: "Customer", content: `Design Revision Requested. Notes: ${designFeedback}`, metadata: { action: "design_revision_requested" } });
    await supabase.from("orders").update({ stage: "Design In Progress" }).eq("id", activeOrder.id);
    await revalidateOrderPathsAction(activeOrder.id);
    setDesignFeedback(""); setShowDesignDeclineInput(false); setUpdatingStatus(null);
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

  const qd = activeOrder?.quoteDetails || {};
  const pd = activeOrder?.productionDetails || {};
  const inst = activeOrder?.installationDetails || {};

  if (orders.length === 0) {
    return (
      <div className="min-h-screen bg-[#f4f6fb] flex items-center justify-center p-6">
        <div className="bg-white border border-slate-200 rounded-2xl p-10 max-w-md w-full text-center shadow-lg">
          <AlertCircle size={48} className="text-slate-300 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-[#0b1c30] mb-2">No Active Orders</h1>
          <p className="text-sm text-slate-500">We couldn't find any active orders for your account.</p>
          <p className="text-xs text-slate-400 mt-6 font-bold">PRINTOMS Signage Solutions</p>
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
        .chat-scroll::-webkit-scrollbar { width: 4px; }
        .chat-scroll::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 4px; }
        @keyframes slideUp { from { opacity:0; transform: translateY(8px); } to { opacity:1; transform: translateY(0); } }
        .animate-slide-up { animation: slideUp 0.3s ease forwards; }
      `}</style>

      {/* ─── TOP HEADER ─── */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-6 py-3.5 flex items-center justify-between gap-4">
          {/* Left: Logo + Order Info */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-[#1E40AF] rounded-lg flex items-center justify-center">
                <Printer size={16} className="text-white" />
              </div>
              <span className="font-black text-[#0b1c30] text-sm tracking-tight">NORTHSTAR</span>
            </div>
            <div className="w-px h-6 bg-slate-200" />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-black text-[#0b1c30] leading-none">
                  Order #{activeOrder?.orderCode || activeOrder?.id}
                </h1>
                <a
                  href="tel:+919876543210"
                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 hover:bg-blue-100 border border-blue-100 hover:border-blue-200 text-[#1E40AF] rounded-lg text-[10px] font-bold transition-all shadow-sm"
                  title="Call Manager (Sarah Jenkins)"
                >
                  <Phone size={11} className="stroke-[2.5]" />
                  <span>Call Manager</span>
                </a>
              </div>
              <p className="text-slate-500 mt-1">
                Client: {activeOrder?.clientName || customer.name} | {activeOrder?.businessName || "Signage Project"}
              </p>
            </div>
          </div>

          {/* Right: Action Buttons */}
          <div className="flex items-center gap-2.5">
            {orders.length > 1 && (
              <select
                value={activeOrderId}
                onChange={e => setActiveOrderId(e.target.value)}
                className="text-xs border border-slate-200 rounded-lg px-3 py-1.5 text-slate-600 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
              >
                {orders.map(o => (
                  <option key={o.id} value={o.id}>{o.orderCode || o.id} — {o.stage}</option>
                ))}
              </select>
            )}
          </div>
        </div>
      </header>

      {/* ─── PROGRESS STEPPER ─── */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 py-5">
          <div className="flex items-start justify-between relative">
            {/* Background line */}
            <div className="absolute top-[18px] left-0 right-0 h-[2px] bg-slate-100 z-0" />
            {/* Progress fill */}
            <div
              className="absolute top-[18px] left-0 h-[2px] bg-emerald-500 z-0 portal-stepper-line"
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
                  className={`flex flex-col items-center text-center relative z-10 flex-1 ${canOpen ? 'cursor-pointer hover:opacity-80' : ''}`}
                  onClick={() => {
                    if (canOpen) {
                      setViewedStep(idx);
                    }
                  }}
                >
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${isActive
                    ? "bg-[#1E40AF] border-[#1E40AF] text-white shadow-[0_0_0_4px_rgba(30,64,175,0.12)]"
                    : isCompleted
                      ? "bg-emerald-500 border-emerald-500 text-white"
                      : isPaymentsTab
                        ? "bg-white border-blue-200 text-blue-500"
                      : "bg-white border-slate-200 text-slate-400"
                    }`}>
                    {isCompleted && !isActive ? <Check size={14} className="stroke-[3]" /> : <Icon size={14} />}
                  </div>
                  <span className={`text-[11px] font-bold mt-2 block ${isActive ? "text-[#1E40AF]" : isCompleted ? "text-emerald-600" : isPaymentsTab ? "text-blue-500" : "text-slate-400"
                    }`}>
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ─── MAIN CONTENT ─── */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-6">

          {/* ── LEFT: Stage Content ── */}
          <div className="space-y-5">

            {/* Current Stage Panel */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              {/* Stage label bar */}
              <div className="px-6 pt-5 pb-3 border-b border-slate-100 flex items-center justify-between">
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

              <div className="p-6">
                {/* ── ENQUIRIES STAGE ── */}
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

                {/* ── SITE VISIT STAGE ── */}
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
                                    className={`flex flex-col items-center p-3 rounded-xl border text-center min-w-[64px] transition-all cursor-pointer ${selected
                                      ? "bg-[#eff4ff] border-[#1E40AF] text-[#1E40AF] ring-2 ring-blue-100"
                                      : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
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
                                    placeholder="Search for an address or type manually..."
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
                                      options={{ streetViewControl: false, mapTypeControl: false, fullscreenControl: false }}
                                    >
                                      <Marker position={markerPosition} />
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
                              className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 transition-all disabled:opacity-50 shadow-sm"
                            >
                              {schedulingLoading ? <Loader2 size={14} className="animate-spin" /> : null}
                              Confirm Site Visit
                              <Check size={14} />
                            </button>
                            <button type="button" className="px-4 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-colors">
                              Request Callback
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
                          <button onClick={() => setIsRescheduling(true)} className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-50 transition-all flex items-center gap-2 mx-auto">
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

                        {/* ── Installation Requirements ── */}
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

                        {/* ── Fabrication Requirements ── */}
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

                        {/* ── Design Inputs ── */}
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

                {/* ── QUOTATION STAGE ── */}
                {STEPS[activeStepToRender]?.key === "quotation" && (
                  <div className="space-y-6">
                    {/* Header */}
                    <div>
                      <h2 className="text-xl font-black text-[#0b1c30] mb-1">Quotation</h2>
                      <p className="text-sm text-slate-500">Review pricing options, set material preferences, and approve to proceed.</p>
                    </div>
                    {(!qd.status || qd.status === "Draft") ? (
                      <div className="flex flex-col items-center justify-center py-16 px-4 bg-slate-50 border border-slate-200 border-dashed rounded-2xl text-center">
                        <div className="w-16 h-16 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mb-4">
                          <BarChart3 size={24} />
                        </div>
                        <h3 className="text-lg font-bold text-slate-800 mb-2">Quotation is being prepared</h3>
                        <p className="text-sm text-slate-500 max-w-sm">
                          Our team is currently working on your quotation based on the site visit and requirements. You will be notified once it is ready for your review.
                        </p>
                      </div>
                    ) : qd.signageOptions && qd.signageOptions.length > 0 ? (
                      <div className="space-y-6">
                        {/* Invoice Header Details */}
                        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                          <div>
                            <span className="text-[10px] text-slate-400 font-bold uppercase block">Quote ID</span>
                            <span className="font-mono font-bold text-slate-800">{qd.quotationId || "—"}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 font-bold uppercase block">Client & Business</span>
                            <span className="font-bold text-slate-800">{activeOrder.businessName} - {activeOrder.clientName}</span>
                          </div>
                          <div>
                             <span className="text-[10px] text-slate-400 font-bold uppercase block">Status</span>
                             <span className={`inline-block text-[9px] font-black uppercase px-2 py-0.5 rounded-md border ${
                               qd.status === "Approved" ? "bg-emerald-50 border-emerald-200 text-emerald-700" :
                               qd.status === "Rejected" || qd.status === "Negotiation" ? "bg-amber-50 border-amber-200 text-amber-700" :
                               qd.status === "Sent" ? "bg-blue-50 border-blue-200 text-blue-700" :
                               "bg-slate-100 border-slate-200 text-slate-600"
                             }`}>
                               {qd.status === "Rejected" || qd.status === "Negotiation" ? "Sent for Revision" : qd.status}
                             </span>
                           </div>
                        </div>

                        {/* Signage Sections */}
                        <div className="space-y-5">
                          {qd.signageOptions.map((section: any, sIdx: number) => {
                            const itemTotal = (section.lines || []).reduce((sum: number, line: any) => {
                              return sum + calcLineAmount(line) * (1 + (line.gstRate || 0) / 100);
                            }, 0);
                            const svItem = (activeOrder?.siteVisitItems || []).find(
                              (sv: any) => sv.id === section.siteVisitItemId
                            );
                            const measurementLabel = formatSiteMeasurementLabel(svItem);

                            return (
                              <div key={sIdx} className="border border-slate-200 rounded-2xl bg-white overflow-hidden shadow-sm">
                                {/* Section Header */}
                                <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                                  <div className="flex flex-col gap-0.5">
                                    <span className="text-xs font-black text-slate-800 uppercase tracking-wider">{section.itemLabel}</span>
                                    {measurementLabel && (
                                      <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                                        {measurementLabel}
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] text-slate-400 font-black uppercase">Total (incl. GST):</span>
                                    <span className="text-xs font-black text-blue-700 font-mono">
                                      ₹{itemTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                                    </span>
                                  </div>
                                </div>

                                {/* Table */}
                                <div className="overflow-x-auto">
                                  <table className="w-full text-xs text-left">
                                    <thead>
                                      <tr className="bg-slate-50/50 border-b border-slate-200 text-[10px] text-slate-400 font-black uppercase tracking-wider">
                                        <th className="px-4 py-2.5">Item Description</th>
                                        <th className="text-center px-4 py-2.5">Unit</th>
                                        <th className="text-center px-4 py-2.5">Measurement/Qty</th>
                                        <th className="text-right px-4 py-2.5">Rate</th>
                                        <th className="text-center px-4 py-2.5">GST</th>
                                        <th className="text-right px-4 py-2.5">Amount</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 font-medium text-slate-600">
                                      {(section.lines || []).map((line: any, lIdx: number) => {
                                        const lineAmt = calcLineAmount(line) * (1 + (line.gstRate || 0) / 100);
                                        const measurement = getLineMeasurement(line);
                                        const pricingType = normalizePricingType(line.pricingType);

                                        return (
                                          <tr key={lIdx} className="hover:bg-slate-50/30">
                                            <td className="px-4 py-3 text-slate-800 font-bold">
                                              <div className="flex items-center gap-1.5">
                                                <span>{line.description}</span>
                                                {line.productId && (
                                                  <button
                                                    type="button"
                                                    onClick={() => {
                                                      const prod = products.find((p: any) => p.id === line.productId);
                                                      if (prod) setSelectedProductInfo(prod);
                                                    }}
                                                    className="p-0.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors shrink-0"
                                                    title="Product Details"
                                                  >
                                                    <Info size={12} className="stroke-[2.5]" />
                                                  </button>
                                                )}
                                              </div>
                                            </td>
                                            <td className="text-center px-4 py-3 capitalize">{pricingType.replace("per_", "")}</td>
                                            <td className="text-center px-4 py-3 font-mono">
                                              {measurement} {pricingType === "per_sqft" ? (line.unit || "sqft") : (line.unit || "nos")}
                                            </td>
                                            <td className="text-right px-4 py-3 font-mono">₹{line.unitPrice.toLocaleString("en-IN")}</td>
                                            <td className="text-center px-4 py-3 font-mono">{line.gstRate}%</td>
                                            <td className="text-right px-4 py-3 font-mono text-slate-800 font-bold">₹{lineAmt.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Summary Block */}
                        <div className="bg-[#f8fafc] border border-slate-200 rounded-3xl p-6 space-y-4 max-w-md ml-auto">
                          <div className="flex justify-between items-center text-xs font-bold text-slate-500 uppercase tracking-wider pb-3 border-b border-slate-200/50">
                            <span>Subtotal</span>
                            <span className="font-mono text-slate-800">
                              ₹{(qd.subtotal || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                          {qd.discount > 0 && (
                            <div className="flex justify-between items-center text-xs font-bold text-slate-500 uppercase tracking-wider pb-3 border-b border-slate-200/50">
                              <span>Discount</span>
                              <span className="font-mono text-rose-600">
                                - ₹{qd.discount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                              </span>
                            </div>
                          )}
                          {qd.shipping > 0 && (
                            <div className="flex justify-between items-center text-xs font-bold text-slate-500 uppercase tracking-wider pb-3 border-b border-slate-200/50">
                              <span>Shipping</span>
                              <span className="font-mono text-slate-800">
                                ₹{qd.shipping.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                              </span>
                            </div>
                          )}
                          <div className="flex justify-between items-center text-xs font-bold text-slate-500 uppercase tracking-wider pb-3 border-b border-slate-200/50">
                            <span>Tax Amount</span>
                            <span className="font-mono text-slate-800">
                              ₹{(qd.tax || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                          <div className="flex justify-between items-center py-2 border-b border-slate-200">
                            <span className="font-black text-slate-900 text-sm uppercase tracking-wider">Total</span>
                            <span className="font-black text-[#0f172a] text-lg font-mono">
                              ₹{(qd.grandTotal || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        </div>

                        {/* Notes & Terms */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-200 text-xs text-slate-500 text-left">
                          {qd.notes && (
                            <div>
                              <span className="font-bold text-slate-700 block mb-1">Notes</span>
                              <p className="bg-slate-50 border border-slate-100 rounded-xl p-3 leading-relaxed">{qd.notes}</p>
                            </div>
                          )}
                          {qd.terms && (
                            <div>
                              <span className="font-bold text-slate-700 block mb-1">Terms & Conditions</span>
                              <p className="bg-slate-50 border border-slate-100 rounded-xl p-3 leading-relaxed">{qd.terms}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="border border-slate-200 rounded-xl overflow-hidden">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200">
                              <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide">Item</th>
                              <th className="text-right px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide">Amount</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {[
                              { label: "Signage Type", val: qd.signageType || "ACP Panels" },
                              { label: "Materials", val: qd.material || "Brushed Aluminium" },
                              { label: "Mounting", val: qd.mounting || "Standoffs" },
                              { label: "Base Fabrication", val: `₹${(qd.baseACPPrice || 0).toLocaleString("en-IN")}` },
                              { label: "Hardware & Fittings", val: `₹${(qd.hardwarePrice || 0).toLocaleString("en-IN")}` },
                              { label: "Subtotal", val: `₹${(qd.subtotal || 0).toLocaleString("en-IN")}` },
                              { label: "GST (18%)", val: `₹${(qd.tax || 0).toLocaleString("en-IN")}` },
                            ].map((row, i) => (
                              <tr key={i}>
                                <td className="px-4 py-3 text-slate-500 text-xs">{row.label}</td>
                                <td className="px-4 py-3 text-right text-slate-800 font-bold text-xs">{row.val}</td>
                              </tr>
                            ))}
                            <tr className="bg-slate-50">
                              <td className="px-4 py-3.5 font-black text-[#1E40AF] text-sm">Grand Total</td>
                              <td className="px-4 py-3.5 text-right font-black text-emerald-700 text-sm font-mono">₹{(qd.grandTotal || activeOrder?.budget || 0).toLocaleString("en-IN")}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    )}

                    {(qd.status === "Rejected" || qd.status === "Negotiation") ? (
                      <div className="mt-8 bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                        <div className="text-xs text-amber-850">
                          <span className="font-bold">Sent for Revision:</span> We have received your feedback and are revising the quotation. We will notify you once the revised quotation is ready for your review.
                        </div>
                      </div>
                    ) : qd.status === "Sent" && (
                      <div className="mt-8 bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
                        <p className="text-xs font-bold text-[#1E40AF]">{isDesignFirst ? "Approve this quotation to proceed to Production" : "Approve this quotation to proceed to Design"}</p>
                        {showQuoteDeclineInput ? (
                          <div className="space-y-2">
                            <textarea rows={3} value={quoteFeedback} onChange={e => setQuoteFeedback(e.target.value)} placeholder="Your revision feedback..." className="w-full p-2.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-red-500" />
                            <div className="flex gap-2">
                              <button onClick={() => setShowQuoteDeclineInput(false)} className="px-3 py-1.5 border border-slate-200 text-slate-500 rounded-lg text-xs font-bold">Cancel</button>
                              <button onClick={handleDeclineQuote} disabled={!quoteFeedback.trim() || !!updatingStatus} className="px-3.5 py-1.5 bg-red-600 text-white rounded-lg text-xs font-bold disabled:opacity-50">Submit</button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            <button onClick={() => setShowQuoteDeclineInput(true)} className="px-4 py-2 border border-slate-300 bg-white text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-50">Decline / Revise</button>
                            <button onClick={handleApproveQuote} disabled={!!updatingStatus} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 flex items-center gap-1.5 disabled:opacity-50">
                              <Check size={13} /> Approve Quotation
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                    {qd.status === "Approved" && (
                      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center gap-2">
                        <Check size={16} className="text-emerald-600 stroke-[2.5]" />
                        <span className="text-sm font-bold text-emerald-700">Quotation Approved</span>
                      </div>
                    )}
                  </div>
                )}

                {/* ── DESIGN STAGE ── */}
                {STEPS[activeStepToRender]?.key === "design" && (
                  <DesignTab order={activeOrder as any} customer={customer} siteVisitItems={activeOrder?.siteVisitItems || []} />
                )}

                {/* ── PRODUCTION STAGE ── */}
                {STEPS[activeStepToRender]?.key === "production" && (
                  <div className="space-y-5">
                    <div>
                      <h2 className="text-xl font-black text-[#0b1c30] mb-1">Workshop Fabrication Status</h2>
                      <p className="text-sm text-slate-500">Real-time checklist of production milestones.</p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {[
                        { done: pd.procurementOfMaterials, label: "Procurement of Materials" },
                        { done: pd.acpAndAcrylicCutting, label: "ACP & Acrylic Cutting" },
                        { done: pd.lightingAndWiring, label: "Lighting & Wiring" },
                        { done: pd.qualityCheck, label: "Quality Check" },
                      ].map((item, i) => (
                        <div key={i} className={`p-4 border rounded-xl flex items-center justify-between ${item.done ? "bg-emerald-50/50 border-emerald-200 text-emerald-800" : "bg-slate-50 border-slate-200 text-slate-500"}`}>
                          <span className="text-xs font-semibold">{item.label}</span>
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${item.done ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-500"}`}>{item.done ? "Done" : "Pending"}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── INSTALLATION STAGE ── */}
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

                    {inst.gmapRequested && !inst.gmapLink && (
                      <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center shadow-sm">
                        <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-3">
                          <MapPin size={24} className="text-amber-600" />
                        </div>
                        <h3 className="text-lg font-black text-amber-900 mb-2">Exact Location Requested</h3>
                        <p className="text-sm text-amber-700 max-w-md mx-auto mb-4">
                          Our installation team has requested the exact Google Map link of your location so they can arrive smoothly.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-2 max-w-md mx-auto">
                          <input 
                            type="url" 
                            placeholder="Paste Google Maps URL here..."
                            value={customerMapLink}
                            onChange={(e) => setCustomerMapLink(e.target.value)}
                            className="flex-1 p-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
                          />
                          <button 
                            onClick={handleProvideLocation}
                            disabled={!customerMapLink.trim() || submittingMap}
                            className="px-6 py-3 bg-amber-600 text-white font-bold rounded-xl hover:bg-amber-700 disabled:opacity-50 transition-colors"
                          >
                            {submittingMap ? "Submitting..." : "Submit"}
                          </button>
                        </div>
                      </div>
                    )}
                    {inst.gmapLink && (
                      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center gap-3">
                        <div className="p-2 bg-blue-100 rounded-lg"><CheckCircle2 className="text-[#1E40AF]" size={18} /></div>
                        <div>
                          <p className="text-sm font-bold text-[#1E40AF]">Exact Location Provided</p>
                          <p className="text-xs text-blue-700 mt-0.5">Thank you! Our installation team will use this link to reach you.</p>
                        </div>
                      </div>
                    )}
                    {inst.photoUrl ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="border border-slate-200 rounded-xl overflow-hidden aspect-video">
                          <img src={inst.photoUrl} alt="Installation" className="w-full h-full object-cover" onError={e => { e.currentTarget.src = "https://images.unsplash.com/photo-1541888946425-d81bb19240f5?w=400&auto=format&fit=crop"; }} />
                        </div>
                        <div className="space-y-3">
                          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-bold text-emerald-800">✓ Job Completed & Signed off by Client</div>
                          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs">
                            <span className="text-slate-400 uppercase font-bold text-[10px] block mb-1">Signature</span>
                            <span className="font-serif italic text-slate-800 text-sm">{inst.customerSignature}</span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="p-8 bg-slate-50 border border-slate-200 rounded-xl text-center text-slate-400 text-sm">Installation records will appear here once complete.</div>
                    )}
                  </div>
                )}

                {STEPS[activeStepToRender]?.key === "payments" && activeOrder && (
                  <div className="p-6">
                    <PaymentsTab orderId={activeOrder.id} />
                  </div>
                )}
              </div>
            </div>




          </div>

          {/* ── RIGHT SIDEBAR ── */}
          <div className="space-y-5">
            {/* Updates & Chat */}
            {activeOrder && (
              <CustomerChat
                orderId={activeOrder.orderId || activeOrder.id}
                customerId={customer.customerId || customer.id}
                token={token}
                customerName={customer.name}
              />
            )}
          </div>
        </div>
      </div>



      {/* ─── MOBILE FLOATING CHAT BUTTON (hidden on lg+) ─── */}
      {activeOrder && (
        <MobileChatButton
          orderId={activeOrder.orderId || activeOrder.id}
          customerId={customer.customerId || customer.id}
          token={token}
          customerName={customer.name}
        />
      )}
      {selectedProductInfo && (
        <ProductInfoModal
          product={selectedProductInfo}
          onClose={() => setSelectedProductInfo(null)}
        />
      )}

      {/* ── PHOTO VIEWER MODAL ── */}
      {viewerIndex !== null && viewerPhotos.length > 0 && (
        <div 
          className="fixed inset-0 z-[99999] bg-black/90 flex items-center justify-center backdrop-blur-sm"
          onClick={() => setViewerIndex(null)}
        >
          {/* Close button */}
          <button 
            className="absolute top-6 right-6 text-white/70 hover:text-white bg-black/50 hover:bg-black/80 rounded-full p-2.5 transition-all focus:outline-none"
            onClick={() => setViewerIndex(null)}
          >
            <X size={24} />
          </button>
          
          {/* Download button */}
          <a 
            href={viewerPhotos[viewerIndex]} 
            download 
            target="_blank" 
            rel="noopener noreferrer"
            className="absolute top-6 right-20 text-white/70 hover:text-white bg-black/50 hover:bg-black/80 rounded-xl px-4 py-2.5 transition-all focus:outline-none flex items-center gap-2 text-xs font-bold"
            onClick={(e) => e.stopPropagation()}
          >
            <Download size={16} />
            <span>Download</span>
          </a>
          
          {/* Main Image */}
          <div className="relative max-w-4xl max-h-[80vh] w-full h-full flex items-center justify-center p-4">
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
              className="absolute left-6 top-1/2 -translate-y-1/2 text-white/70 hover:text-white bg-black/50 hover:bg-black/80 rounded-full p-3 transition-all focus:outline-none"
              onClick={(e) => { e.stopPropagation(); setViewerIndex(viewerIndex - 1); }}
            >
              <ChevronLeft size={32} />
            </button>
          )}
          
          {/* Next button */}
          {viewerIndex < viewerPhotos.length - 1 && (
            <button
              className="absolute right-6 top-1/2 -translate-y-1/2 text-white/70 hover:text-white bg-black/50 hover:bg-black/80 rounded-full p-3 transition-all focus:outline-none"
              onClick={(e) => { e.stopPropagation(); setViewerIndex(viewerIndex + 1); }}
            >
              <ChevronRight size={32} />
            </button>
          )}
          
          {/* Image Counter */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-black/60 text-white text-sm font-medium px-4 py-1.5 rounded-full backdrop-blur-md">
            {viewerIndex + 1} / {viewerPhotos.length}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────
// Shared Chat Types
// ─────────────────────────────────────────────────
interface ChatProps {
  orderId: string;
  customerId: string;
  token: string;
  customerName: string;
}

interface ChatMsg {
  id: string;
  order_id: string;
  activity_type: string;
  actor_name: string;
  actor_role: string;
  content: string;
  created_at: string;
  is_read: boolean;
}

// ─────────────────────────────────────────────────
// useOrderMessages — shared hook with Supabase Realtime
// ─────────────────────────────────────────────────
function useOrderMessages(
  orderId: string,
  customerId: string,
  token: string,
  customerName: string
) {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const prevCountRef = useRef(0);

  // Initial fetch
  const fetchMessages = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/portal/messages?order_id=${encodeURIComponent(orderId)}&customer_id=${encodeURIComponent(customerId)}&token=${encodeURIComponent(token)}`
      );
      if (res.ok) {
        const { messages: msgs } = await res.json();
        setMessages(msgs || []);
      }
    } catch (e) {
      console.error("Chat fetch error:", e);
    } finally {
      setLoading(false);
    }
  }, [orderId, customerId, token]);

  // Subscribe to Supabase Realtime for instant updates
  useEffect(() => {
    fetchMessages();
    const supabase = createClient();
    // Use unique channel name per mount to avoid Supabase channel cache collision (Strict Mode)
    const channelName = `portal-chat-${orderId}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "order_activity",
          filter: `order_id=eq.${orderId}`,
        },
        (payload) => {
          const newMsg = payload.new as ChatMsg;
          if (newMsg.activity_type !== "customer") return; // Only show customer-tab messages in portal
          setMessages((prev) => {
            // Prevent duplicates
            if (prev.some((m) => m.id === newMsg.id || (m.id.startsWith("opt-") && m.content === newMsg.content))) {
              // Replace optimistic message with real one
              if (newMsg.actor_role === "Customer") {
                return prev.map((m) => (m.id.startsWith("opt-") && m.content === newMsg.content ? newMsg : m));
              }
              return prev;
            }
            return [...prev, newMsg];
          });
        }
      )
      .subscribe();

    return () => {
      // Unsubscribe and remove to prevent "already subscribed" errors on re-mount
      channel.unsubscribe();
      supabase.removeChannel(channel);
    };
  }, [orderId, fetchMessages]);

  // Mark messages as read when count grows (for mobile badge)
  const unreadCount = useMemo(() => {
    let count = 0;
    messages.forEach((m) => {
      if (m.actor_role !== "Customer" && m.actor_role !== "System" && !m.is_read) {
        count++;
      }
    });
    return count;
  }, [messages]);

  const sendMessage = useCallback(
    async (text: string, optimisticId: string): Promise<boolean> => {
      const trimmed = text.trim();
      if (!trimmed || sending) return false;
      setSending(true);
      try {
        const res = await fetch("/api/portal/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            order_id: orderId,
            customer_id: customerId,
            token,
            content: trimmed,
            sender_name: customerName,
          }),
        });
        if (!res.ok) throw new Error("Send failed");
        return true;
      } catch (e) {
        console.error("Send error:", e);
        return false;
      } finally {
        setSending(false);
      }
    },
    [orderId, customerId, token, customerName]
  );

  // Optimistic send with rollback
  const sendWithOptimistic = useCallback(
    async (input: string, setInput: (val: string) => void) => {
      const trimmed = input.trim();
      if (!trimmed) return;
      setInput("");
      const optimisticId = `opt-${Date.now()}`;
      const optimistic: ChatMsg = {
        id: optimisticId,
        order_id: orderId,
        activity_type: "customer",
        actor_name: customerName,
        actor_role: "Customer",
        content: trimmed,
        created_at: new Date().toISOString(),
        is_read: false,
      };
      // Add optimistic message
      setMessages((prev) => [...prev, optimistic]);
      // Try to send
      const success = await sendMessage(trimmed, optimisticId);
      if (!success) {
        // Rollback: remove the optimistic message
        setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
      }
    },
    [orderId, customerName, sendMessage]
  );

  return { messages, loading, sending, unreadCount, sendWithOptimistic };
}

// ─────────────────────────────────────────────────
// CustomerChat — sidebar version (desktop)
// ─────────────────────────────────────────────────
function CustomerChat({ orderId, customerId, token, customerName }: ChatProps) {
  const [input, setInput] = useState("");
  const [expanded, setExpanded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { messages, loading, sending, sendWithOptimistic } = useOrderMessages(
    orderId,
    customerId,
    token,
    customerName
  );

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;
    await sendWithOptimistic(input, setInput);
  }

  const chatBody = (
    <>
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between flex-shrink-0 bg-white">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.15)]" />
          <h3 className="text-xs font-black text-[#0b1c30] uppercase tracking-widest">Updates & Chat</h3>
        </div>
        <button
          onClick={() => setExpanded(e => !e)}
          className="p-1.5 text-slate-400 hover:text-[#1E40AF] hover:bg-blue-50 rounded-lg transition-all"
          title={expanded ? "Minimize" : "Expand to fullscreen"}
        >
          {expanded ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#FCFCFD]">
        {loading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={18} className="animate-spin text-slate-300" />
          </div>
        )}
        {!loading && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-slate-400 gap-2">
            <MessageSquare size={24} className="stroke-1 opacity-50" />
            <p className="text-xs font-medium text-center">No messages yet.<br />Send a message to start chatting with the Printoms team.</p>
          </div>
        )}
        {messages.map((msg) => {
          const isMe = msg.actor_role === "Customer";
          const initials = msg.actor_name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2);
          const time = new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
          if (msg.actor_role === "System") {
            return (
              <div key={msg.id} className="flex justify-center">
                <span className="text-[10px] text-slate-400 bg-slate-100 border border-slate-200 px-3 py-1 rounded-full font-medium">{msg.content}</span>
              </div>
            );
          }
          return (
            <div key={msg.id} className={`flex items-end gap-2 ${isMe ? "flex-row-reverse" : ""}`}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-black shrink-0 ${isMe ? "bg-[#1E40AF] text-white" : "bg-slate-200 text-slate-600"
                }`}>{initials}</div>
              <div className={`flex flex-col max-w-[78%] ${isMe ? "items-end" : "items-start"}`}>
                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wide mb-0.5 px-1">{msg.actor_name}</span>
                <div className={`px-3 py-2 rounded-2xl text-xs leading-relaxed break-words shadow-sm ${isMe
                  ? "bg-[#1E40AF] text-white rounded-br-sm"
                  : "bg-white text-slate-800 border border-slate-200 rounded-bl-sm"
                  }`}>{msg.content}</div>
                <span className="text-[9px] text-slate-400 mt-1 px-1 font-mono">{time}{isMe && <CheckCheck size={9} className="inline ml-1 text-slate-300" />}</span>
              </div>
            </div>
          );
        })}
        <div ref={scrollRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="p-3 border-t border-slate-200 bg-white flex items-center gap-2 flex-shrink-0">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Type a message..."
          className="flex-1 px-3 py-2.5 border border-slate-200 rounded-xl text-xs bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
          disabled={sending}
        />
        <button
          type="submit"
          disabled={!input.trim() || sending}
          className="p-2.5 bg-[#1E40AF] text-white rounded-xl hover:bg-blue-700 transition-all disabled:opacity-40 flex items-center justify-center"
        >
          {sending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
        </button>
      </form>
    </>
  );

  return (
    <>
      {/* Desktop sidebar card (hidden on mobile) */}
      <div className="hidden lg:flex bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex-col" style={{ height: "600px" }}>
        {chatBody}
      </div>

      {/* Expanded popup modal */}
      {expanded && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="w-full max-w-xl h-[85vh] bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col">
            {chatBody}
          </div>
        </div>
      )}
    </>
  );
}

// ─────────────────────────────────────────────────
// MobileChatButton — floating button for mobile
// ─────────────────────────────────────────────────
function MobileChatButton({ orderId, customerId, token, customerName }: ChatProps) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const { messages, loading, sending, unreadCount, sendWithOptimistic } = useOrderMessages(
    orderId,
    customerId,
    token,
    customerName
  );

  // Scroll to bottom when chat opens
  useEffect(() => {
    if (open) {
      scrollRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [open]);

  // Scroll to bottom when new messages arrive while chat is open
  useEffect(() => {
    if (open) {
      scrollRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, open]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;
    await sendWithOptimistic(input, setInput);
  }

  return (
    <div className="lg:hidden">
      {/* Floating Button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-[#1E40AF] text-white rounded-full shadow-xl hover:bg-blue-700 transition-all hover:scale-105 flex items-center justify-center"
        >
          <MessageSquare size={22} />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center border-2 border-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      )}

      {/* Mobile Chat Panel */}
      {open && (
        <div className="fixed inset-0 z-[60] flex flex-col justify-end bg-slate-900/50 backdrop-blur-sm transition-all" onClick={() => setOpen(false)}>
          <div className="w-full h-[85vh] bg-white rounded-t-2xl flex flex-col overflow-hidden shadow-[0_-10px_40px_rgba(0,0,0,0.1)]" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="px-4 py-3 bg-[#0b1c30] text-white flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2">
                <MessageSquare size={16} className="text-blue-300" />
                <span className="text-sm font-black">Chat with Printoms</span>
                <span className="text-[9px] bg-emerald-500 text-white px-1.5 py-0.5 rounded-full font-bold">LIVE</span>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-all"
              >
                <X size={18} />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#FCFCFD]">
              {loading && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 size={18} className="animate-spin text-slate-300" />
                </div>
              )}
              {!loading && messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full py-20 text-slate-400 gap-3">
                  <MessageSquare size={32} className="stroke-1 opacity-40" />
                  <p className="text-sm font-medium text-center">No messages yet.<br />Send us a message!</p>
                </div>
              )}
              {messages.map((msg) => {
                const isMe = msg.actor_role === "Customer";
                const initials = msg.actor_name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2);
                const time = new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
                if (msg.actor_role === "System") {
                  return (
                    <div key={msg.id} className="flex justify-center">
                      <span className="text-[10px] text-slate-400 bg-slate-100 border border-slate-200 px-3 py-1 rounded-full font-medium">{msg.content}</span>
                    </div>
                  );
                }
                return (
                  <div key={msg.id} className={`flex items-end gap-2 ${isMe ? "flex-row-reverse" : ""}`}>
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 ${isMe ? "bg-[#1E40AF] text-white" : "bg-slate-200 text-slate-600"
                      }`}>{initials}</div>
                    <div className={`flex flex-col max-w-[75%] ${isMe ? "items-end" : "items-start"}`}>
                      <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wide mb-0.5 px-1">{msg.actor_name}</span>
                      <div className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed break-words ${isMe
                        ? "bg-[#1E40AF] text-white rounded-br-sm"
                        : "bg-white text-slate-800 border border-slate-200 rounded-bl-sm shadow-sm"
                        }`}>{msg.content}</div>
                      <span className="text-[9px] text-slate-400 mt-1 px-1 font-mono">{time}</span>
                    </div>
                  </div>
                );
              })}
              <div ref={scrollRef} />
            </div>

            {/* Input */}
            <form onSubmit={handleSend} className="p-4 border-t border-slate-200 bg-white flex items-center gap-3 flex-shrink-0 pb-safe">
              <input
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="Type a message..."
                className="flex-1 px-4 py-3 border border-slate-200 rounded-2xl text-sm bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                disabled={sending}
              />
              <button
                type="submit"
                disabled={!input.trim() || sending}
                className="w-11 h-11 bg-[#1E40AF] text-white rounded-full hover:bg-blue-700 transition-all disabled:opacity-40 flex items-center justify-center flex-shrink-0"
              >
                {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Product Info Popup Modal Component
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
