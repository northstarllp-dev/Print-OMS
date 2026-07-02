"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  ArrowLeft,
  MapPin,
  FileCheck,
  Layout,
  CreditCard,
  MessageSquare,
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
import { scheduleSiteVisitAction } from "@/features/orders/actions/orderActions";
import { mapSiteVisitFromDb } from "@/features/orders/actions/siteVisitMapper";
import { GoogleMap, useJsApiLoader, Marker, Autocomplete } from "@react-google-maps/api";
import { DesignTab } from "../../components/DesignTab";

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
  projectName: string;
  customerId: string;
  customerName?: string;
  stage: string;
  assignedEmployees: string[];
  dateCreated: string;
  versionHistory: any[];
  chatHistory: any[];
  siteVisitDetails?: any;
  quoteDetails?: any;
  designDetails?: any;
  productionDetails?: any;
  installationDetails?: any;
  stageStatus?: string;
  stageAdminNotes?: string;
  orderCode?: string;
  orderId?: string;
  workflow_type?: string;
}

interface OrderDetailClientProps {
  customer: Customer;
  order: Order;
  siteVisitItems?: any[];
  token: string;
}

export function OrderDetailClient({ customer, order: initialOrder, siteVisitItems = [], token }: OrderDetailClientProps) {
  const workflowType = initialOrder.workflow_type || "quote_first";
  const isDesignFirst = workflowType === "design_first";

  const stages = isDesignFirst 
    ? ["Enquiries", "Site Visit", "Design", "Quotations", "Production", "Installation"]
    : ["Enquiries", "Site Visit", "Quotations", "Design", "Production", "Installation"];

  const tabs = isDesignFirst
    ? [
        { id: "site_visit", label: "Site Visit", icon: MapPin },
        { id: "design", label: "Design", icon: Layout },
        { id: "quotation", label: "Quotation", icon: FileCheck },
        { id: "billing", label: "Billing", icon: CreditCard },
        { id: "chat", label: "Chat", icon: MessageSquare },
      ]
    : [
        { id: "site_visit", label: "Site Visit", icon: MapPin },
        { id: "quotation", label: "Quotation", icon: FileCheck },
        { id: "design", label: "Design", icon: Layout },
        { id: "billing", label: "Billing", icon: CreditCard },
        { id: "chat", label: "Chat", icon: MessageSquare },
      ];

  // Determine initial tab based on order stage
  const getInitialTab = () => {
    if (!initialOrder.stage) return "site_visit";
    if (initialOrder.stage.includes("Site Visit")) return "site_visit";
    if (initialOrder.stage.includes("Quotation")) return "quotation";
    if (initialOrder.stage.includes("Design")) return "design";
    if (initialOrder.stage.includes("Production") || initialOrder.stage.includes("Ready For")) return "billing";
    if (initialOrder.stage.includes("Installation") || initialOrder.stage.includes("Completed") || initialOrder.stage.includes("Closed")) return "chat";
    return "site_visit";
  };
  
  const [activeTab, setActiveTab] = useState(getInitialTab());
  const [order, setOrder] = useState(initialOrder);

  const [products, setProducts] = useState<any[]>([]);
  const [selectedProductInfo, setSelectedProductInfo] = useState<any | null>(null);

  const [quoteFeedback, setQuoteFeedback] = useState("");
  const [designFeedback, setDesignFeedback] = useState("");
  const [showQuoteDeclineInput, setShowQuoteDeclineInput] = useState(false);
  const [showDesignDeclineInput, setShowDesignDeclineInput] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState(100);

  const handleApproveQuote = async () => {
    if (!order) return;
    setUpdatingStatus("quote-approve");
    const supabase = createClient();
    const updatedQuote = { ...order.quoteDetails, status: "Approved" };
    setOrder(prev => ({ ...prev, stage: "Quotation Approved", quoteDetails: updatedQuote }));
    await supabase.from("order_activity").insert({ order_id: order.orderId || order.id, activity_type: "timeline", actor_name: "System", actor_role: "System", content: "Client approved the quotation details.", metadata: { action: "quotation_approved_by_customer" } });
    await supabase.from("quotations").update({ status: "Approved" }).eq("order_id", order.id);
    await supabase.from("orders").update({ stage: "Quotation Approved" }).eq("id", order.id);
    setUpdatingStatus(null);
  };

  const handleDeclineQuote = async () => {
    if (!order || !quoteFeedback.trim()) return;
    setUpdatingStatus("quote-decline");
    const supabase = createClient();
    const updatedQuote = { ...order.quoteDetails, status: "Negotiation" };
    setOrder(prev => ({ ...prev, stage: "Quotation Negotiation", quoteDetails: updatedQuote }));
    await supabase.from("order_activity").insert({ order_id: order.orderId || order.id, activity_type: "customer", actor_name: customer.name, actor_role: "Customer", content: `Quotation Declined. Feedback: ${quoteFeedback}`, metadata: { action: "quotation_declined" } });
    await supabase.from("quotations").update({ status: "Rejected" }).eq("order_id", order.id);
    await supabase.from("orders").update({ stage: "Quotation Negotiation" }).eq("id", order.id);
    setQuoteFeedback(""); setShowQuoteDeclineInput(false); setUpdatingStatus(null);
  };

  const handleApproveDesign = async () => {
    if (!order) return;
    setUpdatingStatus("design-approve");
    const supabase = createClient();
    const updatedDesign = { ...order.designDetails, status: "Approved" };
    setOrder(prev => ({ ...prev, stage: "Design Approved", designDetails: updatedDesign }));
    await supabase.from("order_activity").insert({ order_id: order.orderId || order.id, activity_type: "timeline", actor_name: "System", actor_role: "System", content: "Client approved the design proof layout.", metadata: { action: "design_approved_by_customer" } });
    await supabase.from("orders").update({ stage: "Design Approved", design_details: updatedDesign }).eq("id", order.id);
    setUpdatingStatus(null);
  };

  const handleDeclineDesign = async () => {
    if (!order || !designFeedback.trim()) return;
    setUpdatingStatus("design-decline");
    const supabase = createClient();
    const updatedDesign = { ...order.designDetails, status: "Draft" };
    setOrder(prev => ({ ...prev, stage: "Design In Progress", designDetails: updatedDesign }));
    await supabase.from("order_activity").insert({ order_id: order.orderId || order.id, activity_type: "customer", actor_name: customer.name, actor_role: "Customer", content: `Design Revision Requested. Notes: ${designFeedback}`, metadata: { action: "design_revision_requested" } });
    await supabase.from("orders").update({ stage: "Design In Progress", design_details: updatedDesign }).eq("id", order.id);
    setDesignFeedback(""); setShowDesignDeclineInput(false); setUpdatingStatus(null);
  };

  useEffect(() => {
    const supabase = createClient();
    async function loadProducts() {
      const { data } = await supabase.from("products").select("*").eq("is_active", true);
      if (data) setProducts(data);
    }
    loadProducts();
  }, []);
  
  // Site Visit scheduling states
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [siteAddress, setSiteAddress] = useState(customer.shippingAddress || "");
  const [gpsCoords, setGpsCoords] = useState("12.9716, 77.5946");
  const [isRescheduling, setIsRescheduling] = useState(false);
  const [schedulingLoading, setSchedulingLoading] = useState(false);
  const [mapsSearching, setMapsSearching] = useState(false);

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
    "Ready For Installation": "Production",
    "Installation Scheduled": "Installation",
    "Completed": "Installation",
    "Closed": "Installation",
  };
  const mappedStage = stageMapping[order.stage] || "Enquiries";
  const currentStageIndex = stages.indexOf(mappedStage) !== -1 ? stages.indexOf(mappedStage) : 0;
  const sv = order.siteVisitDetails || {};
  const qd = order.quoteDetails || {};
  const dd = order.designDetails || {};

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

  // Realtime subscription to sync order, site visit, and quotation changes dynamically
  useEffect(() => {
    if (!order) return;
    const supabase = createClient();
    const orderChannelName = `portal-order-detail-sync-${order.id}-${Date.now()}`;

    const channel = supabase
      .channel(orderChannelName)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders", filter: `id=eq.${order.id}` },
        (payload) => {
          if (payload.eventType === "UPDATE" || payload.eventType === "INSERT") {
            const updatedOrder = payload.new as any;
            if (updatedOrder) {
              setOrder(prev => ({
                ...prev,
                stage: updatedOrder.stage,
                depositPaid: Number(updatedOrder.deposit_paid) || 0,

                designDetails: updatedOrder.design_details,
                // productionDetails & installationDetails aren't on the orders table anymore,
                // so we don't update them from this realtime event.
                stageStatus: updatedOrder.stage_status,
                stageAdminNotes: updatedOrder.stage_admin_notes,
              }));
            }
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "site_visits", filter: `order_id=eq.${order.id}` },
        (payload) => {
          if (payload.eventType === "DELETE") {
            setOrder(prev => ({
              ...prev,
              siteVisitDetails: undefined
            }));
          } else {
            const mapped = mapSiteVisitFromDb(payload.new);
            if (mapped) {
              setOrder(prev => ({
                ...prev,
                siteVisitDetails: {
                  ...mapped,
                  locations: mapped.locations && mapped.locations.length > 0 ? mapped.locations : (prev.siteVisitDetails?.locations || [])
                }
              }));
            }
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "quotations", filter: `order_id=eq.${order.id}` },
        (payload) => {
          if (payload.eventType === "UPDATE" || payload.eventType === "INSERT") {
            const updatedQuote = payload.new as any;
            if (updatedQuote) {
              setOrder(prev => ({
                ...prev,
                quoteDetails: {
                  ...(prev.quoteDetails || {}),
                  quotationId: updatedQuote.quotation_id,
                  status: updatedQuote.status,
                  grandTotal: Number(updatedQuote.grand_total) || 0,
                  subtotal: Number(updatedQuote.subtotal) || 0,
                  discount: Number(updatedQuote.discount) || 0,
                  tax: Number(updatedQuote.tax) || 0,
                  advancePaid: updatedQuote.advance_paid || false,
                  signageOptions: updatedQuote.signage_options || [],
                  shipping: Number(updatedQuote.shipping) || 0,
                  notes: updatedQuote.notes || "",
                  terms: updatedQuote.terms || "",
                }
              }));
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [order.id]);

  // Debug active tab
  useEffect(() => {
    console.log("Active tab changed to:", activeTab);
  }, [activeTab]);

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
      const payload = { auditDate: selectedDate, auditTime: selectedTime, customerAddress: siteAddress, gpsLocation: gpsCoords, completed: false, reviewStatus: "Pending" };
      const res = await scheduleSiteVisitAction(order.id, payload);
      if (res.success && res.order) {
        setOrder(prev => ({ ...prev, stage: res.order.stage, siteVisitDetails: res.order.siteVisitDetails }));
        setIsRescheduling(false);
      }
    } catch (err) { console.error(err); }
    finally { setSchedulingLoading(false); }
  };

  const handleBackToPortal = () => {
    const url = new URL("/portal", window.location.origin);
    url.searchParams.set("customer_id", customer.customerId || customer.id);
    url.searchParams.set("token", token);
    window.location.href = url.toString();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={handleBackToPortal}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft size={20} className="text-gray-600" />
            </button>
            <div>
              <h1 className="text-2xl font-extrabold text-gray-900">{order.projectName}</h1>
              <p className="text-sm text-gray-500">Order {order.orderCode || order.id}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className={`px-3 py-1 rounded-full text-xs font-bold ${
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
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            {stages.map((stage, idx) => {
              const isCompleted = idx < currentStageIndex;
              const isActive = idx === currentStageIndex;
              
              const tabMap: Record<string, string> = {
                "Enquiries": "site_visit",
                "Site Visit": "site_visit",
                "Quotations": "quotation",
                "Design": "design",
                "Production": "billing",
                "Installation": "chat"
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
                    onClick={() => {
                      console.log("CLICKED", stage, "setting to", targetTab);
                      setActiveTab(targetTab);
                    }}
                    className="flex flex-col items-center gap-2 focus:outline-none focus:ring-4 focus:ring-blue-200 rounded-xl p-2"
                    style={{ cursor: "pointer" }}
                  >
                    <div
                      className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${
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
                      className={`text-sm font-semibold ${
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
                    <div className={`flex-1 h-1 mx-4 rounded-full ${
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
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex gap-2 overflow-x-auto py-2">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-5 py-3 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${
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
      <main className="max-w-7xl mx-auto px-6 py-8">
        {activeTab === "site_visit" && (
          <div className="space-y-6">
            {(!sv.auditDate || isRescheduling) ? (
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
                          className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none bg-gray-50 focus:bg-white transition-all"
                        />
                      </Autocomplete>
                    ) : (
                      <input
                        type="text"
                        required
                        value={siteAddress}
                        onChange={e => setSiteAddress(e.target.value)}
                        placeholder="Full address where signage will be installed"
                        className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none bg-gray-50 focus:bg-white transition-all"
                      />
                    )}

                    {/* Map visual */}
                    <div className="mt-2 border border-gray-200 rounded-xl overflow-hidden bg-gray-50">
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
                      <div className="px-3 py-2 bg-white border-t border-gray-200 flex items-center justify-between">
                        <span className="text-[10px] font-mono font-semibold text-gray-600">📍 {gpsCoords}</span>
                        <button
                          type="button"
                          onClick={handleCurrentLocation}
                          className="flex items-center gap-1 text-[10px] font-bold text-blue-600 hover:underline cursor-pointer"
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
                    <button type="button" className="px-4 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm font-semibold hover:bg-gray-50 transition-colors">
                      Request Callback
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
                  <div className="col-span-2"><span className="text-[10px] text-gray-400 uppercase font-bold block">Address</span><p className="font-medium text-gray-800 mt-0.5">{sv.customerAddress}</p></div>
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
        {activeTab === "quotation" && (
          <QuotationTab
            order={order}
            products={products}
            setSelectedProductInfo={setSelectedProductInfo}
            showQuoteDeclineInput={showQuoteDeclineInput}
            setShowQuoteDeclineInput={setShowQuoteDeclineInput}
            quoteFeedback={quoteFeedback}
            setQuoteFeedback={setQuoteFeedback}
            updatingStatus={updatingStatus}
            handleApproveQuote={handleApproveQuote}
            handleDeclineQuote={handleDeclineQuote}
          />
        )}
        {activeTab === "design" && (
          <DesignTab order={order} customer={customer} siteVisitItems={siteVisitItems} />
        )}
        {activeTab === "billing" && <BillingTab order={order} />}
        {activeTab === "chat" && <ChatTab order={order} />}
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

interface QuotationTabProps {
  order: Order;
  products: any[];
  setSelectedProductInfo: (prod: any) => void;
  showQuoteDeclineInput: boolean;
  setShowQuoteDeclineInput: (show: boolean) => void;
  quoteFeedback: string;
  setQuoteFeedback: (val: string) => void;
  updatingStatus: string | null;
  handleApproveQuote: () => Promise<void>;
  handleDeclineQuote: () => Promise<void>;
}

function QuotationTab({
  order,
  products,
  setSelectedProductInfo,
  showQuoteDeclineInput,
  setShowQuoteDeclineInput,
  quoteFeedback,
  setQuoteFeedback,
  updatingStatus,
  handleApproveQuote,
  handleDeclineQuote,
}: QuotationTabProps) {
  const qd = order.quoteDetails || {};
  const items = qd.items || [];
  
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-gray-200 p-8 shadow-sm">
        <div className="flex items-start justify-between mb-8">
          <div>
            <h2 className="text-2xl font-extrabold text-gray-900">Quotation</h2>
            <p className="text-sm text-gray-500 mt-2">Valid for 7 days</p>
          </div>
          <span className={`px-4 py-2 border rounded-full text-sm font-bold ${
            qd.status === "Approved" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
            qd.status === "Sent" ? "bg-blue-50 text-blue-700 border-blue-200" :
            "bg-gray-50 text-gray-600 border-gray-200"
          }`}>
            {qd.status || "Pending"}
          </span>
        </div>

        {qd.signageOptions && qd.signageOptions.length > 0 ? (
          <div className="space-y-6">
            {/* Invoice Header Details */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 grid grid-cols-2 md:grid-cols-3 gap-4 text-xs mb-6">
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Quote ID</span>
                <span className="font-mono font-bold text-slate-800">{qd.quotationId || "—"}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Project Name</span>
                <span className="font-bold text-slate-800">{order.projectName}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Status</span>
                <span className={`inline-block text-[9px] font-black uppercase px-2 py-0.5 rounded-md border ${
                  qd.status === "Approved" ? "bg-emerald-50 border-emerald-200 text-emerald-700" :
                  qd.status === "Sent" ? "bg-blue-50 border-blue-200 text-blue-700" :
                  "bg-slate-100 border-slate-200 text-slate-600"
                }`}>
                  {qd.status}
                </span>
              </div>
            </div>

            <div className="space-y-5">
              {qd.signageOptions.map((section: any, sIdx: number) => {
                const itemTotal = (section.lines || []).reduce((sum: number, line: any) => {
                  const calcLineAmount = (item: any): number => {
                    let base = 0;
                    if (item.pricingType === "per_sqft" || item.pricingType === "per_running_ft") {
                      base = item.quantity * item.totalSqFt * item.unitPrice;
                    } else {
                      base = item.quantity * item.unitPrice;
                    }
                    return base * (1 + (item.gstRate || 0) / 100);
                  };
                  return sum + calcLineAmount(line);
                }, 0);

                return (
                  <div key={sIdx} className="border border-slate-200 rounded-2xl bg-white overflow-hidden shadow-sm">
                    {/* Section Header */}
                    <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                      <span className="text-xs font-black text-slate-800 uppercase tracking-wider">{section.itemLabel}</span>
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
                            <th className="text-center px-4 py-2.5">Qty</th>
                            <th className="text-center px-4 py-2.5">Unit</th>
                            <th className="text-center px-4 py-2.5">Measure</th>
                            <th className="text-right px-4 py-2.5">Rate</th>
                            <th className="text-center px-4 py-2.5">GST</th>
                            <th className="text-right px-4 py-2.5">Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-medium text-slate-600">
                          {(section.lines || []).map((line: any, lIdx: number) => {
                            const lineAmt = (() => {
                              let base = 0;
                              if (line.pricingType === "per_sqft" || line.pricingType === "per_running_ft") {
                                base = line.quantity * line.totalSqFt * line.unitPrice;
                              } else {
                                base = line.quantity * line.unitPrice;
                              }
                              return base * (1 + (line.gstRate || 0) / 100);
                            })();
                            const isSqft = line.pricingType === "per_sqft" || line.pricingType === "per_running_ft";

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
                                <td className="text-center px-4 py-3 font-mono">{line.quantity}</td>
                                <td className="text-center px-4 py-3 capitalize">{line.pricingType?.replace("per_", "")}</td>
                                <td className="text-center px-4 py-3 font-mono">{isSqft ? `${line.totalSqFt} ${line.unit || "ft"}` : "—"}</td>
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
        ) : items.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-gray-200 text-slate-500 font-bold uppercase tracking-wider">
                  <th className="py-3 pr-4">Description</th>
                  <th className="text-center py-3 px-2">Qty</th>
                  <th className="text-right py-3 px-2">Cost/Sq Ft</th>
                  <th className="text-right py-3 px-2">Total Sq Ft</th>
                  <th className="text-right py-3 px-2">Unit Price</th>
                  <th className="text-right py-3 px-2">GST %</th>
                  <th className="text-right py-3 pl-4">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((item: any) => {
                  const lineTotal = item.quantity * item.unitPrice;
                  return (
                    <tr key={item.id} className="hover:bg-slate-50/30">
                      <td className="py-3 pr-4 font-bold text-slate-800">
                        <div className="flex items-center gap-1.5">
                          <span>{item.description}</span>
                          {item.productId && (
                            <button
                              type="button"
                              onClick={() => {
                                const prod = products.find((p: any) => p.id === item.productId);
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
                      <td className="py-3 px-2 text-center font-mono text-gray-800">{item.quantity}</td>
                      <td className="py-3 px-2 text-right font-mono text-gray-800">₹{(item.costPerSqFt || 0).toLocaleString("en-IN")}</td>
                      <td className="py-3 px-2 text-right font-mono text-gray-800">{(item.totalSqFt || 0).toLocaleString("en-IN")} sq ft</td>
                      <td className="py-3 px-2 text-right font-mono text-gray-800">₹{(item.unitPrice || 0).toLocaleString("en-IN")}</td>
                      <td className="py-3 px-2 text-right font-mono text-gray-800">{item.gstRate}%</td>
                      <td className="py-3 pl-4 font-mono text-gray-800 text-right font-bold">₹{lineTotal.toLocaleString("en-IN")}</td>
                    </tr>
                  );
                })}
                {qd.discount > 0 && (
                  <tr className="bg-rose-50/50">
                    <td colSpan={6} className="py-3 text-sm font-semibold text-rose-700 text-right pr-3">
                      Less Discount:
                    </td>
                    <td className="py-3 text-sm font-mono text-rose-700 text-right font-bold">
                      - ₹{(qd.discount || 0).toLocaleString("en-IN")}
                    </td>
                  </tr>
                )}
                {qd.shipping > 0 && (
                  <tr className="bg-slate-50/50">
                    <td colSpan={6} className="py-3 text-sm font-semibold text-slate-700 text-right pr-3">
                      Shipping:
                    </td>
                    <td className="py-3 text-sm font-mono text-slate-700 text-right font-bold">
                      ₹{(qd.shipping || 0).toLocaleString("en-IN")}
                    </td>
                  </tr>
                )}
                <tr className="bg-blue-50/50">
                  <td colSpan={6} className="py-3 text-sm font-semibold text-blue-900 text-right pr-3">
                    Subtotal:
                  </td>
                  <td className="py-3 text-sm font-mono text-blue-900 text-right font-bold">
                    ₹{(qd.subtotal || 0).toLocaleString("en-IN")}
                  </td>
                </tr>
                <tr className="bg-blue-50/50">
                  <td colSpan={6} className="py-3 text-sm font-semibold text-blue-900 text-right pr-3">
                    Total GST:
                  </td>
                  <td className="py-3 text-sm font-mono text-blue-900 text-right font-bold">
                    ₹{(qd.tax || 0).toLocaleString("en-IN")}
                  </td>
                </tr>
                <tr className="bg-gray-50">
                  <td colSpan={6} className="py-4 text-lg font-extrabold text-gray-900 text-right pr-3">
                    Grand Total:
                  </td>
                  <td className="py-4 text-lg font-extrabold text-emerald-700 text-right font-mono">
                    ₹{(qd.grandTotal || 0).toLocaleString("en-IN")}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12 text-gray-500">
            <p className="text-lg">Quotation is being prepared.</p>
            <p className="text-sm mt-2">Check back later for updates!</p>
          </div>
        )}

        {qd.status !== "Approved" && (qd.status === "Sent" || qd.status === "Negotiation" || (qd.grandTotal > 0 && (order.stage === "Quotation Sent" || order.stage === "Quotation Negotiation"))) && (
          <div className="mt-8 bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
            <p className="text-xs font-bold text-[#1E40AF]">Approve this quotation to proceed to Design</p>
            {showQuoteDeclineInput ? (
              <div className="space-y-2">
                <textarea rows={3} value={quoteFeedback} onChange={e => setQuoteFeedback(e.target.value)} placeholder="Your revision feedback..." className="w-full p-2.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-red-500 bg-white" />
                <div className="flex gap-2">
                  <button onClick={() => setShowQuoteDeclineInput(false)} className="px-3 py-1.5 border border-slate-200 text-slate-500 rounded-lg text-xs font-bold bg-white">Cancel</button>
                  <button onClick={handleDeclineQuote} disabled={!quoteFeedback.trim() || !!updatingStatus} className="px-3.5 py-1.5 bg-red-600 text-white rounded-lg text-xs font-bold disabled:opacity-50">Submit</button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                <button onClick={() => setShowQuoteDeclineInput(true)} className="px-4 py-2 border border-slate-300 bg-white text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-50">Decline / Revise</button>
                <button onClick={handleApproveQuote} disabled={!!updatingStatus} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 flex items-center gap-1.5 disabled:opacity-50">
                  {updatingStatus === "quote-approve" ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Approve Quotation
                </button>
              </div>
            )}
          </div>
        )}
        {qd.status === "Approved" && (
          <div className="mt-8 bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center gap-2">
            <Check size={16} className="text-emerald-600 stroke-[2.5]" />
            <span className="text-sm font-bold text-emerald-700">Quotation Approved</span>
          </div>
        )}
      </div>
    </div>
  );
}



function BillingTab({ order }: { order: Order }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Payment Summary</h3>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Total Amount</span>
              <span className="text-xl font-bold text-gray-900 font-mono">
                ₹0
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Paid Amount</span>
              <span className="text-xl font-bold text-green-600 font-mono">
                ₹0
              </span>
            </div>
            <div className="flex items-center justify-between pt-4 border-t border-gray-200">
              <span className="text-gray-900 font-bold">Balance</span>
              <span className="text-2xl font-extrabold text-orange-600 font-mono">
                ₹0
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Payment Options</h3>

          <div className="space-y-3">
            <button className="w-full px-4 py-3 border border-blue-500 text-blue-600 rounded-xl font-semibold hover:bg-blue-50 transition-colors">
              Pay via UPI
            </button>
            <button className="w-full px-4 py-3 border border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-colors">
              Bank Transfer
            </button>
            <button className="w-full px-4 py-3 border border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-colors">
              Cash on Delivery
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ChatTab({ order }: { order: Order }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 h-[500px] flex flex-col">
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        <h3 className="text-lg font-bold text-gray-900">Communication</h3>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="flex gap-3">
          <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center text-xs font-bold">
            A
          </div>
          <div className="max-w-[70%]">
            <div className="bg-gray-100 rounded-xl p-3">
              <p className="text-sm text-gray-900">Hi! Welcome to Printoms! We have received your order and will get started soon.</p>
            </div>
            <span className="text-xs text-gray-500 mt-1 block">Today at 10:00 AM</span>
          </div>
        </div>

        <div className="flex gap-3 justify-end">
          <div className="max-w-[70%] text-right">
            <div className="bg-blue-600 text-white rounded-xl p-3">
              <p className="text-sm">Great! Looking forward to the design.</p>
            </div>
            <span className="text-xs text-gray-500 mt-1 block">Today at 10:05 AM</span>
          </div>
        </div>
      </div>

      <div className="p-4 border-t border-gray-200 flex gap-2">
        <input
          type="text"
          placeholder="Type your message..."
          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button className="px-6 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors">
          Send
        </button>
      </div>
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
                ₹{(product.price_per_unit || product.price_per_sqft || product.price_per_running_ft || 0).toLocaleString("en-IN")}
                <span style={{ fontSize: "10px", color: "#94a3b8", fontWeight: 500, fontFamily: "sans-serif" }}>
                  /{product.pricing_type === "per_sqft" ? "sqft" : product.pricing_type === "per_running_ft" ? "rft" : "unit"}
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
