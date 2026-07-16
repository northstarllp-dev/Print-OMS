"use client";

import React, { useEffect, useState } from "react";
import { ArrowLeft, Sparkles, Check, Loader2, CheckCircle, Save, UploadCloud, Calendar, Clock, Shield, FileText, Image as ImageIcon } from "lucide-react";
import { InstallationScheduleModule } from "@/features/installations/components/InstallationScheduleModule";
import { deleteStorageFilesAction } from "@/features/orders/actions/storageActions";
import { createClient } from "@/utils/supabase/client";
import type { StageModuleProps } from "../../shared/types";

export interface InstallationModuleData {
  order: any;
  customers: any[];
  installation: any;
}

export interface InstallationModuleCallbacks {
  updateInstallationDetails: (orderId: string, details: any) => Promise<any>;
  onBack: () => void;
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
  } = callbacks;
  
  const isInstallationStage = ["Installation Scheduled", "Installation In Progress", "Installation Pending", "Installation"].includes(order.stage);
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
  const siteAddress = svDetails.site_address || svDetails.siteAddress || client?.shippingAddress || "Installation Location";

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

  const uploadInstallationPhoto = async (file: File) => {
    const supabase = createClient();
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${order.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage
      .from("installation-photos")
      .upload(path, file, { upsert: false, contentType: file.type });
    if (error) throw error;
    const { data } = supabase.storage.from("installation-photos").getPublicUrl(path);
    return data.publicUrl;
  };

  const handlePhotoFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!canEdit) return;
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploadingPhotos(true);
    try {
      const uploadPromises = Array.from(files).map(file => uploadInstallationPhoto(file));
      const urls = await Promise.all(uploadPromises);
      const newUrls = [...afterPhotos, ...urls];
      setAfterPhotos(newUrls);
      await updateInstallationDetails(order.id, { afterPhotos: newUrls, photos: newUrls });
    } catch (err: any) {
      window.alert("Upload failed: " + (err?.message || "Unknown error"));
    } finally {
      setUploadingPhotos(false);
      e.target.value = "";
    }
  };

  const removeInstallationPhoto = async (urlToRemove: string) => {
    if (!canEdit) return;
    try {
      const path = urlToRemove.split("/installation-photos/").pop();
      if (path) {
        await deleteStorageFilesAction("installation-photos", [path]);
      }
      const newUrls = afterPhotos.filter(u => u !== urlToRemove);
      setAfterPhotos(newUrls);
      await updateInstallationDetails(order.id, { afterPhotos: newUrls, photos: newUrls });
    } catch (err: any) {
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
    <div className={embedded ? "space-y-6" : "p-8 bg-slate-50/50 min-h-screen"}>
      {/* ── ADMIN OVERRIDE BANNER ── */}
      {baseFrozen && currentUserRole === "Admin" && setAdminOverrideUnlocked && (
        <div className={`mb-6 p-4 rounded-xl border flex items-center justify-between transition-colors ${adminOverrideUnlocked ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200'}`}>
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${adminOverrideUnlocked ? 'bg-amber-100 text-amber-600' : 'bg-slate-200 text-slate-500'}`}>
              <Shield size={16} />
            </div>
            <div>
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

      {/* View-Only Site Visit Banner */}
      <div className="mb-6 bg-indigo-50/80 border border-indigo-100 text-indigo-700 p-4 rounded-xl text-xs font-semibold flex items-center gap-3 shadow-sm">
        <Sparkles size={16} className="text-indigo-600 flex-shrink-0" />
        You now have view-only access to the Site Visit stage. Click the 'Site Visit' tab in the timeline above to view full location photos and measurement details!
      </div>

      <div className={embedded ? "space-y-8" : "grid grid-cols-1 lg:grid-cols-3 gap-8 items-start"}>

        {/* Work column — full width when embedded */}
        <div className={embedded ? "space-y-8" : "lg:col-span-2 space-y-8"}>

          {/* SCHEDULE INSTALLATION */}
          <InstallationScheduleModule 
            orderId={order.id}
            initialScheduledDate={installationDetails.scheduledDate}
            initialScheduledTime={installationDetails.scheduledTime}
            isCompleted={!canAct}
            locationLink={gmapLink}
            locationText={siteAddress}
          />
          
          {/* CHECKLIST */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <CheckCircle size={18} className="text-green-600" />
                <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider">
                  Installation Checklist
                </h2>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

            <div className="mt-8 bg-slate-50/50 rounded-xl p-4 border border-slate-100">
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
                <div className="mt-3 flex justify-end">
                  <button 
                    onClick={handleSaveNotes}
                    disabled={saving || !canEdit}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-white text-slate-700 hover:bg-slate-50 border border-slate-200 shadow-sm rounded-lg text-xs font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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
                      <div key={index} className="group relative w-24 h-24 sm:w-32 sm:h-32 bg-slate-100 rounded-xl overflow-hidden border border-slate-200 shadow-sm">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={photo} alt="Installation Photo" className="w-full h-full object-cover" />
                        {!isCompleted && (
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <button
                              onClick={() => removeInstallationPhoto(photo)}
                              disabled={!canEdit}
                              className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg text-xs font-bold shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105 transition-transform"
                            >
                              Remove
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                
                {!isCompleted && (
                  <div className="pt-2">
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      id="installation-photos-upload"
                      className="hidden"
                      onChange={handlePhotoFiles}
                      disabled={uploadingPhotos || !canEdit}
                    />
                    <label
                      htmlFor="installation-photos-upload"
                      className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all border ${
                        uploadingPhotos || !canEdit
                          ? "bg-slate-50 text-slate-400 border-slate-200 cursor-not-allowed" 
                          : "bg-white hover:bg-slate-50 border-slate-200 text-slate-700 cursor-pointer shadow-sm"
                      }`}
                    >
                      {uploadingPhotos ? (
                        <><Loader2 size={14} className="animate-spin text-slate-400" /> Uploading...</>
                      ) : (
                        <><UploadCloud size={14} className="text-slate-500" /> Upload Photos</>
                      )}
                    </label>
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
            <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
                <Sparkles size={18} className="text-purple-600" />
                <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider">
                  Design Reference
                </h2>
              </div>
              <div className="rounded-xl overflow-hidden border border-slate-200 bg-slate-50">
                <img 
                  src={designImage} 
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

                  {client.shippingAddress && (
                    <div className="pt-2 border-t border-slate-100 mt-2">
                      <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Installation / Shipping Address</div>
                      <div className="font-medium text-slate-600 leading-relaxed p-2 bg-slate-50 rounded-lg border border-slate-100">{client.shippingAddress}</div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
