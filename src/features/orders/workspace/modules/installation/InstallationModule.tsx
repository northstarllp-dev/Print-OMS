"use client";

import React, { useEffect, useState } from "react";
import { ArrowLeft, Sparkles, Check, Loader2, CheckCircle, Save, Camera, Calendar, Clock, Shield, FileText, Image as ImageIcon, Eye, Download, Trash, X, ChevronLeft, ChevronRight } from "lucide-react";
import { InstallationScheduleModule } from "@/features/installations/components/InstallationScheduleModule";
import { deleteStorageFilesAction } from "@/features/orders/actions/storageActions";
import { uploadFiles } from "@/utils/storage/uploadClient";
import { parseStoredRef } from "@/utils/storage/storageRef";
import { getSignedReadUrl } from "@/utils/storage/signedReadCache";
import { OrderImage } from "@/components/storage/OrderImage";
import { resolveSiteVisitInstallationAddress, buildGoogleMapsSearchUrl } from "@/features/orders/actions/siteVisitMapper";
import { OverlayPortal } from "@/components/ui/OverlayPortal";
import type { StageModuleProps } from "../../shared/types";

export interface InstallationModuleData {
  order: any;
  customers: any[];
  installation: any;
}

export interface InstallationModuleCallbacks {
  updateInstallationDetails: (orderId: string, details: any) => Promise<any>;
  onBack: () => void;
  onInstallationScheduled?: (payload: { scheduledDate: string; scheduledTime: string }) => void;
}

type InstallationModuleProps = StageModuleProps<
  InstallationModuleData,
  InstallationModuleCallbacks
> & {
  /** When true, hide portal chrome (back button) and fit inside order detail panel. */
  embedded?: boolean;
  adminOverrideUnlocked?: boolean;
  setAdminOverrideUnlocked?: (val: boolean) => void;
  currentUserRole?: string;
};

export function InstallationModule({ 
  data, 
  permission, 
  callbacks, 
  embedded = false,
  adminOverrideUnlocked,
  setAdminOverrideUnlocked,
  currentUserRole 
}: InstallationModuleProps) {
  const { order, customers, installation } = data;
  const {
    updateInstallationDetails,
    onBack,
    onInstallationScheduled,
  } = callbacks;
  
  const isInstallationStage = [
    "Ready For Installation",
    "Installation Scheduled",
    "Installation In Progress",
    "Installation Pending",
    "Installation",
  ].includes(order.stage);
  const baseFrozen = !isInstallationStage;
  const canEdit = (permission?.canEdit ?? true) && (!baseFrozen || adminOverrideUnlocked);

  const [saving, setSaving] = useState(false);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [alert, setAlert] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const client = customers.find(c => c.id === order.customerId);
  const svDetails = order.siteVisitDetails || {};
  
  const dd = order.designDetails || order.design || { proofUrl: "", status: "Draft" };
  const designImage = order.imageMockup || dd.proofUrl;
  
  const installationDetails = installation || {};
  const gmapLink = svDetails.gmap_link || svDetails.gmapLink;
  const installationSiteAddress =
    resolveSiteVisitInstallationAddress(svDetails, client?.shippingAddress) ||
    "Installation Location";
  const siteAddress = installationSiteAddress;
  const siteMapsLink =
    gmapLink ||
    buildGoogleMapsSearchUrl(svDetails.gpsLocation) ||
    buildGoogleMapsSearchUrl(installationSiteAddress !== "Installation Location" ? installationSiteAddress : null);

  const defaultChecklist = [
    { id: "prep", label: "Site preparation completed", checked: false },
    { id: "mount", label: "Signage mounted securely", checked: false },
    { id: "elec", label: "Electricals/Wiring tested (if applicable)", checked: false },
    { id: "clean", label: "Site cleaned up", checked: false },
  ];

  const [checklist, setChecklist] = useState(
    Array.isArray(installation?.checklist) ? installation.checklist : defaultChecklist
  );
  const [notes, setNotes] = useState(installation?.notes || "");
  const [afterPhotos, setAfterPhotos] = useState<string[]>(
    installation?.photos || installation?.afterPhotos || []
  );
  const [viewerPhotos, setViewerPhotos] = useState<string[]>([]);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  const openPhotoViewer = (index: number) => {
    setViewerPhotos(afterPhotos);
    setViewerIndex(index);
  };

  const handleDownloadPhoto = async (url: string, filename?: string) => {
    try {
      let fetchUrl = url;
      const parsed = parseStoredRef(url);
      if (parsed) {
        fetchUrl = await getSignedReadUrl(parsed.bucket, parsed.path);
      }
      const response = await fetch(fetchUrl);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = filename || `installation-photo-${Date.now()}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error("Download failed:", error);
      window.alert("Failed to download photo");
    }
  };

  // Keep local worksheet fields in sync when realtime/parent installation props change.
  useEffect(() => {
    setChecklist(Array.isArray(installation?.checklist) ? installation.checklist : defaultChecklist);
    setNotes(installation?.notes || "");
    setAfterPhotos(installation?.photos || installation?.afterPhotos || []);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync from installation prop only
  }, [installation]);

  const handleToggleCheck = async (stepId: string) => {
    if (!canEdit) return;
    const newChecklist = checklist.map((s: any) =>
      s.id === stepId ? { ...s, checked: !s.checked } : s
    );
    setChecklist(newChecklist);
    try {
      await updateInstallationDetails(order.id, { checklist: newChecklist });
    } catch (error) {
      console.error("Failed to update checklist:", error);
    }
  };

  const handlePhotoFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!canEdit) return;
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploadingPhotos(true);
    try {
      const { ok, failed } = await uploadFiles(Array.from(files), {
        orderId: order.id,
        purpose: "installation_photo",
        channel: "staff",
        concurrency: 3,
      });
      const refs = ok.map((o) => `${o.bucket}/${o.path}`);
      if (failed.length) {
        window.alert(`${failed.length} photo(s) failed to upload: ${failed[0].error}`);
      }
      const newUrls = [...afterPhotos, ...refs];
      setAfterPhotos(newUrls);
      if (refs.length) {
        try {
          await updateInstallationDetails(order.id, { afterPhotos: newUrls, photos: newUrls });
        } catch (dbErr) {
          // Roll back storage on DB failure to avoid orphans.
          const byBucket = new Map<string, string[]>();
          for (const o of ok) {
            const list = byBucket.get(o.bucket) || [];
            list.push(o.path);
            byBucket.set(o.bucket, list);
          }
          for (const [bucket, paths] of byBucket) {
            await deleteStorageFilesAction(bucket, paths).catch(() => {});
          }
          setAfterPhotos(afterPhotos);
          throw dbErr;
        }
      }
    } catch (err: any) {
      window.alert("Upload failed: " + (err?.message || "Unknown error"));
    } finally {
      setUploadingPhotos(false);
      e.target.value = "";
    }
  };

  const removeInstallationPhoto = async (urlToRemove: string) => {
    if (!canEdit) return;
    if (!window.confirm("Are you sure you want to remove this photo?")) return;
    try {
      const newUrls = afterPhotos.filter(u => u !== urlToRemove);
      setAfterPhotos(newUrls);
      // DB first — if this fails, the photo is still in storage (no broken link).
      await updateInstallationDetails(order.id, { afterPhotos: newUrls, photos: newUrls });
      // Then best-effort storage cleanup.
      const parsed = parseStoredRef(urlToRemove);
      if (parsed) {
        try {
          await deleteStorageFilesAction(parsed.bucket, [parsed.path]);
        } catch (cleanupErr) {
          console.error("Storage cleanup failed (DB record already removed):", cleanupErr);
        }
      }
    } catch (err: any) {
      // Restore local state if DB write failed.
      setAfterPhotos(afterPhotos);
      window.alert("Failed to delete photo: " + (err?.message || "Unknown error"));
    }
  };

  const handleSaveNotes = async () => {
    if (!canEdit) return;
    setSaving(true);
    try {
      await updateInstallationDetails(order.id, { notes });
      setAlert({ message: "Notes saved.", type: "success" });
    } catch (err: any) {
      setAlert({ message: err.message, type: "error" });
    } finally {
      setSaving(false);
      setTimeout(() => setAlert(null), 3000);
    }
  };

  const isSubmittedToAdmin = order.stageStatus === "Pending Admin Approval: Job Done";
  const isCompleted =
    order.stage === "Completed" ||
    order.stage === "Closed" ||
    isSubmittedToAdmin;
  // RBAC (canEdit) + workflow (isCompleted): authority vs actionable
  const canAct = canEdit && !isCompleted;

  return (
    <>
    <div className={`min-w-0 max-w-full overflow-x-hidden ${embedded ? "space-y-6" : "p-4 sm:p-8 bg-slate-50/50 min-h-screen"}`}>
      {/* ── ADMIN OVERRIDE BANNER ── */}
      {baseFrozen && currentUserRole === "Admin" && setAdminOverrideUnlocked && (
        <div className={`mb-6 p-4 rounded-xl border flex flex-col md:flex-row md:items-center gap-3 md:justify-between transition-colors ${adminOverrideUnlocked ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200'}`}>
          <div className="flex items-start md:items-center gap-3 min-w-0">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${adminOverrideUnlocked ? 'bg-amber-100 text-amber-600' : 'bg-slate-200 text-slate-500'}`}>
              <Shield size={16} />
            </div>
            <div className="min-w-0">
              <h4 className={`text-sm font-bold ${adminOverrideUnlocked ? 'text-amber-900' : 'text-slate-700'}`}>Admin God Mode</h4>
              <p className={`text-xs ${adminOverrideUnlocked ? 'text-amber-700' : 'text-slate-500'}`}>
                {adminOverrideUnlocked 
                  ? "Module is currently unlocked. You can edit all details and submit updates." 
                  : "This module is locked because it is not the active phase. Unlock it to forcefully edit details."}
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

      {/* Top Navigation — portal only */}
      {!embedded && (
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-slate-600 text-xs font-bold shadow-xs hover:bg-slate-50 transition-colors"
          >
            <ArrowLeft size={14} /> Back to Queue
          </button>
          <span className="text-slate-300">/</span>
          <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">{order.orderCode}</span>
        </div>
      )}

      {/* Embedded: date started + scheduled only. Portal: full title/status. */}
      {embedded ? (
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-wrap gap-8">
            <div>
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                Date Started
              </div>
              <div className="text-sm font-bold text-slate-800">
                {order.dateCreated
                  ? new Date(order.dateCreated).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })
                  : "TBD"}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                Scheduled Install
              </div>
              <div className="text-sm font-bold text-slate-800">
                {installationDetails.scheduledDate
                  ? `${new Date(installationDetails.scheduledDate + "T00:00:00").toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}${installationDetails.scheduledTime ? ` · ${installationDetails.scheduledTime}` : ""}`
                  : "Not scheduled"}
              </div>
            </div>
          </div>
          {alert && (
            <div className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${
              alert.type === "success"
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : "bg-rose-50 text-rose-700 border-rose-200"
            }`}>
              {alert.message}
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                {order.businessName} - {order.clientName}
              </h1>
            </div>
            <p className="text-xs text-slate-500 font-semibold">
              Status: <span className="text-green-600 font-bold">{order.stage}</span>
            </p>
          </div>

          {alert && (
            <div className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${
              alert.type === "success"
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : "bg-rose-50 text-rose-700 border-rose-200"
            }`}>
              {alert.message}
            </div>
          )}
        </div>
      )}



      <div className={embedded ? "space-y-8" : "grid grid-cols-1 lg:grid-cols-3 gap-8 items-start"}>

        {/* Work column — full width when embedded */}
        <div className={embedded ? "space-y-8" : "lg:col-span-2 space-y-8"}>

          {/* SCHEDULE INSTALLATION */}
          <InstallationScheduleModule 
            orderId={order.id}
            initialScheduledDate={installationDetails.scheduledDate}
            initialScheduledTime={installationDetails.scheduledTime}
            isCompleted={!canAct}
            locationLink={siteMapsLink || undefined}
            locationText={siteAddress}
            onScheduled={onInstallationScheduled}
          />
          
          {/* CHECKLIST */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-6 shadow-sm min-w-0 max-w-full overflow-hidden">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-4 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2 min-w-0">
                <CheckCircle size={18} className="text-green-600 shrink-0" />
                <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider">
                  Installation Checklist
                </h2>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              {checklist.map((step: any) => (
                <div 
                  key={step.id}
                  onClick={() => canAct && handleToggleCheck(step.id)}
                  className={`p-4 border rounded-xl flex items-center gap-3 transition-all duration-200 ${
                    canAct ? "cursor-pointer select-none" : "opacity-70 cursor-not-allowed"
                  } ${
                    step.checked 
                      ? "bg-green-50/50 border-green-200 text-green-950" 
                      : "bg-white border-slate-200 hover:border-slate-300 text-slate-800"
                  }`}
                >
                  <div className={`w-5 h-5 rounded-md border flex items-center justify-center flex-shrink-0 transition-all ${
                    step.checked 
                      ? "bg-green-600 border-green-600 text-white" 
                      : "border-slate-300 bg-white"
                  }`}>
                    {step.checked && <Check size={14} strokeWidth={3} />}
                  </div>
                  <div className="text-xs font-bold leading-tight">{step.label}</div>
                </div>
              ))}
            </div>

            <div className="mt-6 sm:mt-8 bg-slate-50/50 rounded-xl p-3 sm:p-4 border border-slate-100 min-w-0">
              <div className="flex items-center gap-2 mb-3">
                <FileText size={16} className="text-slate-500" />
                <label className="block text-xs font-bold text-slate-700">Installation Notes / Remarks</label>
              </div>
              <textarea 
                value={notes}
                onChange={e => setNotes(e.target.value)}
                onBlur={() => {
                  if (!canAct) return;
                  void updateInstallationDetails(order.id, { notes }).catch(() => {});
                }}
                disabled={!canAct}
                placeholder="Add any notes about the installation (e.g. issues encountered, specific details...)"
                className="w-full min-h-[100px] bg-white text-slate-800 text-sm p-4 border border-slate-200 rounded-xl focus:outline-none focus:border-green-500 focus:ring-4 focus:ring-green-500/10 transition-all resize-y shadow-sm"
              />
              {!isCompleted && (
                <div className="mt-3 flex justify-stretch sm:justify-end">
                  <button 
                    onClick={handleSaveNotes}
                    disabled={saving || !canEdit}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-white text-slate-700 hover:bg-slate-50 border border-slate-200 shadow-sm rounded-lg text-xs font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Save size={14} /> Save Notes
                  </button>
                </div>
              )}
            </div>

            <div className="mt-8">
              <div className="flex items-center gap-2 mb-4">
                <ImageIcon size={16} className="text-slate-500" />
                <label className="block text-xs font-bold text-slate-700">After-Installation Photos</label>
              </div>
              
              <div className="space-y-4">
                {afterPhotos.length > 0 && (
                  <div className="flex flex-wrap gap-4">
                    {afterPhotos.map((photo, index) => (
                      <div key={photo} className="group relative w-24 h-24 sm:w-32 sm:h-32 bg-slate-100 rounded-xl overflow-hidden border border-slate-200 shadow-sm">
                        <OrderImage src={photo} width={320} alt={`Installation photo ${index + 1}`} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-slate-900/70 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); openPhotoViewer(index); }}
                            className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/40 flex items-center justify-center text-white transition-colors"
                            title="View"
                            aria-label="View photo"
                          >
                            <Eye size={15} />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); void handleDownloadPhoto(photo, `installation-photo-${index + 1}.jpg`); }}
                            className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/40 flex items-center justify-center text-white transition-colors"
                            title="Download"
                            aria-label="Download photo"
                          >
                            <Download size={15} />
                          </button>
                          {!isCompleted && canEdit && (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); void removeInstallationPhoto(photo); }}
                              className="w-8 h-8 rounded-full bg-red-500/80 hover:bg-red-500 flex items-center justify-center text-white transition-colors"
                              title="Remove"
                              aria-label="Remove photo"
                            >
                              <Trash size={15} />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                
                {!isCompleted && (
                  <div className="relative pt-2 flex flex-wrap items-center gap-3">
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      id="installation-photos-camera"
                      className="absolute w-px h-px p-0 -m-px overflow-hidden whitespace-nowrap border-0 [clip:rect(0,0,0,0)]"
                      onChange={handlePhotoFiles}
                      disabled={uploadingPhotos || !canEdit}
                      tabIndex={-1}
                    />
                    <input
                      type="file"
                      multiple
                      accept="image/*,image/heic,image/heif"
                      id="installation-photos-gallery"
                      className="absolute w-px h-px p-0 -m-px overflow-hidden whitespace-nowrap border-0 [clip:rect(0,0,0,0)]"
                      onChange={handlePhotoFiles}
                      disabled={uploadingPhotos || !canEdit}
                      tabIndex={-1}
                    />
                    {uploadingPhotos ? (
                      <span className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold border border-slate-200 bg-slate-50 text-slate-400">
                        <Loader2 size={14} className="animate-spin" /> Uploading...
                      </span>
                    ) : (
                      <>
                        <label
                          htmlFor="installation-photos-camera"
                          className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
                            !canEdit
                              ? "bg-slate-50 text-slate-400 border border-slate-200 cursor-not-allowed pointer-events-none"
                              : "bg-[var(--color-secondary)] text-white cursor-pointer hover:opacity-90"
                          }`}
                          aria-disabled={!canEdit}
                        >
                          <Camera size={14} /> Take Photo
                        </label>
                        <label
                          htmlFor="installation-photos-gallery"
                          className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all border ${
                            !canEdit
                              ? "bg-slate-50 text-slate-400 border-slate-200 cursor-not-allowed pointer-events-none"
                              : "bg-white hover:bg-slate-50 border-slate-200 text-slate-700 cursor-pointer shadow-sm"
                          }`}
                          aria-disabled={!canEdit}
                        >
                          <ImageIcon size={14} className="text-slate-500" /> Gallery
                        </label>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
            
            {isSubmittedToAdmin && (
              <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs font-semibold text-amber-800">
                Submitted to admin for payment review. The order will be marked completed after admin approval.
              </div>
            )}
          </div>
          


          {/* DESIGN REFERENCE */}
          {designImage && (
            <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-6 shadow-sm min-w-0 max-w-full overflow-hidden">
              <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
                <Sparkles size={18} className="text-purple-600" />
                <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider">
                  Design Reference
                </h2>
              </div>
              <div className="rounded-xl overflow-hidden border border-slate-200 bg-slate-50">
                <OrderImage
                  src={designImage}
                  format="origin"
                  alt="Design Proof"
                  className="w-full h-auto max-h-[400px] object-contain"
                />
              </div>
            </div>
          )}

        </div>

        {/* RIGHT COLUMN — portal only (customer already in worksheet chrome) */}
        {!embedded && (
          <div className="space-y-6 lg:sticky lg:top-24 transition-all duration-300">
            {client && (
              <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm">
                <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
                  <Sparkles size={18} className="text-rose-600" />
                  <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider">
                    Client Contact
                  </h2>
                </div>
                <div className="space-y-4 text-xs">
                  <div>
                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Client Name</div>
                    <div className="font-bold text-slate-800 text-sm">{client.name}</div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {client.phone && (
                      <div>
                        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Phone</div>
                        <div className="font-semibold text-slate-700">📞 {client.phone}</div>
                      </div>
                    )}
                    {client.whatsapp && (
                      <div>
                        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">WhatsApp</div>
                        <div className="font-semibold text-emerald-600">💬 {client.whatsapp}</div>
                      </div>
                    )}
                  </div>

                  {client.email && (
                    <div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Email</div>
                      <div className="font-semibold text-slate-700">✉️ {client.email}</div>
                    </div>
                  )}

                  {installationSiteAddress && (
                    <div className="pt-2 border-t border-slate-100 mt-2">
                      <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Installation / Shipping Address</div>
                      {siteMapsLink ? (
                        <a
                          href={siteMapsLink}
                          target="_blank"
                          rel="noreferrer"
                          className="font-medium text-blue-600 leading-relaxed p-2 bg-slate-50 rounded-lg border border-slate-100 hover:underline block"
                        >
                          {installationSiteAddress}
                        </a>
                      ) : (
                        <div className="font-medium text-slate-600 leading-relaxed p-2 bg-slate-50 rounded-lg border border-slate-100">{installationSiteAddress}</div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </div>

    {viewerIndex !== null && viewerPhotos.length > 0 && (
      <OverlayPortal>
        <div
          className="fixed inset-0 z-[99999] bg-black/90 flex items-center justify-center backdrop-blur-sm"
          onClick={() => setViewerIndex(null)}
          role="presentation"
        >
          <button
            type="button"
            className="absolute top-6 right-6 text-white/70 hover:text-white bg-black/50 hover:bg-black/80 rounded-full p-2 transition-all"
            onClick={() => setViewerIndex(null)}
            aria-label="Close photo viewer"
          >
            <X size={24} />
          </button>

          <div className="relative max-w-4xl max-h-[85vh] w-full h-full flex items-center justify-center p-4">
            <OrderImage
              src={viewerPhotos[viewerIndex]}
              format="origin"
              alt={`Installation photo ${viewerIndex + 1}`}
              className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          </div>

          {viewerIndex > 0 && (
            <button
              type="button"
              className="absolute left-4 sm:left-6 top-1/2 -translate-y-1/2 text-white/70 hover:text-white bg-black/50 hover:bg-black/80 rounded-full p-3 transition-all"
              onClick={(e) => { e.stopPropagation(); setViewerIndex(viewerIndex - 1); }}
              aria-label="Previous photo"
            >
              <ChevronLeft size={28} />
            </button>
          )}

          {viewerIndex < viewerPhotos.length - 1 && (
            <button
              type="button"
              className="absolute right-4 sm:right-6 top-1/2 -translate-y-1/2 text-white/70 hover:text-white bg-black/50 hover:bg-black/80 rounded-full p-3 transition-all"
              onClick={(e) => { e.stopPropagation(); setViewerIndex(viewerIndex + 1); }}
              aria-label="Next photo"
            >
              <ChevronRight size={28} />
            </button>
          )}

          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3">
            <div className="bg-black/60 text-white text-sm font-medium px-4 py-1.5 rounded-full backdrop-blur-md">
              {viewerIndex + 1} / {viewerPhotos.length}
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                void handleDownloadPhoto(viewerPhotos[viewerIndex], `installation-photo-${viewerIndex + 1}.jpg`);
              }}
              className="inline-flex items-center gap-1.5 bg-black/60 hover:bg-black/80 text-white text-sm font-semibold px-4 py-1.5 rounded-full backdrop-blur-md transition-colors"
            >
              <Download size={14} />
              Download
            </button>
          </div>
        </div>
      </OverlayPortal>
    )}
    </>
  );
}
