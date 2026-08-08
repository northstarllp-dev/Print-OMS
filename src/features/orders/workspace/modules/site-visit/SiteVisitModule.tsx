"use client";

import React, { useState, useEffect } from "react";
import { 
  X, 
  Plus, 
  Camera, 
  Image as ImageIcon,
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
import type { StagePermission } from "@/features/orders/workspace/shared/types";
import { ScheduleVisitModal } from "./ScheduleVisitModal";
import { updateSiteVisitDetailsAction } from "@/features/orders/actions/orderActions";
import { deleteStorageFilesAction } from "@/features/orders/actions/storageActions";
import { scheduleSiteVisitAction } from "@/features/orders/actions/orderActions";
import { isStageInOp } from "@/features/orders/businessOperations";
import { buildGoogleMapsSearchUrl } from "@/features/orders/actions/siteVisitMapper";
import {
  isSkippedSiteVisit,
} from "@/features/orders/workspace/modules/site-visit/siteVisitUiLogic";
import { uploadFiles } from "@/utils/storage/uploadClient";
import { parseStoredRef } from "@/utils/storage/storageRef";
import { getSignedReadUrl } from "@/utils/storage/signedReadCache";
import { OrderImage } from "@/components/storage/OrderImage";
import { GoogleMap, useJsApiLoader } from "@react-google-maps/api";
import { AdvancedMapMarker } from "@/components/maps/AdvancedMapMarker";
import { OverlayPortal } from "@/components/ui/OverlayPortal";
import {
  GOOGLE_MAPS_DEFAULT_OPTIONS,
  GOOGLE_MAPS_LIBRARIES,
  GOOGLE_MAPS_SCRIPT_ID,
} from "@/components/maps/googleMapsConfig";
import { loadClientConfig } from "@/config/loadClientConfig";

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
  onSkipSiteVisit?: (location: {
    customerAddress: string;
    gpsLocation: string;
  }) => void | Promise<void>;
  /** Opens the admin customer-update message popup (copy / wa.me / mailto). */
  onCustomerMessage?: (
    key: "site_visit_scheduled",
    extra?: { date?: string; time?: string }
  ) => void;
  /** RBAC — when canEdit is false the module renders read-only. */
  permission?: StagePermission;
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
  onSkipSiteVisit,
  onCustomerMessage,
  permission,
}) => {
  // RBAC: when canEdit is false (e.g. Designer viewing Site Visit read-only),
  // all write actions are disabled on top of the existing workflow freeze.
  const canEdit = permission?.canEdit ?? true;
  // Current client config
  const config = loadClientConfig();
  const hiddenFields = config.features.siteVisit || {};
  const defaultMeasurementUnit = hiddenFields.defaultMeasurementUnit || "inch";

  if (!isStageInOp(order.business_operation || "signage", "site_visit")) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center text-slate-500">
        <MapPin size={28} className="opacity-40" />
        <div className="text-sm font-semibold text-slate-700">Site visit not part of this business operation</div>
        <div className="max-w-sm text-xs text-slate-500">
          This order uses a workflow that skips site visit. Continue from Quotation or the next included stage.
        </div>
      </div>
    );
  }
  const opScoped = hiddenFields.businessOperations;
  if (
    opScoped &&
    opScoped.length > 0 &&
    !opScoped.includes(order.business_operation || "signage")
  ) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center text-slate-500">
        <MapPin size={28} className="opacity-40" />
        <div className="text-sm font-semibold text-slate-700">Site visit disabled for this operation</div>
      </div>
    );
  }

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

  const [map, setMap] = useState<google.maps.Map | null>(null);

  const { isLoaded } = useJsApiLoader({
    id: GOOGLE_MAPS_SCRIPT_ID,
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "",
    libraries: GOOGLE_MAPS_LIBRARIES,
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
  // Effective lock also includes RBAC read-only grants (e.g. Designer viewing Site Visit).
  const isFrozen = (baseFrozen && !adminOverrideUnlocked) || !canEdit;
  
  const [isSkipLocationModalOpen, setIsSkipLocationModalOpen] = useState(false);

  // State for manual scheduling
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);

  // Photo viewer state
  const [viewerPhotos, setViewerPhotos] = useState<string[]>([]);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  const openViewer = (photosArray: string[], index: number) => {
    setViewerPhotos(photosArray);
    setViewerIndex(index);
  };

  useEffect(() => {
    if (viewerIndex === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setViewerIndex(null);
      if (e.key === "ArrowLeft") setViewerIndex((i) => (i !== null && i > 0 ? i - 1 : i));
      if (e.key === "ArrowRight") {
        setViewerIndex((i) =>
          i !== null && i < viewerPhotos.length - 1 ? i + 1 : i
        );
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [viewerIndex, viewerPhotos.length]);

  const handlePhotoFiles = async (files: FileList | null) => {
    if (!files || files.length === 0 || !selectedLocationId) return;
    setUploadingPhotos(true);
    try {
      const { ok, failed } = await uploadFiles(Array.from(files), {
        orderId: order.id,
        purpose: "site_visit_photo",
        channel: "staff",
        concurrency: 3,
      });
      const refs = ok.map((o) => `${o.bucket}/${o.path}`);
      if (failed.length) {
        alert(`${failed.length} photo(s) failed to upload: ${failed[0].error}`);
      }
      const activeLoc = (siteVisit.locations || []).find((l) => l.id === selectedLocationId);
      const newUrls = [...(activeLoc?.photos || []), ...refs];
      updateSignLocation(selectedLocationId, { photos: newUrls });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      alert("Upload failed: " + message);
    } finally {
      setUploadingPhotos(false);
    }
  };

  const removeSitePhoto = async (url: string) => {
    if (!selectedLocationId) return;
    try {
      const parsed = parseStoredRef(url);
      if (parsed) {
        await deleteStorageFilesAction(parsed.bucket, [parsed.path]);
      }
      
      const activeLoc = (siteVisit.locations || []).find(l => l.id === selectedLocationId);
      const newUrls = (activeLoc?.photos || []).filter(u => u !== url);
      updateSignLocation(selectedLocationId, { photos: newUrls });
    } catch (err: any) {
      alert("Failed to delete photo: " + (err?.message || "Unknown error"));
    }
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
    setSelectedLocationId((prev) => {
      if (prev && locs.some((loc) => loc.id === prev)) return prev;
      return locs[0]?.id || null;
    });
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
      name: `Item-${nextNum}`,
      widthUnit: defaultMeasurementUnit,
      heightUnit: defaultMeasurementUnit,
      depthUnit: defaultMeasurementUnit,
      groundClearanceUnit: defaultMeasurementUnit
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
  const removeSignLocation = async (id: string) => {
    const locToDelete = (siteVisit.locations || []).find(loc => loc.id === id);
    const updatedLocations = (siteVisit.locations || []).filter(loc => loc.id !== id);
    const updatedDetails = { ...siteVisit, locations: updatedLocations };
    
    setSiteVisit(updatedDetails);
    onUpdate(updatedDetails);
    
    if (selectedLocationId === id) {
      setSelectedLocationId(updatedLocations[0]?.id || null);
    }
    
    // Clean up photos attached to this location in the background
    if (locToDelete?.photos && locToDelete.photos.length > 0) {
      const byBucket = new Map<string, string[]>();
      for (const photoRef of locToDelete.photos) {
        const parsed = parseStoredRef(photoRef);
        if (!parsed) continue;
        const list = byBucket.get(parsed.bucket) || [];
        list.push(parsed.path);
        byBucket.set(parsed.bucket, list);
      }
      for (const [bucket, paths] of byBucket) {
        deleteStorageFilesAction(bucket, paths).catch(err => {
          console.error("Failed to clean up location photos:", err);
        });
      }
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
  const isSkipped = isSkippedSiteVisit(siteVisit);
  const installationMapsUrl =
    buildGoogleMapsSearchUrl(siteVisit.gpsLocation) ||
    buildGoogleMapsSearchUrl(scheduledAddress);

  return (
    <div className="space-y-6 text-slate-800">
      
      {/* ── ADMIN OVERRIDE BANNER ── */}
      {baseFrozen && currentUserRole === "Admin" && setAdminOverrideUnlocked && (
        <div className={`p-4 rounded-xl border flex flex-col md:flex-row md:items-center gap-3 md:justify-between transition-colors ${adminOverrideUnlocked ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200'}`}>
          <div className="flex items-start md:items-center gap-3 min-w-0">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${adminOverrideUnlocked ? 'bg-amber-100 text-amber-600' : 'bg-slate-200 text-slate-500'}`}>
              <Shield size={16} />
            </div>
            <div className="min-w-0">
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
            className={`px-4 py-2.5 rounded-lg text-xs font-bold transition-colors w-full md:w-auto shrink-0 ${
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
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
            <div className="flex items-center gap-2 shrink-0">
              <div className="w-7 h-7 bg-amber-100 rounded-full flex items-center justify-center shrink-0">
                <CheckCircle2 size={14} className="text-amber-600" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-amber-900">Site Visit Skipped</h4>
                <p className="text-[11px] text-amber-700">
                  Add measurements as needed.
                </p>
              </div>
            </div>
            {scheduledAddress && !scheduledAddress.startsWith("Skipped") && (
              <div className="flex items-start gap-1.5 min-w-0 sm:max-w-[55%] sm:text-right sm:items-end sm:flex-col">
                <div className="flex items-start gap-1.5 min-w-0 sm:flex-row-reverse">
                  <MapPin size={12} className="text-amber-600 shrink-0 mt-0.5" />
                  <div className="min-w-0 sm:text-right">
                    {installationMapsUrl ? (
                      <a
                        href={installationMapsUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] font-semibold text-blue-700 hover:underline leading-snug break-words"
                      >
                        {scheduledAddress}
                      </a>
                    ) : (
                      <div className="text-[11px] font-semibold text-slate-700 leading-snug">
                        {scheduledAddress}
                      </div>
                    )}
                    {siteVisit.gpsLocation && siteVisit.gpsLocation !== "N/A" && (
                      <div className="text-[10px] font-mono text-slate-500 mt-0.5">
                        {siteVisit.gpsLocation}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (scheduledDate || scheduledAddress) ? (
        <div className="bg-indigo-50/60 border border-indigo-200/70 rounded-xl p-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-2">
              <Calendar size={18} className="text-indigo-600" />
              <h3 className="text-sm font-bold text-indigo-900">
                Scheduled Site Visit
              </h3>
            </div>
            <div className="flex items-center gap-2">
              {onSkipSiteVisit && !isFrozen && (
                <button
                  onClick={() => setIsSkipLocationModalOpen(true)}
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
                  onLoad={setMap}
                  onUnmount={() => setMap(null)}
                  options={{ ...GOOGLE_MAPS_DEFAULT_OPTIONS, disableDefaultUI: true }}
                >
                  <AdvancedMapMarker map={map} position={mapCenter} />
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
                onClick={() => setIsSkipLocationModalOpen(true)}
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
          if (!canEdit) return;
          try {
            const res = await scheduleSiteVisitAction(order.id, {
              auditDate: date,
              auditTime: time,
              customerAddress: location,
              gpsLocation: coords
            });
            const saved = (res?.order?.siteVisitDetails || {
              ...siteVisit,
              auditDate: date,
              auditTime: time,
              customerAddress: location,
              gpsLocation: coords,
            }) as SiteVisitDetails;
            await onUpdate(saved);
            setSiteVisit((prev) => ({
              ...prev,
              ...saved,
              locations: saved.locations ?? prev.locations,
            }));
            onCustomerMessage?.("site_visit_scheduled", { date, time });
          } catch (err) {
            console.error("Failed to schedule site visit", err);
            alert("Failed to schedule site visit. Please try again.");
          }
        }}
      />

      <ScheduleVisitModal
        isOpen={isSkipLocationModalOpen}
        onClose={() => setIsSkipLocationModalOpen(false)}
        mode="location_only"
        defaultAddress={
          (scheduledAddress && !scheduledAddress.startsWith("Skipped")
            ? scheduledAddress
            : client?.shippingAddress) || ""
        }
        onSchedule={async (_date, _time, location, coords) => {
          if (!canEdit || !onSkipSiteVisit) return;
          await onSkipSiteVisit({ customerAddress: location, gpsLocation: coords });
        }}
      />
            {/* ── TOP TOGGLABLE BAR & READY CHECKBOX ── */}
      <div className="bg-gradient-to-r from-slate-50 to-slate-100/50 border border-slate-200/80 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all duration-300">
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/60 pb-3 w-full">
          <div 
            className="flex items-center gap-1 overflow-x-auto p-1 bg-slate-100 border border-slate-200/60 rounded-xl w-full max-w-full"
            style={{ WebkitOverflowScrolling: "touch", scrollbarWidth: "none", msOverflowStyle: "none" }}
          >
            {(siteVisit.locations || []).map((loc, idx) => {
              const isSelected = loc.id === selectedLocationId;
              return (
                <div key={loc.id} className={`flex items-center flex-shrink-0 rounded-lg px-3 py-1.5 transition-all ${isSelected ? "bg-white shadow-[0_1px_3px_rgba(0,0,0,0.1)] ring-1 ring-slate-900/5" : "hover:bg-slate-200/50"}`}>
                  <button
                    onClick={() => setSelectedLocationId(loc.id)}
                    className={`text-[13px] font-semibold transition-all focus:outline-none ${isSelected ? "text-[var(--color-secondary)]" : "text-slate-500 hover:text-slate-700"}`}
                  >
                    {loc.name || `Item-${idx + 1}`}
                  </button>
                  {!isFrozen && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        removeSignLocation(loc.id);
                      }}
                      className={`ml-1.5 w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-bold transition-colors focus:outline-none ${isSelected ? "text-slate-400 hover:text-red-600 hover:bg-red-50" : "text-slate-400 hover:text-red-600 hover:bg-slate-200"}`}
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
                className="flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-semibold text-slate-500 hover:text-slate-700 hover:bg-slate-200/50 rounded-lg transition-all flex-shrink-0 focus:outline-none ml-1"
              >
                <Plus size={14} strokeWidth={2.5} /> New Item
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
                <label className="block text-[10px] text-slate-500 font-medium mb-1">Item Label / Name</label>
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
                  <label className="block text-[10px] text-slate-500 font-medium mb-1">Width</label>
                  <div className="flex focus-within:ring-2 focus-within:ring-[var(--color-secondary)]/20 focus-within:border-[var(--color-secondary)] border border-slate-200 rounded-xl overflow-hidden transition-all bg-white">
                    <input
                      type="number" step="any"
                      value={activeLoc.width || ""}
                      onChange={(e) => updateSignLocation(activeLoc.id, { width: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 text-xs font-semibold focus:outline-none disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed border-r border-slate-200"
                      placeholder="0.00"
                    />
                    <select
                      value={activeLoc.widthUnit || defaultMeasurementUnit}
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
                  <label className="block text-[10px] text-slate-500 font-medium mb-1">Height</label>
                  <div className="flex focus-within:ring-2 focus-within:ring-[var(--color-secondary)]/20 focus-within:border-[var(--color-secondary)] border border-slate-200 rounded-xl overflow-hidden transition-all bg-white">
                    <input
                      type="number" step="any"
                      value={activeLoc.height || ""}
                      onChange={(e) => updateSignLocation(activeLoc.id, { height: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 text-xs font-semibold focus:outline-none disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed border-r border-slate-200"
                      placeholder="0.00"
                    />
                    <select
                      value={activeLoc.heightUnit || defaultMeasurementUnit}
                      onChange={(e) => updateSignLocation(activeLoc.id, { heightUnit: e.target.value })}
                      className="px-2 py-2 text-xs font-bold text-slate-500 focus:outline-none bg-slate-50 disabled:bg-slate-50 disabled:cursor-not-allowed outline-none cursor-pointer"
                    >
                      <option value="ft">ft</option>
                      <option value="m">m</option>
                      <option value="inch">inch</option>
                    </select>
                  </div>
                </div>
                {!hiddenFields.hideDepth && (
                  <div>
                    <label className="block text-[10px] text-slate-500 font-medium mb-1">Depth</label>
                    <div className="flex focus-within:ring-2 focus-within:ring-[var(--color-secondary)]/20 focus-within:border-[var(--color-secondary)] border border-slate-200 rounded-xl overflow-hidden transition-all bg-white">
                      <input
                        type="number" step="any"
                        value={activeLoc.depth || ""}
                        onChange={(e) => updateSignLocation(activeLoc.id, { depth: parseFloat(e.target.value) || 0 })}
                        className="w-full px-3 py-2 text-xs font-semibold focus:outline-none disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed border-r border-slate-200"
                        placeholder="0.00"
                      />
                      <select
                        value={activeLoc.depthUnit || defaultMeasurementUnit}
                        onChange={(e) => updateSignLocation(activeLoc.id, { depthUnit: e.target.value })}
                        className="px-2 py-2 text-xs font-bold text-slate-500 focus:outline-none bg-slate-50 disabled:bg-slate-50 disabled:cursor-not-allowed outline-none cursor-pointer"
                      >
                        <option value="ft">ft</option>
                        <option value="m">m</option>
                        <option value="inch">inch</option>
                      </select>
                    </div>
                  </div>
                )}
                {!hiddenFields.hideGroundClearance && (
                  <div>
                    <label className="block text-[10px] text-slate-500 font-medium mb-1">Ground Clearance</label>
                    <div className="flex focus-within:ring-2 focus-within:ring-[var(--color-secondary)]/20 focus-within:border-[var(--color-secondary)] border border-slate-200 rounded-xl overflow-hidden transition-all bg-white">
                      <input
                        type="number" step="any"
                        value={activeLoc.groundClearance || ""}
                        onChange={(e) => updateSignLocation(activeLoc.id, { groundClearance: parseFloat(e.target.value) || 0 })}
                        className="w-full px-3 py-2 text-xs font-semibold focus:outline-none disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed border-r border-slate-200"
                        placeholder="0.00"
                      />
                      <select
                        value={activeLoc.groundClearanceUnit || defaultMeasurementUnit}
                        onChange={(e) => updateSignLocation(activeLoc.id, { groundClearanceUnit: e.target.value })}
                        className="px-2 py-2 text-xs font-bold text-slate-500 focus:outline-none bg-slate-50 disabled:bg-slate-50 disabled:cursor-not-allowed outline-none cursor-pointer"
                      >
                        <option value="ft">ft</option>
                        <option value="m">m</option>
                        <option value="inch">inch</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-[10px] text-slate-500 font-medium mb-1">Location / Surface Specific Notes</label>
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
          {!hiddenFields.hideElectricalAssessment && (
            <SectionCard
              title="Electrical Assessment"
              icon="⚡"
              isCollapsed={collapsed.electrical}
              onToggle={() => toggleSection("electrical")}
            >
              <fieldset disabled={isFrozen} className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-4">
                <div>
                  <label className="block text-[10px] text-slate-500 font-medium mb-2">Power Source Available?</label>
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
                          name={`power_${activeLoc.id}`}
                          value={String(option)}
                          checked={activeLoc.powerAvailable === option}
                          onChange={() => updateSignLocation(activeLoc.id, { powerAvailable: option })}
                          className="hidden"
                          disabled={isFrozen}
                        />
                        {option ? "Yes, Available" : "No"}
                      </label>
                    ))}
                  </div>
                </div>
                
                <div>
                  <label className="block text-[10px] text-slate-500 font-medium mb-2">Distance to Power Source</label>
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
                  <label className="block text-[10px] text-slate-500 font-medium mb-1.5">Electrical Assessment Notes</label>
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
          )}

          {/* ── STRUCTURAL ASSESSMENT ── */}
          <SectionCard
            title="Structural Assessment"
            icon="🏗️"
            isCollapsed={collapsed.structural}
            onToggle={() => toggleSection("structural")}
          >
            <fieldset disabled={isFrozen} className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-4">
              <div>
                <label className="block text-[10px] text-slate-500 font-medium mb-1.5">Wall / Surface Type</label>
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
                <label className="block text-[10px] text-slate-500 font-medium mb-1.5">Proposed Mounting Method</label>
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
                <label className="block text-[10px] text-slate-500 font-medium mb-1.5">Surface Quality / Condition</label>
                <input
                  type="text"
                  value={activeLoc.surfaceCondition || ""}
                  onChange={(e) => updateSignLocation(activeLoc.id, { surfaceCondition: e.target.value })}
                  placeholder="e.g. Robust concrete, brittle ACP sheets..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[var(--color-secondary)]/20 focus:border-[var(--color-secondary)] bg-white transition-all disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed"
                />
              </div>
              
              <div>
                <label className="block text-[10px] text-slate-500 font-medium mb-1.5">Physical Obstacles</label>
                <input
                  type="text"
                  value={activeLoc.obstacles?.join(", ") || ""}
                  onChange={(e) => updateSignLocation(activeLoc.id, { obstacles: e.target.value.split(",").map(s => s.trim()).filter(Boolean) })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[var(--color-secondary)]/20 focus:border-[var(--color-secondary)] bg-white transition-all disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed"
                  placeholder="e.g. Tree branches, security cams, pipes (comma separated)"
                />
              </div>
              
              <div className="md:col-span-2">
                <label className="block text-[10px] text-slate-500 font-medium mb-1.5">Structural Reinforcements / Special Instructions</label>
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
            <label className="block text-[10px] text-slate-500 font-medium mb-2">Installation Type</label>
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
            <label className="block text-[10px] text-slate-500 font-medium mb-2">Overnight Installation</label>
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
            <label className="block text-[10px] text-slate-500 font-medium mb-2">Extra Angles Required</label>
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
                <label className="block text-[10px] text-slate-500 font-medium mb-1.5">Length</label>
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
            !hiddenFields.hideExtraWireRequired ? { key: "extraWireRequired", label: "Extra Wire Required" } : null,
          ].filter(Boolean) as { key: keyof typeof siteVisit; label: string }[]).map(({ key, label }) => (
            <div key={key}>
              <label className="block text-[10px] text-slate-500 font-medium mb-2">{label}</label>
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
            <label className="block text-[10px] text-slate-500 font-medium mb-2">Design Brief Available?</label>
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
          {!hiddenFields.hideFabricationReq && (
            <div>
              <label className="block text-[10px] text-slate-500 font-medium mb-2">Fabrication Required</label>
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
          )}

          {/* Civil Work Required */}
          {!hiddenFields.hideCivilWork && (
            <div>
              <label className="block text-[10px] text-slate-500 font-medium mb-2">Civil Work Required</label>
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
          )}
        </fieldset>
      </SectionCard>

      {/* ── PHOTO VIEWER MODAL (portaled so worksheet overflow cannot clip it) ── */}
      {viewerIndex !== null && viewerPhotos.length > 0 && (
        <OverlayPortal>
          <div
            className="fixed inset-0 z-[99999] bg-black/95 flex items-center justify-center"
            onClick={() => setViewerIndex(null)}
            role="dialog"
            aria-modal="true"
            aria-label="Photo viewer"
          >
            <button
              type="button"
              className="absolute top-3 right-3 sm:top-6 sm:right-6 z-10 text-white/80 hover:text-white bg-black/50 hover:bg-black/80 rounded-full p-2.5 sm:p-2 transition-all focus:outline-none"
              onClick={() => setViewerIndex(null)}
              aria-label="Close photo viewer"
            >
              <X size={22} />
            </button>

            <div className="relative w-full h-full max-w-5xl max-h-[100dvh] sm:max-h-[90vh] flex items-center justify-center px-12 sm:px-16 py-14 sm:py-16">
              <OrderImage
                src={viewerPhotos[viewerIndex]}
                format="origin"
                className="max-w-full max-h-full w-auto h-auto object-contain select-none"
                alt={`Site photo ${viewerIndex + 1}`}
                onClick={(e) => e.stopPropagation()}
              />
            </div>

            {viewerIndex > 0 && (
              <button
                type="button"
                className="absolute left-2 sm:left-6 top-1/2 -translate-y-1/2 text-white/80 hover:text-white bg-black/50 hover:bg-black/80 rounded-full p-2 sm:p-3 transition-all focus:outline-none"
                onClick={(e) => { e.stopPropagation(); setViewerIndex(viewerIndex - 1); }}
                aria-label="Previous photo"
              >
                <ChevronLeft size={28} className="sm:w-8 sm:h-8" />
              </button>
            )}

            {viewerIndex < viewerPhotos.length - 1 && (
              <button
                type="button"
                className="absolute right-2 sm:right-6 top-1/2 -translate-y-1/2 text-white/80 hover:text-white bg-black/50 hover:bg-black/80 rounded-full p-2 sm:p-3 transition-all focus:outline-none"
                onClick={(e) => { e.stopPropagation(); setViewerIndex(viewerIndex + 1); }}
                aria-label="Next photo"
              >
                <ChevronRight size={28} className="sm:w-8 sm:h-8" />
              </button>
            )}

            <div className="absolute bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 sm:gap-3 px-2">
              <div className="bg-black/60 text-white text-xs sm:text-sm font-medium px-3 sm:px-4 py-1.5 rounded-full backdrop-blur-md whitespace-nowrap">
                {viewerIndex + 1} / {viewerPhotos.length}
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  window.open(`${viewerPhotos[viewerIndex]}?download=`, "_blank");
                }}
                className="inline-flex items-center gap-1.5 bg-black/60 hover:bg-black/80 text-white text-xs sm:text-sm font-semibold px-3 sm:px-4 py-1.5 rounded-full backdrop-blur-md transition-colors"
              >
                <Download size={14} />
                Download
              </button>
            </div>
          </div>
        </OverlayPortal>
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
    <div className="w-full px-3 sm:px-5 py-4 flex items-center justify-between bg-slate-50/30 hover:bg-slate-50/70 border-b border-slate-100 transition-colors">
      <button
        onClick={onToggle}
        className="flex-1 text-left flex items-center justify-between focus:outline-none min-w-0 gap-2"
      >
        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 min-w-0">
          {icon && <span className="text-base shrink-0">{icon}</span>}
          <span className="truncate">{title}</span>
        </h3>
        {!extra && (
          isCollapsed ? <ChevronDown size={18} className="text-slate-400 transition-transform duration-200 shrink-0" /> : <ChevronUp size={18} className="text-slate-400 transition-transform duration-200 shrink-0" />
        )}
      </button>
      {extra && (
        <div className="flex items-center gap-3 shrink-0">
          {extra}
          <button onClick={onToggle} className="focus:outline-none p-1">
            {isCollapsed ? <ChevronDown size={18} className="text-slate-400" /> : <ChevronUp size={18} className="text-slate-400" />}
          </button>
        </div>
      )}
    </div>
    {!isCollapsed && (
      <div className="px-3 sm:px-5 pb-5">
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
  const reactId = React.useId();
  const cameraInputId = `${reactId}-camera`;
  const galleryInputId = `${reactId}-gallery`;

  const handlePick = (files: FileList | null) => {
    void onFiles(files);
  };

  /** Visually hidden but still activatable — `display:none` / `.hidden` breaks iOS Safari file pickers. */
  const fileInputClassName =
    "absolute w-px h-px p-0 -m-px overflow-hidden whitespace-nowrap border-0 [clip:rect(0,0,0,0)]";

  const cameraLabelClass =
    "inline-flex items-center gap-2 px-4 py-2.5 bg-[var(--color-secondary)] text-white rounded-xl text-xs font-bold hover:opacity-90 transition-opacity " +
    (uploading ? "opacity-50 pointer-events-none" : "cursor-pointer");
  const galleryLabelClass =
    "inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-50 transition-colors " +
    (uploading ? "opacity-50 pointer-events-none" : "cursor-pointer");

  return (
    <div className="pt-4 space-y-4">
      {/* Upload buttons — native <label for> so iPhone/Android open camera/gallery reliably */}
      {!disabled && (
        <div className="relative flex flex-wrap gap-3">
          <input
            id={cameraInputId}
            type="file"
            accept="image/*"
            capture="environment"
            className={fileInputClassName}
            tabIndex={-1}
            onChange={(e) => {
              handlePick(e.target.files);
              e.target.value = "";
            }}
          />
          <input
            id={galleryInputId}
            type="file"
            accept="image/*,image/heic,image/heif"
            multiple
            className={fileInputClassName}
            tabIndex={-1}
            onChange={(e) => {
              handlePick(e.target.files);
              e.target.value = "";
            }}
          />
          <label htmlFor={cameraInputId} className={cameraLabelClass} aria-disabled={uploading}>
            <Camera size={14} />
            Take Photo
          </label>
          <label htmlFor={galleryInputId} className={galleryLabelClass} aria-disabled={uploading}>
            <ImageIcon size={14} />
            Gallery
          </label>

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
            <div key={url} className="relative group w-28 h-28 sm:w-32 sm:h-32 rounded-xl overflow-hidden border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
              <OrderImage
                src={url}
                width={320}
                alt={`Site photo ${idx + 1}`}
                className="w-full h-full object-cover"
                placeholder={
                  <div className="w-full h-full bg-slate-100 animate-pulse" aria-hidden />
                }
              />
              <div className="absolute inset-0 bg-slate-900/70 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 px-1">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onView(idx); }}
                  className="w-7 h-7 shrink-0 rounded-full bg-white/20 hover:bg-white/40 flex items-center justify-center text-white transition-colors"
                  title="View"
                  aria-label="View photo"
                >
                  <Eye size={13} />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    void (async () => {
                      try {
                        const parsed = parseStoredRef(url);
                        const href = parsed
                          ? await getSignedReadUrl(parsed.bucket, parsed.path)
                          : url;
                        // Force download via blob so private signed URLs work on mobile.
                        const res = await fetch(href);
                        const blob = await res.blob();
                        const blobUrl = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = blobUrl;
                        a.download = `site-photo-${idx + 1}.jpg`;
                        document.body.appendChild(a);
                        a.click();
                        a.remove();
                        URL.revokeObjectURL(blobUrl);
                      } catch {
                        alert("Could not download photo.");
                      }
                    })();
                  }}
                  className="w-7 h-7 shrink-0 rounded-full bg-white/20 hover:bg-white/40 flex items-center justify-center text-white transition-colors"
                  title="Download"
                  aria-label="Download photo"
                >
                  <Download size={13} />
                </button>
                {!disabled && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onRemove(url); }}
                    className="w-7 h-7 shrink-0 rounded-full bg-red-500/80 hover:bg-red-500 flex items-center justify-center text-white transition-colors"
                    title="Remove"
                    aria-label="Remove photo"
                  >
                    <Trash size={13} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <label
          htmlFor={disabled ? undefined : cameraInputId}
          className={`flex flex-col items-center justify-center py-10 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50 transition-colors ${disabled ? "" : "cursor-pointer hover:border-[var(--color-secondary)] hover:bg-slate-100/50"}`}
        >
          <Camera size={28} className="text-slate-300 mb-2" />
          <p className="text-xs font-bold text-slate-400">No photos yet</p>
          {!disabled && <p className="text-[10px] text-slate-400 mt-0.5">Tap &quot;Take Photo&quot; or &quot;Gallery&quot;</p>}
        </label>
      )}
    </div>
  );
};

