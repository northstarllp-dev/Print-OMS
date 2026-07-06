"use client";

import React, { useState, useEffect, useRef } from "react";
import { createClient } from "@/utils/supabase/client";
import { 
  X, 
  Plus, 
  Camera, 
  MapPin, 
  Calendar, 
  Clock, 
  User, 
  CheckCircle2, 
  ChevronDown, 
  ChevronUp,
  MessageSquare,
  Save,
  Send,
  ArrowLeft,
  Phone,
  Mail,
  Eye,
  Download,
  Trash,
  ChevronLeft,
  ChevronRight,
  Shield
} from "lucide-react";
import { 
  Order, 
  Customer, 
  Employee, 
  SiteVisitDetails, 
  SignLocation 
} from "@/types";
import { ScheduleVisitModal } from "./ScheduleVisitModal";
import { scheduleSiteVisitAction } from "@/features/orders/actions/orderActions";
import { GoogleMap, useJsApiLoader, Marker } from "@react-google-maps/api";

const libraries: ("places")[] = ["places"];

export interface ExtendedSignLocation {
  id: string;
  name: string;
  width?: number;
  widthUnit?: string;
  height?: number;
  heightUnit?: string;
  depth?: number;
  depthUnit?: string;
  groundClearance?: number;
  groundClearanceUnit?: string;
  notes?: string;
  photos?: string[];
  powerAvailable?: boolean;
  distanceToPowerSource?: number;
  distanceToPowerSourceUnit?: string;
  electricalNotes?: string;
  wallType?: string;
  mountingMethod?: string;
  surfaceCondition?: string;
  obstacles?: string[];
  structuralNotes?: string;
}

interface SiteVisitModuleProps {
  order: Order;
  customers: Customer[];
  employees: Employee[];
  currentUserRole: "Admin" | "Employee";
  currentEmployee: Employee | null;
  onClose: () => void;
  onUpdate: (details: Partial<SiteVisitDetails>) => Promise<void>;
  onSubmitForApproval?: () => Promise<void>;
  onAdminApprove?: () => Promise<void>;
  onStaffApproveVisit?: () => Promise<void>;
  actionsNode?: React.ReactNode;
  adminOverrideUnlocked?: boolean;
  setAdminOverrideUnlocked?: (val: boolean) => void;
  onSkipSiteVisit?: () => void;
}

const defaultSignLocation: Omit<SignLocation, "id"> = {
  name: "",
  photos: []
};

export const SiteVisitModule: React.FC<SiteVisitModuleProps> = ({
  order,
  customers,
  employees,
  currentUserRole,
  currentEmployee,
  onClose,
  onUpdate,
  onSubmitForApproval,
  onAdminApprove,
  onStaffApproveVisit,
  actionsNode,
  adminOverrideUnlocked,
  setAdminOverrideUnlocked,
  onSkipSiteVisit
}) => {
  // Current client
  const client = customers.find(c => c.id === order.customerId);
  
  // State for collapsed sections
  const [collapsed, setCollapsed] = useState({
    visitInfo: true,
    measurements: true,
    sitePhotos: true,
    electrical: true,
    structural: true,
    internalNotes: true,
    installationReqs: true,
    fabricationReqs: true,
    designInputs: true,
  });
  
  // State for expanded sign locations
  const [expandedLocations, setExpandedLocations] = useState<string[]>([]);
  
  // Local state for site visit details (optimistic UI)
  const [siteVisit, setSiteVisit] = useState<SiteVisitDetails>(() => {
    const baseDetails = (order.siteVisitDetails || {}) as Partial<SiteVisitDetails>;
    return {
      completed: false,
      width: 0,
      height: 0,
      depth: 0,
      photos: [],
      ...baseDetails,
      locations: (baseDetails.locations || []).map(loc => ({
        ...loc,
        photos: loc.photos || []
      }))
    };
  });

  const { isLoaded } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "",
    libraries,
  });

  const mapCenter = React.useMemo(() => {
    if (!siteVisit?.gpsLocation) return null;
    const parts = siteVisit.gpsLocation.replace(/°|N|E|S|W/gi, "").split(",");
    if (parts.length >= 2) {
      const lat = parseFloat(parts[0].trim());
      const lng = parseFloat(parts[1].trim());
      if (!isNaN(lat) && !isNaN(lng)) return { lat, lng };
    }
    return null;
  }, [siteVisit?.gpsLocation]);
  
  // Freeze flag — read-only if not in Site Visit stage, or if completed and pending admin approval.
  // It unfreezes if the admin requests changes (stageStatus becomes "Normal" while still in Site Visit stage).
  const baseFrozen = !order.stage.startsWith("Site Visit") || (!!siteVisit.completed && order.stageStatus !== "Normal");
  const isFrozen = baseFrozen && !adminOverrideUnlocked;
  
  const [isConfirmSkipOpen, setIsConfirmSkipOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessage, setChatMessage] = useState("");
  const [unreadCount, setUnreadCount] = useState(0);

  // State for manual scheduling
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);

  // Photo viewer state
  const [viewerPhotos, setViewerPhotos] = useState<string[]>([]);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  const openViewer = (photosArray: string[], index: number) => {
    setViewerPhotos(photosArray);
    setViewerIndex(index);
  };

  const uploadSitePhoto = async (file: File) => {
    const supabase = createClient();
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${order.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage
      .from("site-visit-photos")
      .upload(path, file, { upsert: false, contentType: file.type });
    if (error) throw error;
    const { data } = supabase.storage.from("site-visit-photos").getPublicUrl(path);
    return data.publicUrl;
  };

  const handlePhotoFiles = async (files: FileList | null) => {
    if (!files || files.length === 0 || !selectedLocationId) return;
    setUploadingPhotos(true);
    try {
      const uploadPromises = Array.from(files).map(file => uploadSitePhoto(file));
      const urls = await Promise.all(uploadPromises);
      
      const activeLoc = (siteVisit.locations || []).find(l => l.id === selectedLocationId);
      const newUrls = [...(activeLoc?.photos || []), ...urls];
      
      updateSignLocation(selectedLocationId, { photos: newUrls });
    } catch (err: any) {
      alert("Upload failed: " + (err?.message || "Unknown error"));
    } finally {
      setUploadingPhotos(false);
    }
  };

  const removeSitePhoto = async (url: string) => {
    if (!selectedLocationId) return;
    const supabase = createClient();
    // Extract path from public URL
    const path = url.split("/site-visit-photos/").pop();
    if (path) await supabase.storage.from("site-visit-photos").remove([path]);
    
    const activeLoc = (siteVisit.locations || []).find(l => l.id === selectedLocationId);
    const newUrls = (activeLoc?.photos || []).filter(u => u !== url);
    
    updateSignLocation(selectedLocationId, { photos: newUrls });
  };

  useEffect(() => {
    const baseDetails = (order.siteVisitDetails || {}) as Partial<SiteVisitDetails>;
    setSiteVisit({
      completed: false,
      ...baseDetails,
      locations: (baseDetails.locations || []).map(loc => ({
        ...loc,
        photos: loc.photos || []
      }))
    } as any);

    const locs = baseDetails.locations || [];
    if (locs.length > 0) {
      setSelectedLocationId(prev => prev || locs[0].id);
    }
  }, [order.siteVisitDetails]);
  
  // State for selected sign location tab
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(() => {
    const baseDetails = (order.siteVisitDetails || {}) as Partial<SiteVisitDetails>;
    const locs = baseDetails.locations || [];
    return locs.length > 0 ? locs[0].id : null;
  });

  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  
  // Helper to toggle section collapse
  const toggleSection = (section: keyof typeof collapsed) => {
    setCollapsed(prev => ({ ...prev, [section]: !prev[section] }));
  };
  
  // Helper to toggle location expand (No longer needed, kept for compatibility if needed)
  const toggleLocation = (id: string) => {
    setExpandedLocations(prev => 
      prev.includes(id) ? prev.filter(lid => lid !== id) : [...prev, id]
    );
  };
  
  // Add a new sign location
  const addSignLocation = () => {
    const nextNum = (siteVisit.locations?.length || 0) + 1;
    const newLocation: SignLocation = {
      id: crypto.randomUUID(),
      ...defaultSignLocation,
      name: `Item-${nextNum}`
    };
    
    const updatedLocations = [...(siteVisit.locations || []), newLocation];
    const updatedDetails = { ...siteVisit, locations: updatedLocations };
    setSiteVisit(updatedDetails);
    setSelectedLocationId(newLocation.id);
    onUpdate(updatedDetails);
  };
  
  // Update a sign location
  const updateSignLocation = (id: string, updates: Partial<SignLocation>) => {
    const updatedLocations = (siteVisit.locations || []).map(loc => 
      loc.id === id ? { ...loc, ...updates } : loc
    );
    const updatedDetails = { ...siteVisit, locations: updatedLocations };
    setSiteVisit(updatedDetails);
    onUpdate(updatedDetails);
  };
  
  // Remove a sign location
  const removeSignLocation = (id: string) => {
    const updatedLocations = (siteVisit.locations || []).filter(loc => loc.id !== id);
    const updatedDetails = { ...siteVisit, locations: updatedLocations };
    setSiteVisit(updatedDetails);
    onUpdate(updatedDetails);
    if (selectedLocationId === id) {
      setSelectedLocationId(updatedLocations.length > 0 ? updatedLocations[0].id : null);
    }
  };
  

  
  const activeLoc = (siteVisit.locations || []).find(l => l.id === selectedLocationId) as ExtendedSignLocation | undefined;

  const updateActiveLocationFields = (updates: Partial<ExtendedSignLocation>) => {
    if (!selectedLocationId) return;
    const updatedLocations = (siteVisit.locations || []).map(loc => 
      loc.id === selectedLocationId ? { ...loc, ...updates } : loc
    );
    const updatedDetails = { ...siteVisit, locations: updatedLocations };
    setSiteVisit(updatedDetails);
    onUpdate(updatedDetails);
  };

  const updateRootFields = (updates: Partial<SiteVisitDetails>) => {
    const updatedDetails = { ...siteVisit, ...updates };
    setSiteVisit(updatedDetails);
    onUpdate(updatedDetails);
  };

  const scheduledDate = siteVisit.auditDate || siteVisit.preferredDate;
  const scheduledTime = siteVisit.auditTime || siteVisit.preferredTime;
  const scheduledAddress = siteVisit.customerAddress;
  const isSkipped = scheduledAddress?.startsWith("Skipped");

  return (
    <div className="space-y-6 text-slate-800">
      
      {/* ── ADMIN OVERRIDE BANNER ── */}
      {baseFrozen && currentUserRole === "Admin" && setAdminOverrideUnlocked && (
        <div className={`p-4 rounded-xl border flex items-center justify-between transition-colors ${adminOverrideUnlocked ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200'}`}>
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${adminOverrideUnlocked ? 'bg-amber-100 text-amber-600' : 'bg-slate-200 text-slate-500'}`}>
              <Shield size={16} />
            </div>
            <div>
              <h4 className={`text-sm font-bold ${adminOverrideUnlocked ? 'text-amber-900' : 'text-slate-700'}`}>Admin God Mode</h4>
              <p className={`text-xs ${adminOverrideUnlocked ? 'text-amber-700' : 'text-slate-500'}`}>
                {adminOverrideUnlocked 
                  ? "Module is currently unlocked. You can edit all details and click 'Save Draft' at the bottom." 
                  : "This module is locked. Unlock it to forcefully edit details."}
              </p>
            </div>
          </div>
          <button
            onClick={() => setAdminOverrideUnlocked(!adminOverrideUnlocked)}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors ${
              adminOverrideUnlocked 
                ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-xs' 
                : 'bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 shadow-3xs'
            }`}
          >
            {adminOverrideUnlocked ? "Lock Module" : "Unlock for Editing"}
          </button>
        </div>
      )}
      
      {/* ── SCHEDULED VISIT DETAILS (from customer portal) ── */}
      {isSkipped ? (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 shadow-xs text-center flex flex-col items-center justify-center">
          <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mb-3">
            <CheckCircle2 size={24} className="text-amber-600" />
          </div>
          <h4 className="text-sm font-bold text-amber-900 mb-1">Site Visit Skipped</h4>
          <p className="text-xs text-amber-700 max-w-sm">The site visit has been skipped for this order. You can proceed with adding manual measurements below.</p>
        </div>
      ) : (scheduledDate || scheduledAddress) ? (
        <div className="bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-200 rounded-2xl p-5 shadow-xs">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-2">
              <Calendar size={18} className="text-indigo-600" />
              <h3 className="text-sm font-extrabold text-indigo-900 uppercase tracking-wider">
                Scheduled Site Visit
              </h3>
            </div>
            <div className="flex items-center gap-2">
              {onSkipSiteVisit && !isFrozen && (
                <button
                  onClick={() => setIsConfirmSkipOpen(true)}
                  className="px-3 py-1.5 bg-amber-50 border border-amber-200 text-amber-700 text-xs font-bold rounded-lg hover:bg-amber-100 transition-colors shadow-sm whitespace-nowrap"
                >
                  Skip Visit & Add Values
                </button>
              )}
              {!isFrozen && (
                <button
                  onClick={() => setIsScheduleModalOpen(true)}
                  className="px-3 py-1.5 bg-white border border-indigo-200 text-indigo-700 text-xs font-bold rounded-lg hover:bg-indigo-50 transition-colors shadow-sm"
                >
                  Edit Schedule
                </button>
              )}
              {isFrozen && (
                <span className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-500 rounded-xl text-xs font-bold border border-slate-200">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                  Site Visit Locked
                </span>
              )}
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Date & Time */}
            {(scheduledDate || scheduledTime) && (
              <div className="bg-white rounded-xl p-3 border border-indigo-100 shadow-sm flex flex-col justify-center">
                <div className="flex items-center gap-2 mb-1">
                  <Clock size={14} className="text-indigo-500" />
                  <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">
                    Visit Schedule
                  </span>
                </div>
                <p className="text-sm font-extrabold text-indigo-900">
                  {scheduledDate && !isNaN(Date.parse(scheduledDate)) ? new Date(scheduledDate).toLocaleDateString('en-IN', { 
                    weekday: 'short', 
                    year: 'numeric', 
                    month: 'short', 
                    day: 'numeric' 
                  }) : scheduledDate}
                </p>
                {scheduledTime && (
                  <p className="text-xs font-semibold text-indigo-700 mt-0.5">
                    At {scheduledTime}
                  </p>
                )}
              </div>
            )}

            {/* Address */}
            {scheduledAddress && (
              <div className="bg-white rounded-xl p-3 border border-indigo-100 shadow-sm flex flex-col justify-center">
                <div className="flex items-center gap-2 mb-1">
                  <MapPin size={14} className="text-indigo-500" />
                  <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">
                    Site Address
                  </span>
                </div>
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(scheduledAddress)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:underline line-clamp-2"
                >
                  {scheduledAddress}
                </a>
                {siteVisit.landmark && (
                  <p className="text-[10px] text-slate-500 mt-0.5 truncate">
                    Near: {siteVisit.landmark}
                  </p>
                )}
                {siteVisit.gpsLocation && (
                  <p className="text-[10px] text-slate-400 mt-0.5 font-mono truncate">
                    GPS: {siteVisit.gpsLocation}
                  </p>
                )}
                
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(siteVisit.gpsLocation || scheduledAddress)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 mt-2 text-indigo-600 hover:text-indigo-800 text-[10px] font-bold transition-colors w-max"
                >
                  <MapPin size={10} />
                  Open in Google Maps
                </a>
              </div>
            )}

            {/* Map */}
            {scheduledAddress && mapCenter && isLoaded && (
              <div className="h-24 md:h-full w-full rounded-xl overflow-hidden border border-slate-200 relative bg-slate-100">
                <GoogleMap
                  mapContainerStyle={{ width: "100%", height: "100%" }}
                  center={mapCenter}
                  zoom={15}
                  options={{ streetViewControl: false, mapTypeControl: false, disableDefaultUI: true }}
                >
                  <Marker position={mapCenter} />
                </GoogleMap>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-slate-50 border border-slate-200/60 rounded-2xl p-5 flex flex-col sm:flex-row items-center gap-4 justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 shrink-0">
              <Calendar size={18} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-800">No Site Visit Scheduled Yet</h4>
              <p className="text-xs text-slate-500 mt-0.5">The client has not yet scheduled their site visit date, time, and location from the customer portal.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onSkipSiteVisit && !isFrozen && (
              <button
                onClick={() => setIsConfirmSkipOpen(true)}
                className="px-4 py-2 bg-amber-100 text-amber-700 font-semibold text-xs rounded-lg whitespace-nowrap hover:bg-amber-200 transition-colors shadow-sm"
              >
                Skip Visit & Add Values
              </button>
            )}
            <button 
              onClick={() => setIsScheduleModalOpen(true)}
              disabled={isFrozen}
              className="px-4 py-2 bg-emerald-600 text-white font-semibold text-xs rounded-lg whitespace-nowrap hover:bg-emerald-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Schedule by yourself
            </button>
          </div>
        </div>
      )}

      <ScheduleVisitModal
        isOpen={isScheduleModalOpen}
        onClose={() => setIsScheduleModalOpen(false)}
        defaultAddress={client?.shippingAddress}
        onSchedule={async (date, time, location, coords) => {
          try {
            await scheduleSiteVisitAction(order.id, {
              auditDate: date,
              auditTime: time,
              customerAddress: location,
              gpsLocation: coords
            });
            await onUpdate({
              auditDate: date,
              auditTime: time,
              customerAddress: location,
              gpsLocation: coords
            });
            setSiteVisit(prev => ({
              ...prev,
              auditDate: date,
              auditTime: time,
              customerAddress: location,
              gpsLocation: coords
            }));
          } catch (err) {
            console.error("Failed to schedule site visit", err);
            alert("Failed to schedule site visit. Please try again.");
          }
        }}
      />

      {isConfirmSkipOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[99999] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl p-6">
            <h2 className="text-lg font-black text-slate-900 mb-2">Confirm Skip Site Visit</h2>
            <p className="text-sm text-slate-600 mb-6 leading-relaxed">
              Are you sure you want to skip the site visit? This will bypass the scheduling phase and move directly to adding measurements. This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setIsConfirmSkipOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  setIsConfirmSkipOpen(false);
                  if (onSkipSiteVisit) {
                    await onSkipSiteVisit();
                  }
                }}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm rounded-xl transition-colors shadow-sm"
              >
                Skip Site Visit
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* ── TOP TOGGLABLE BAR & READY CHECKBOX ── */}
      <div className="bg-gradient-to-r from-slate-50 to-slate-100/50 border border-slate-200/80 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all duration-300">
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/60 pb-3 w-full">
          <div 
            className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent w-full"
            style={{ WebkitOverflowScrolling: "touch" }}
          >
            {(siteVisit.locations || []).map((loc, idx) => {
              const isSelected = loc.id === selectedLocationId;
              return (
                <div key={loc.id} className={`flex items-center flex-shrink-0 border rounded-full pl-3 pr-1 py-1 transition-all ${isSelected ? "bg-[var(--color-secondary)]/10 border-[var(--color-secondary)]" : "bg-white border-slate-200 hover:bg-slate-50"}`}>
                  <button
                    onClick={() => setSelectedLocationId(loc.id)}
                    className={`text-xs font-bold transition-all focus:outline-none ${isSelected ? "text-[var(--color-secondary)] font-extrabold" : "text-slate-500"}`}
                  >
                    {loc.name || `Item-${idx + 1}`}
                  </button>
                  {!isFrozen && (
                    <button
                      onClick={() => removeSignLocation(loc.id)}
                      className={`ml-2 w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold transition-colors focus:outline-none ${isSelected ? "text-[var(--color-secondary)] hover:text-red-650 hover:bg-red-50" : "text-slate-400 hover:text-red-550 hover:bg-red-50"}`}
                      title="Remove item"
                    >
                      ×
                    </button>
                  )}
                </div>
              );
            })}
            
            {/* New Item Button — hidden when frozen */}
            {!isFrozen && (
              <button
                onClick={addSignLocation}
                className="flex items-center gap-1 px-3.5 py-1.5 bg-white border border-dashed border-[var(--color-secondary)] text-[var(--color-secondary)] hover:bg-[var(--color-secondary)]/5 rounded-full text-xs font-bold transition-all flex-shrink-0 focus:outline-none"
              >
                <Plus size={12} /> New Item
              </button>
            )}
          </div>
        </div>

        {actionsNode && (
          <div className="flex items-center gap-3 flex-shrink-0 w-full sm:w-auto overflow-x-auto">
            {actionsNode}
          </div>
        )}
      </div>

      {!activeLoc ? (
        <div className="text-center py-12 border border-dashed border-slate-200 rounded-xl bg-slate-50/30 flex flex-col items-center justify-center p-6">
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
            <MapPin size={20} className="text-slate-400" />
          </div>
          <p className="text-sm font-semibold text-slate-700">No items added yet</p>
          <p className="text-xs text-slate-500 mt-1 max-w-xs">Create a new item using the "New Item" button at the top to start auditing.</p>
        </div>
      ) : (
        <>
          {/* ── MEASUREMENT ITEMS SECTION ── */}
          <SectionCard
            title="Measurement Details"
            icon={<span className="w-2.5 h-2.5 rounded-full bg-[var(--color-secondary)]" />}
            isCollapsed={collapsed.measurements}
            onToggle={() => toggleSection("measurements")}
          >
            <div className="mb-4 text-xs text-slate-500">
              Specify sizes, ground clearance, and upload reference photos for {activeLoc.name}
            </div>

            <fieldset disabled={isFrozen} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-450 uppercase tracking-wider mb-1">Item Label / Name</label>
                <input
                  type="text"
                  value={activeLoc.name}
                  onChange={(e) => updateSignLocation(activeLoc.id, { name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[var(--color-secondary)]/20 focus:border-[var(--color-secondary)] bg-white transition-all disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed"
                  placeholder="e.g. Front Entrance Main Signage"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-450 uppercase tracking-wider mb-1">Width</label>
                  <div className="flex focus-within:ring-2 focus-within:ring-[var(--color-secondary)]/20 focus-within:border-[var(--color-secondary)] border border-slate-200 rounded-xl overflow-hidden transition-all bg-white">
                    <input
                      type="number" step="any"
                      value={activeLoc.width || ""}
                      onChange={(e) => updateSignLocation(activeLoc.id, { width: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 text-xs font-semibold focus:outline-none disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed border-r border-slate-200"
                      placeholder="0.00"
                    />
                    <select
                      value={activeLoc.widthUnit || "ft"}
                      onChange={(e) => updateSignLocation(activeLoc.id, { widthUnit: e.target.value })}
                      className="px-2 py-2 text-xs font-bold text-slate-500 focus:outline-none bg-slate-50 disabled:bg-slate-50 disabled:cursor-not-allowed outline-none cursor-pointer"
                    >
                      <option value="ft">ft</option>
                      <option value="m">m</option>
                      <option value="inch">inch</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-450 uppercase tracking-wider mb-1">Height</label>
                  <div className="flex focus-within:ring-2 focus-within:ring-[var(--color-secondary)]/20 focus-within:border-[var(--color-secondary)] border border-slate-200 rounded-xl overflow-hidden transition-all bg-white">
                    <input
                      type="number" step="any"
                      value={activeLoc.height || ""}
                      onChange={(e) => updateSignLocation(activeLoc.id, { height: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 text-xs font-semibold focus:outline-none disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed border-r border-slate-200"
                      placeholder="0.00"
                    />
                    <select
                      value={activeLoc.heightUnit || "ft"}
                      onChange={(e) => updateSignLocation(activeLoc.id, { heightUnit: e.target.value })}
                      className="px-2 py-2 text-xs font-bold text-slate-500 focus:outline-none bg-slate-50 disabled:bg-slate-50 disabled:cursor-not-allowed outline-none cursor-pointer"
                    >
                      <option value="ft">ft</option>
                      <option value="m">m</option>
                      <option value="inch">inch</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-450 uppercase tracking-wider mb-1">Depth</label>
                  <div className="flex focus-within:ring-2 focus-within:ring-[var(--color-secondary)]/20 focus-within:border-[var(--color-secondary)] border border-slate-200 rounded-xl overflow-hidden transition-all bg-white">
                    <input
                      type="number" step="any"
                      value={activeLoc.depth || ""}
                      onChange={(e) => updateSignLocation(activeLoc.id, { depth: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 text-xs font-semibold focus:outline-none disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed border-r border-slate-200"
                      placeholder="0.00"
                    />
                    <select
                      value={activeLoc.depthUnit || "ft"}
                      onChange={(e) => updateSignLocation(activeLoc.id, { depthUnit: e.target.value })}
                      className="px-2 py-2 text-xs font-bold text-slate-500 focus:outline-none bg-slate-50 disabled:bg-slate-50 disabled:cursor-not-allowed outline-none cursor-pointer"
                    >
                      <option value="ft">ft</option>
                      <option value="m">m</option>
                      <option value="inch">inch</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-450 uppercase tracking-wider mb-1">Ground Clearance</label>
                  <div className="flex focus-within:ring-2 focus-within:ring-[var(--color-secondary)]/20 focus-within:border-[var(--color-secondary)] border border-slate-200 rounded-xl overflow-hidden transition-all bg-white">
                    <input
                      type="number" step="any"
                      value={activeLoc.groundClearance || ""}
                      onChange={(e) => updateSignLocation(activeLoc.id, { groundClearance: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 text-xs font-semibold focus:outline-none disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed border-r border-slate-200"
                      placeholder="0.00"
                    />
                    <select
                      value={activeLoc.groundClearanceUnit || "ft"}
                      onChange={(e) => updateSignLocation(activeLoc.id, { groundClearanceUnit: e.target.value })}
                      className="px-2 py-2 text-xs font-bold text-slate-500 focus:outline-none bg-slate-50 disabled:bg-slate-50 disabled:cursor-not-allowed outline-none cursor-pointer"
                    >
                      <option value="ft">ft</option>
                      <option value="m">m</option>
                      <option value="inch">inch</option>
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-450 uppercase tracking-wider mb-1">Location / Surface Specific Notes</label>
                <textarea
                  value={activeLoc.notes || ""}
                  onChange={(e) => updateSignLocation(activeLoc.id, { notes: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[var(--color-secondary)]/20 focus:border-[var(--color-secondary)] bg-white transition-all resize-none disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed"
                  placeholder="Details on wall conditions, accessibility barriers..."
                />
              </div>
            </fieldset>
          </SectionCard>

          {/* ── SITE PHOTOS ── */}
          <SectionCard
            title="Site Photos"
            icon="📸"
            isCollapsed={collapsed.sitePhotos}
            onToggle={() => toggleSection("sitePhotos")}
          >
            <SitePhotoUploader
              photos={activeLoc.photos || []}
              uploading={uploadingPhotos}
              disabled={isFrozen}
              onFiles={handlePhotoFiles}
              onRemove={removeSitePhoto}
              onView={(idx) => openViewer(activeLoc.photos || [], idx)}
            />
          </SectionCard>

          {/* ── ELECTRICAL ASSESSMENT ── */}
          <SectionCard
            title="Electrical Assessment"
            icon="⚡"
            isCollapsed={collapsed.electrical}
            onToggle={() => toggleSection("electrical")}
          >
            <fieldset disabled={isFrozen} className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Power Source Available?</label>
                <div className="flex flex-col sm:flex-row gap-3">
                  {[true, false].map(option => (
                    <label
                      key={String(option)}
                      className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 border rounded-xl transition-all ${isFrozen ? "cursor-not-allowed opacity-70" : "cursor-pointer"} ${
                        activeLoc.powerAvailable === option 
                          ? "border-[var(--color-secondary)] bg-[var(--color-secondary)]/5 text-[var(--color-secondary)] font-bold shadow-xs" 
                          : "border-slate-200 text-slate-650 hover:bg-slate-50 font-medium"
                      }`}
                    >
                      <input
                        type="radio"
                        name="powerAvailable"
                        checked={activeLoc.powerAvailable === option}
                        onChange={() => updateSignLocation(activeLoc.id, { powerAvailable: option })}
                        className="accent-[var(--color-secondary)] disabled:cursor-not-allowed"
                      />
                      <span className="text-xs">{option ? "Yes, Available" : "No Power"}</span>
                    </label>
                  ))}
                </div>
              </div>
              
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Distance to Power Source</label>
                <div className="flex gap-2">
                  <input
                    type="number" step="any"
                    value={activeLoc.distanceToPowerSource || ""}
                    onChange={(e) => updateSignLocation(activeLoc.id, { distanceToPowerSource: parseFloat(e.target.value) || 0 })}
                    className="flex-1 px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[var(--color-secondary)]/20 focus:border-[var(--color-secondary)] bg-white transition-all disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed"
                    placeholder="e.g. 5"
                  />
                  <select
                    value={activeLoc.distanceToPowerSourceUnit || "meters"}
                    onChange={(e) => updateSignLocation(activeLoc.id, { distanceToPowerSourceUnit: e.target.value })}
                    className="px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[var(--color-secondary)]/20 focus:border-[var(--color-secondary)] bg-white transition-all disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed"
                  >
                    <option value="meters">meters</option>
                    <option value="feet">feet</option>
                  </select>
                </div>
              </div>
              
              <div className="md:col-span-2">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Electrical Assessment Notes</label>
                <textarea
                  value={activeLoc.electricalNotes || ""}
                  onChange={(e) => updateSignLocation(activeLoc.id, { electricalNotes: e.target.value })}
                  rows={3}
                  placeholder="Detail power source details, availability of sockets, switchboards, cabling paths..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[var(--color-secondary)]/20 focus:border-[var(--color-secondary)] bg-white transition-all resize-none disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed"
                />
              </div>
            </fieldset>
          </SectionCard>

          {/* ── STRUCTURAL ASSESSMENT ── */}
          <SectionCard
            title="Structural Assessment"
            icon="🏗️"
            isCollapsed={collapsed.structural}
            onToggle={() => toggleSection("structural")}
          >
            <fieldset disabled={isFrozen} className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Wall / Surface Type</label>
                <select
                  value={activeLoc.wallType || ""}
                  onChange={(e) => updateSignLocation(activeLoc.id, { wallType: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[var(--color-secondary)]/20 focus:border-[var(--color-secondary)] bg-white transition-all disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed"
                >
                  <option value="">Select Wall Type</option>
                  <option value="Concrete">Concrete Wall</option>
                  <option value="ACP Cladding">ACP Cladding</option>
                  <option value="Glass">Glass facade</option>
                  <option value="Tile">Tile surface</option>
                  <option value="Metal">Iron / Metal framing</option>
                  <option value="Wood">Wood / MDF paneling</option>
                  <option value="Composite Panel">Composite board</option>
                </select>
              </div>
              
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Proposed Mounting Method</label>
                <select
                  value={activeLoc.mountingMethod || ""}
                  onChange={(e) => updateSignLocation(activeLoc.id, { mountingMethod: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[var(--color-secondary)]/20 focus:border-[var(--color-secondary)] bg-white transition-all disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed"
                >
                  <option value="">Select Mounting Method</option>
                  <option value="Direct Mount">Direct Anchor Mounting</option>
                  <option value="Frame Mount">Metal Support Framing</option>
                  <option value="Hanging">Suspended / Cable Mount</option>
                  <option value="Pole Mounted">Pylon / Pole Mounting</option>
                </select>
              </div>
              
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Surface Quality / Condition</label>
                <input
                  type="text"
                  value={activeLoc.surfaceCondition || ""}
                  onChange={(e) => updateSignLocation(activeLoc.id, { surfaceCondition: e.target.value })}
                  placeholder="e.g. Robust concrete, brittle ACP sheets..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[var(--color-secondary)]/20 focus:border-[var(--color-secondary)] bg-white transition-all disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed"
                />
              </div>
              
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Physical Obstacles</label>
                <input
                  type="text"
                  value={activeLoc.obstacles?.join(", ") || ""}
                  onChange={(e) => updateSignLocation(activeLoc.id, { obstacles: e.target.value.split(",").map(s => s.trim()).filter(Boolean) })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[var(--color-secondary)]/20 focus:border-[var(--color-secondary)] bg-white transition-all disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed"
                  placeholder="e.g. Tree branches, security cams, pipes (comma separated)"
                />
              </div>
              
              <div className="md:col-span-2">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Structural Reinforcements / Special Instructions</label>
                <textarea
                  value={activeLoc.structuralNotes || ""}
                  onChange={(e) => updateSignLocation(activeLoc.id, { structuralNotes: e.target.value })}
                  rows={3}
                  placeholder="Detail scaffolding needs, anchor size specifications, framing reinforcements..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[var(--color-secondary)]/20 focus:border-[var(--color-secondary)] bg-white transition-all resize-none disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed"
                />
              </div>
            </fieldset>
          </SectionCard>

          {/* ── INTERNAL NOTES REMOVED ── */}
        </>
      )}

      {/* ── INSTALLATION REQUIREMENTS ── */}
      <SectionCard
        title="Installation Requirements"
        icon="🏗️"
        isCollapsed={collapsed.installationReqs}
        onToggle={() => toggleSection("installationReqs")}
      >
        <fieldset disabled={isFrozen} className="space-y-5 pt-4">
          {/* Scaffolding & Crane */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Installation Type</label>
            <div className="flex flex-col sm:flex-row gap-3">
              <label className={`flex items-center gap-2.5 px-4 py-2.5 border rounded-xl transition-all flex-1 ${isFrozen ? "cursor-not-allowed opacity-70" : "cursor-pointer"} ${
                siteVisit.scaffoldingRequired ? "border-[var(--color-secondary)] bg-[var(--color-secondary)]/5 font-bold text-[var(--color-secondary)]" : "border-slate-200 text-slate-650 hover:bg-slate-50 font-medium"
              }`}>
                <input
                  type="checkbox"
                  checked={siteVisit.scaffoldingRequired ?? false}
                  onChange={e => updateRootFields({ scaffoldingRequired: e.target.checked })}
                  className="accent-[var(--color-secondary)] disabled:cursor-not-allowed"
                />
                <span className="text-xs">Scaffolding Required</span>
              </label>
              <label className={`flex items-center gap-2.5 px-4 py-2.5 border rounded-xl transition-all flex-1 ${isFrozen ? "cursor-not-allowed opacity-70" : "cursor-pointer"} ${
                siteVisit.craneRequired ? "border-[var(--color-secondary)] bg-[var(--color-secondary)]/5 font-bold text-[var(--color-secondary)]" : "border-slate-200 text-slate-650 hover:bg-slate-50 font-medium"
              }`}>
                <input
                  type="checkbox"
                  checked={siteVisit.craneRequired ?? false}
                  onChange={e => updateRootFields({ craneRequired: e.target.checked })}
                  className="accent-[var(--color-secondary)] disabled:cursor-not-allowed"
                />
                <span className="text-xs">Crane Required</span>
              </label>
            </div>
          </div>

          {/* Overnight Installation */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Overnight Installation</label>
            <div className="flex flex-col sm:flex-row gap-3">
              {[true, false].map(option => (
                <label
                  key={String(option)}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 border rounded-xl transition-all ${isFrozen ? "cursor-not-allowed opacity-70" : "cursor-pointer"} ${
                    siteVisit.overnightInstallation === option
                      ? "border-[var(--color-secondary)] bg-[var(--color-secondary)]/5 text-[var(--color-secondary)] font-bold shadow-xs"
                      : "border-slate-200 text-slate-650 hover:bg-slate-50 font-medium"
                  }`}
                >
                  <input
                    type="radio"
                    name="overnightInstallation"
                    checked={siteVisit.overnightInstallation === option}
                    onChange={() => updateRootFields({ overnightInstallation: option })}
                    className="accent-[var(--color-secondary)] disabled:cursor-not-allowed"
                  />
                  <span className="text-xs">{option ? "Yes" : "No"}</span>
                </label>
              ))}
            </div>
          </div>
        </fieldset>
      </SectionCard>

      {/* ── FABRICATION REQUIREMENTS ── */}
      <SectionCard
        title="Fabrication Requirements"
        icon="🔧"
        isCollapsed={collapsed.fabricationReqs}
        onToggle={() => toggleSection("fabricationReqs")}
      >
        <fieldset disabled={isFrozen} className="space-y-5 pt-4">
          {/* Extra Angles */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Extra Angles Required</label>
            <div className="flex flex-col sm:flex-row gap-3 mb-3">
              {[true, false].map(option => (
                <label
                  key={String(option)}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 border rounded-xl transition-all ${isFrozen ? "cursor-not-allowed opacity-70" : "cursor-pointer"} ${
                    siteVisit.extraAnglesRequired === option
                      ? "border-[var(--color-secondary)] bg-[var(--color-secondary)]/5 text-[var(--color-secondary)] font-bold shadow-xs"
                      : "border-slate-200 text-slate-650 hover:bg-slate-50 font-medium"
                  }`}
                >
                  <input
                    type="radio"
                    name="extraAnglesRequired"
                    checked={siteVisit.extraAnglesRequired === option}
                    onChange={() => updateRootFields({ extraAnglesRequired: option })}
                    className="accent-[var(--color-secondary)] disabled:cursor-not-allowed"
                  />
                  <span className="text-xs">{option ? "Yes" : "No"}</span>
                </label>
              ))}
            </div>
            {siteVisit.extraAnglesRequired && (
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Length</label>
                <input
                  type="text"
                  value={siteVisit.extraAnglesLength ?? ""}
                  onChange={e => updateRootFields({ extraAnglesLength: e.target.value })}
                  placeholder="e.g. 10 ft"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[var(--color-secondary)]/20 focus:border-[var(--color-secondary)] bg-white transition-all disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed"
                />
              </div>
            )}
          </div>

          {/* Yes/No toggles */}
          {([
            { key: "extraAcpSheetRequired", label: "Extra ACP Sheet Required to Cover Gap" },
            { key: "oldBoardRemovalRequired", label: "Old Board Removal Required" },
            { key: "extraWireRequired", label: "Extra Wire Required" },
          ] as { key: keyof typeof siteVisit; label: string }[]).map(({ key, label }) => (
            <div key={key}>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">{label}</label>
              <div className="flex flex-col sm:flex-row gap-3">
                {[true, false].map(option => (
                  <label
                    key={String(option)}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 border rounded-xl transition-all ${isFrozen ? "cursor-not-allowed opacity-70" : "cursor-pointer"} ${
                      siteVisit[key] === option
                        ? "border-[var(--color-secondary)] bg-[var(--color-secondary)]/5 text-[var(--color-secondary)] font-bold shadow-xs"
                        : "border-slate-200 text-slate-650 hover:bg-slate-50 font-medium"
                    }`}
                  >
                    <input
                      type="radio"
                      name={key as string}
                      checked={siteVisit[key] === option}
                      onChange={() => updateRootFields({ [key]: option })}
                      className="accent-[var(--color-secondary)] disabled:cursor-not-allowed"
                    />
                    <span className="text-xs">{option ? "Yes" : "No"}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </fieldset>
      </SectionCard>

      {/* ── DESIGN INPUTS ── */}
      <SectionCard
        title="Design Inputs"
        icon="🎨"
        isCollapsed={collapsed.designInputs}
        onToggle={() => toggleSection("designInputs")}
      >
        <fieldset disabled={isFrozen} className="space-y-5 pt-4">
          {/* Design Brief */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Design Brief Available?</label>
            <div className="flex flex-col sm:flex-row gap-3">
              {(["Yes", "No", "Later"] as const).map(option => (
                <label
                  key={option}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 border rounded-xl transition-all ${isFrozen ? "cursor-not-allowed opacity-70" : "cursor-pointer"} ${
                    siteVisit.designBriefAvailable === option
                      ? "border-[var(--color-secondary)] bg-[var(--color-secondary)]/5 text-[var(--color-secondary)] font-bold shadow-xs"
                      : "border-slate-200 text-slate-650 hover:bg-slate-50 font-medium"
                  }`}
                >
                  <input
                    type="radio"
                    name="designBriefAvailable"
                    checked={siteVisit.designBriefAvailable === option}
                    onChange={() => updateRootFields({ designBriefAvailable: option })}
                    className="accent-[var(--color-secondary)] disabled:cursor-not-allowed"
                  />
                  <span className="text-xs">{option}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Fabrication Required */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Fabrication Required</label>
            <div className="flex flex-col sm:flex-row gap-3">
              {[true, false].map(option => (
                <label
                  key={String(option)}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 border rounded-xl transition-all ${isFrozen ? "cursor-not-allowed opacity-70" : "cursor-pointer"} ${
                    siteVisit.fabricationRequired === option
                      ? "border-[var(--color-secondary)] bg-[var(--color-secondary)]/5 text-[var(--color-secondary)] font-bold shadow-xs"
                      : "border-slate-200 text-slate-650 hover:bg-slate-50 font-medium"
                  }`}
                >
                  <input
                    type="radio"
                    name="fabricationRequired"
                    checked={siteVisit.fabricationRequired === option}
                    onChange={() => updateRootFields({ fabricationRequired: option })}
                    className="accent-[var(--color-secondary)] disabled:cursor-not-allowed"
                  />
                  <span className="text-xs">{option ? "Yes" : "No"}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Civil Work Required */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Civil Work Required</label>
            <div className="flex flex-col sm:flex-row gap-3">
              {[true, false].map(option => (
                <label
                  key={String(option)}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 border rounded-xl transition-all ${isFrozen ? "cursor-not-allowed opacity-70" : "cursor-pointer"} ${
                    siteVisit.civilWorkRequired === option
                      ? "border-[var(--color-secondary)] bg-[var(--color-secondary)]/5 text-[var(--color-secondary)] font-bold shadow-xs"
                      : "border-slate-200 text-slate-650 hover:bg-slate-50 font-medium"
                  }`}
                >
                  <input
                    type="radio"
                    name="civilWorkRequired"
                    checked={siteVisit.civilWorkRequired === option}
                    onChange={() => updateRootFields({ civilWorkRequired: option })}
                    className="accent-[var(--color-secondary)] disabled:cursor-not-allowed"
                  />
                  <span className="text-xs">{option ? "Yes" : "No"}</span>
                </label>
              ))}
            </div>
          </div>
        </fieldset>
      </SectionCard>

      {/* ── PHOTO VIEWER MODAL ── */}
      {viewerIndex !== null && viewerPhotos.length > 0 && (
        <div 
          className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center backdrop-blur-sm"
          onClick={() => setViewerIndex(null)}
        >
          {/* Close button */}
          <button 
            className="absolute top-6 right-6 text-white/70 hover:text-white bg-black/50 hover:bg-black/80 rounded-full p-2 transition-all focus:outline-none"
            onClick={() => setViewerIndex(null)}
          >
            <X size={24} />
          </button>
          
          {/* Main Image */}
          <div className="relative max-w-4xl max-h-[85vh] w-full h-full flex items-center justify-center p-4">
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
};

// ── SECTION CARD WRAPPER COMPONENT ──
const SectionCard: React.FC<{
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  isCollapsed: boolean;
  onToggle: () => void;
  extra?: React.ReactNode;
}> = ({ title, icon, children, isCollapsed, onToggle, extra }) => (
  <div className="bg-white border border-slate-200/70 rounded-2xl shadow-xs overflow-hidden transition-all duration-200 hover:border-slate-300/80">
    <div className="w-full px-5 py-4 flex items-center justify-between bg-slate-50/30 hover:bg-slate-50/70 border-b border-slate-100 transition-colors">
      <button
        onClick={onToggle}
        className="flex-1 text-left flex items-center justify-between focus:outline-none"
      >
        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
          {icon && <span className="text-base">{icon}</span>}
          {title}
        </h3>
        {!extra && (
          isCollapsed ? <ChevronDown size={18} className="text-slate-400 transition-transform duration-200" /> : <ChevronUp size={18} className="text-slate-400 transition-transform duration-200" />
        )}
      </button>
      {extra && (
        <div className="flex items-center gap-3">
          {extra}
          <button onClick={onToggle} className="focus:outline-none">
            {isCollapsed ? <ChevronDown size={18} className="text-slate-400" /> : <ChevronUp size={18} className="text-slate-400" />}
          </button>
        </div>
      )}
    </div>
    {!isCollapsed && (
      <div className="px-5 pb-5">
        {children}
      </div>
    )}
  </div>
);



// ── SITE PHOTO UPLOADER ──
const SitePhotoUploader: React.FC<{
  photos: string[];
  uploading: boolean;
  disabled?: boolean;
  onFiles: (files: FileList | null) => void;
  onRemove: (url: string) => void;
  onView: (idx: number) => void;
}> = ({ photos, uploading, disabled, onFiles, onRemove, onView }) => {
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  return (
    <div className="pt-4 space-y-4">
      {/* Upload buttons */}
      {!disabled && (
        <div className="flex gap-3">
          <input ref={galleryRef} type="file" accept="image/*" multiple className="hidden" onChange={e => onFiles(e.target.files)} />
          <button
            onClick={() => galleryRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-2 px-4 py-2.5 bg-[var(--color-secondary)] text-white rounded-xl text-xs font-bold hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            <Camera size={14} />
            Add Photos
          </button>

          {uploading && (
            <span className="flex items-center gap-1.5 text-xs text-slate-500 font-semibold">
              <span className="w-3 h-3 border-2 border-slate-300 border-t-[var(--color-secondary)] rounded-full animate-spin" />
              Uploading…
            </span>
          )}
        </div>
      )}

      {/* Photo grid */}
      {photos.length > 0 ? (
        <div className="flex flex-wrap gap-3">
          {photos.map((url, idx) => (
            <div key={url} className="relative group w-24 h-24 rounded-xl overflow-hidden border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
              <img src={url} alt={`Site photo ${idx + 1}`} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-slate-900/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                <button
                  onClick={(e) => { e.stopPropagation(); onView(idx); }}
                  className="w-7 h-7 rounded-full bg-white/20 hover:bg-white/40 flex items-center justify-center text-white transition-colors"
                  title="View"
                >
                  <Eye size={14} />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); window.open(`${url}?download=`, '_blank'); }}
                  className="w-7 h-7 rounded-full bg-white/20 hover:bg-white/40 flex items-center justify-center text-white transition-colors"
                  title="Download"
                >
                  <Download size={14} />
                </button>
                {!disabled && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onRemove(url); }}
                    className="w-7 h-7 rounded-full bg-red-500/80 hover:bg-red-500 flex items-center justify-center text-white transition-colors"
                    title="Remove"
                  >
                    <Trash size={14} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div
          className={`flex flex-col items-center justify-center py-10 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50 transition-colors ${disabled ? "" : "cursor-pointer hover:border-[var(--color-secondary)] hover:bg-slate-100/50"}`}
          onClick={() => !disabled && galleryRef.current?.click()}
        >
          <Camera size={28} className="text-slate-300 mb-2" />
          <p className="text-xs font-bold text-slate-400">No photos yet</p>
          {!disabled && <p className="text-[10px] text-slate-400 mt-0.5">Tap "Add Photos" to upload</p>}
        </div>
      )}
    </div>
  );
};

