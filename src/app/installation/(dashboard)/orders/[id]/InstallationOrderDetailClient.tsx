"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, MapPin, Sparkles, Check, Loader2, CheckCircle, Save, UploadCloud, Calendar, Clock } from "lucide-react";
import { updateInstallationDetails, markInstallationCompleted, requestInstallationLocationAction, scheduleInstallationAction } from "@/features/installations/actions/installationActions";
import { InstallationScheduleModule } from "@/features/installations/components/InstallationScheduleModule";
import { createClient } from "@/utils/supabase/client";

interface InstallationOrderDetailClientProps {
  order: any;
  customers: any[];
  installation: any;
}

export function InstallationOrderDetailClient({
  order,
  customers,
  installation,
}: InstallationOrderDetailClientProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [alert, setAlert] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const client = customers.find(c => c.id === order.customerId);
  const svDetails = order.siteVisitDetails || {};
  const locations = svDetails.locations || [];
  
  const dd = order.design || { proofUrl: "", status: "Draft" };
  const designImage = order.imageMockup || dd.proofUrl;
  
  const installationDetails = installation || {};
  const gmapLink = installationDetails.gmapLink;
  const gmapRequested = installationDetails.gmapRequested;

  // Parse initial checklist from installation data
  const initialChecklist = Array.isArray(installation?.checklist) 
    ? installation.checklist 
    : [
        { id: "prep", label: "Site preparation completed", checked: false },
        { id: "mount", label: "Signage mounted securely", checked: false },
        { id: "elec", label: "Electricals/Wiring tested (if applicable)", checked: false },
        { id: "clean", label: "Site cleaned up", checked: false }
      ];
      
  const [checklist, setChecklist] = useState(initialChecklist);
  const [notes, setNotes] = useState(installation?.notes || "");
  const [afterPhotos, setAfterPhotos] = useState<string[]>(installation?.photos || []);

  const handleToggleCheck = async (stepId: string) => {
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
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploadingPhotos(true);
    try {
      const uploadPromises = Array.from(files).map(file => uploadInstallationPhoto(file));
      const urls = await Promise.all(uploadPromises);
      const newUrls = [...afterPhotos, ...urls];
      setAfterPhotos(newUrls);
      await updateInstallationDetails(order.id, { afterPhotos: newUrls });
    } catch (err: any) {
      window.alert("Upload failed: " + (err?.message || "Unknown error"));
    } finally {
      setUploadingPhotos(false);
      e.target.value = "";
    }
  };

  const removeInstallationPhoto = async (urlToRemove: string) => {
    const supabase = createClient();
    const path = urlToRemove.split("/installation-photos/").pop();
    if (path) await supabase.storage.from("installation-photos").remove([path]);
    const newUrls = afterPhotos.filter(u => u !== urlToRemove);
    setAfterPhotos(newUrls);
    await updateInstallationDetails(order.id, { afterPhotos: newUrls });
  };

  const handleSaveNotes = async () => {
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

  const handleMarkCompleted = async () => {
    if (!window.confirm("Are you sure you want to mark this installation as COMPLETED? This will update the main order status.")) return;
    
    setSaving(true);
    try {
      await markInstallationCompleted(order.id, checklist, afterPhotos, notes);
      setAlert({ message: "Installation successfully marked as completed!", type: "success" });
      setTimeout(() => {
        router.push("/installation/orders");
      }, 2000);
    } catch (err: any) {
      setAlert({ message: err.message, type: "error" });
      setSaving(false);
    }
  };

  // Note: Handle location request functions remain unchanged

  const handleRequestLocation = async () => {
    setSaving(true);
    try {
      await requestInstallationLocationAction(order.id);
      setAlert({ message: "Requested exact location from customer.", type: "success" });
    } catch (err: any) {
      setAlert({ message: err.message, type: "error" });
    } finally {
      setSaving(false);
      setTimeout(() => setAlert(null), 3000);
    }
  };

  const isCompleted = order.stage === "Completed" || order.stage === "Closed";

  return (
    <div className="p-8 bg-slate-50/50 min-h-screen">
      {/* Top Navigation */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => router.push("/installation/orders")}
          className="inline-flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-slate-600 text-xs font-bold shadow-xs hover:bg-slate-50 transition-colors"
        >
          <ArrowLeft size={14} /> Back to Queue
        </button>
        <span className="text-slate-300">/</span>
        <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">{order.orderCode}</span>
      </div>

      {/* Title block */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              {order.projectName}
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        
        {/* LEFT COLUMN */}
        <div className="lg:col-span-2 space-y-8">

          {/* SCHEDULE INSTALLATION */}
          <InstallationScheduleModule 
            orderId={order.id}
            initialScheduledDate={installationDetails.scheduledDate}
            initialScheduledTime={installationDetails.scheduledTime}
            isCompleted={isCompleted}
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
                  onClick={() => !isCompleted && handleToggleCheck(step.id)}
                  className={`p-4 border rounded-xl flex items-center gap-3 transition-all duration-200 ${
                    isCompleted ? "opacity-70 cursor-not-allowed" : "cursor-pointer select-none"
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

            <div className="mt-6">
              <label className="block text-xs font-bold text-slate-700 mb-2">Installation Notes / Remarks</label>
              <textarea 
                value={notes}
                onChange={e => setNotes(e.target.value)}
                disabled={isCompleted}
                placeholder="Add any notes about the installation (e.g. issues encountered, specific details...)"
                className="w-full min-h-[100px] bg-slate-50 text-slate-800 text-sm p-3 border border-slate-200 rounded-xl focus:outline-none focus:border-green-500 focus:bg-white transition-all resize-y"
              />
              {!isCompleted && (
                <div className="mt-2 flex justify-end">
                  <button 
                    onClick={handleSaveNotes}
                    disabled={saving}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200 rounded-lg text-xs font-bold transition-all"
                  >
                    <Save size={14} /> Save Notes
                  </button>
                </div>
              )}
            </div>

            <div className="mt-6 pt-6 border-t border-slate-100">
              <label className="block text-xs font-bold text-slate-700 mb-2">After-Installation Photos</label>
              <div className="space-y-4">
                {afterPhotos.length > 0 && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {afterPhotos.map((photo, index) => (
                      <div key={index} className="group relative aspect-square bg-slate-100 rounded-xl overflow-hidden border border-slate-200">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={photo} alt="Installation Photo" className="w-full h-full object-cover" />
                        {!isCompleted && (
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <button
                              onClick={() => removeInstallationPhoto(photo)}
                              className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg text-xs font-bold shadow-sm"
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
                  <div>
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      id="installation-photos-upload"
                      className="hidden"
                      onChange={handlePhotoFiles}
                      disabled={uploadingPhotos}
                    />
                    <label
                      htmlFor="installation-photos-upload"
                      className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                        uploadingPhotos 
                          ? "bg-slate-100 text-slate-400 cursor-not-allowed" 
                          : "bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
                      }`}
                    >
                      {uploadingPhotos ? (
                        <><Loader2 size={14} className="animate-spin" /> Uploading...</>
                      ) : (
                        <><UploadCloud size={14} /> Upload Photos</>
                      )}
                    </label>
                  </div>
                )}
              </div>
            </div>
            
            {!isCompleted && (
              <div className="mt-8 pt-6 border-t border-slate-100 flex justify-end">
                <button
                  onClick={handleMarkCompleted}
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white border border-green-700 rounded-xl text-sm font-bold shadow-sm transition-all"
                >
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
                  Mark Installation as Completed
                </button>
              </div>
            )}
          </div>
          
          {/* SITE VISIT DETAILS */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <MapPin size={18} className="text-indigo-600" />
                <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider">
                  Site Location & Dimensions
                </h2>
              </div>
              
              {/* Google Map Link actions */}
              <div className="flex items-center gap-2">
                {gmapLink ? (
                  <a href={gmapLink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold transition-colors">
                    <MapPin size={14} /> Open Exact Location
                  </a>
                ) : gmapRequested ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-700 rounded-lg text-xs font-bold">
                    Location Requested...
                  </span>
                ) : (
                  <button onClick={handleRequestLocation} disabled={saving} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors">
                    Request Exact Map Link
                  </button>
                )}
              </div>
            </div>

            {svDetails.skipped ? (
              <div className="py-6 px-4 bg-amber-50 border border-amber-200 rounded-xl">
                <div className="flex items-center gap-3">
                  <span className="text-amber-600 font-bold">⚠️ Site Visit Was Skipped</span>
                </div>
                <div className="mt-2 text-xs text-amber-800 font-medium leading-relaxed">
                  {svDetails.reason ? `Reason: ${svDetails.reason}` : "The customer opted out of the site visit."}
                </div>
                <div className="mt-4 pt-4 border-t border-amber-200/50">
                  <div className="text-[10px] text-amber-700/80 font-bold uppercase tracking-wider mb-1">Target Installation Address (from client)</div>
                  <div className="font-semibold text-amber-900">{client?.shippingAddress || "No address provided."}</div>
                  <div className="text-[10px] text-amber-700/80 font-bold uppercase tracking-wider mt-3 mb-1">Default Dimensions</div>
                  <div className="font-semibold text-amber-900">{order.dimensions || "TBD"}</div>
                </div>
              </div>
            ) : locations.length > 0 ? (
              <div className="space-y-4">
                {svDetails.siteAddress && (
                  <div className="mb-4">
                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Surveyed Address</div>
                    <div className="font-bold text-slate-800 bg-slate-50 p-3 rounded-xl border border-slate-100">{svDetails.siteAddress}</div>
                  </div>
                )}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider">
                        <th className="py-2.5 px-4">Location / Name</th>
                        <th className="py-2.5 px-4">Width</th>
                        <th className="py-2.5 px-4">Height</th>
                        <th className="py-2.5 px-4">Depth</th>
                        <th className="py-2.5 px-4">Photos</th>
                        <th className="py-2.5 px-4">Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {locations.map((loc: any, idx: number) => (
                        <tr key={loc.id || idx}>
                          <td className="py-3 px-4 font-bold text-slate-800">{loc.name}</td>
                          <td className="py-3 px-4 font-medium text-slate-600">{loc.width || "—"}</td>
                          <td className="py-3 px-4 font-medium text-slate-600">{loc.height || "—"}</td>
                          <td className="py-3 px-4 font-medium text-slate-600">{loc.depth || "—"}</td>
                          <td className="py-3 px-4 font-medium text-slate-600">
                            {loc.photos && loc.photos.length > 0 ? (
                              <div className="flex gap-1 overflow-x-auto max-w-[150px]">
                                {loc.photos.map((p: string, pIdx: number) => (
                                  <a key={pIdx} href={p} target="_blank" rel="noreferrer" className="w-8 h-8 rounded border bg-slate-100 flex-shrink-0 overflow-hidden">
                                    <img src={p} alt="Site" className="w-full h-full object-cover" />
                                  </a>
                                ))}
                              </div>
                            ) : "—"}
                          </td>
                          <td className="py-3 px-4 font-medium text-slate-600">{loc.notes || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="py-6 text-center text-xs text-slate-400 font-semibold">
                No site visit locations or measurements specified. Default dimensions: {order.dimensions || "TBD"}
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

        {/* RIGHT COLUMN */}
        <div className="space-y-6 lg:sticky lg:top-24 transition-all duration-300">
          {/* CUSTOMER DETAIL CARD */}
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

      </div>
    </div>
  );
}
