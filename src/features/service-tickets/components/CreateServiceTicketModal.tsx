"use client";

import React from "react";
import { Upload, Loader2, Search, X, Phone, FileText, Trash2, Eye, ArrowLeft } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { deleteStorageFilesAction } from "@/features/orders/actions/storageActions";
import {
  createServiceTicketAction,
  lookupOrdersByPhone,
  type TicketPhoto,
} from "@/features/service-tickets/actions/serviceTicketActions";
import { loadClientConfig } from "@/config/loadClientConfig";
import { Logo } from "@/components/ui/Logo";
import { CopyLinkButton } from "./CopyLinkButton";

interface CreateServiceTicketModalProps {
  onClose: () => void;
  onCreated: () => void;
}

type OrderOption = {
  id: string;
  orderId: string;
  label: string;
};

export function CreateServiceTicketModal({
  onClose,
  onCreated,
}: CreateServiceTicketModalProps) {
  const clientConfig = loadClientConfig();
  const [phone, setPhone] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [resolutionNotes, setResolutionNotes] = React.useState("");
  const [orders, setOrders] = React.useState<OrderOption[]>([]);
  const [selectedOrderId, setSelectedOrderId] = React.useState("");
  const [selectedCustomerId, setSelectedCustomerId] = React.useState("");
  const [photos, setPhotos] = React.useState<TicketPhoto[]>([]);
  const [lookupLoading, setLookupLoading] = React.useState(false);
  const [saveLoading, setSaveLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const canSubmit =
    selectedCustomerId &&
    selectedOrderId &&
    phone.trim() &&
    description.trim() &&
    !saveLoading;

  const getFormattedPhone = (p: string) => {
    let clean = p.replace(/\s+/g, "");
    if (clean.startsWith('+91')) return clean;
    if (clean.startsWith('91') && clean.length === 12) return '+' + clean;
    if (clean.startsWith('0') && clean.length === 11) return '+91' + clean.substring(1);
    return '+91' + clean;
  };

  async function handleLookup() {
    if (!phone.trim()) {
      setError("Please enter a phone number first.");
      return;
    }
    setLookupLoading(true);
    setError(null);
    try {
      const formattedPhone = getFormattedPhone(phone);
      const result = await lookupOrdersByPhone(formattedPhone);
      setSelectedCustomerId(result.customer?.id ?? "");
      setOrders(result.orders ?? []);
      setSelectedOrderId("");
      if (!result.customer || result.orders.length === 0) {
        setError("No customer orders found for this mobile number.");
      }
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Unable to fetch orders"));
    } finally {
      setLookupLoading(false);
    }
  }

  async function uploadFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);
    const supabase = createClient();
    
    // Concurrent uploads for better performance
    try {
      const uploadPromises = Array.from(files).map(async (file) => {
        const ext = file.name.split(".").pop() || "jpg";
        const path = `support/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("service-ticket-photos")
          .upload(path, file, { contentType: file.type, upsert: false });
          
        if (uploadError) throw new Error(uploadError.message);
        
        const { data } = supabase.storage.from("service-ticket-photos").getPublicUrl(path);
        return {
          url: data.publicUrl,
          name: file.name,
          uploadedBy: "Admin",
          createdAt: new Date().toISOString(),
        };
      });
      
      const uploadedPhotos = await Promise.all(uploadPromises);
      setPhotos((prev) => [...prev, ...uploadedPhotos]);
    } catch (err: unknown) {
       setError(getErrorMessage(err, "Photo upload failed"));
    }
  }

  async function removePhoto(index: number) {
    const photo = photos[index];
    try {
      const path = photo.url.split("/service-ticket-photos/").pop();
      if (path) {
        await deleteStorageFilesAction("service-ticket-photos", [path]);
      }
    } catch {
      // best-effort cleanup — continue removing from local state
    }
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleCreate() {
    if (!canSubmit) return;
    setSaveLoading(true);
    setError(null);
    try {
      await createServiceTicketAction({
        customerId: selectedCustomerId,
        orderId: selectedOrderId,
        phone: getFormattedPhone(phone),
        description,
        photos,
        resolutionNotes: resolutionNotes || undefined,
      });
      onCreated();
      onClose();
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Failed to create ticket"));
    } finally {
      setSaveLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-stretch sm:items-center justify-center bg-[rgba(12,15,26,0.6)] p-0 sm:p-4 md:p-6"
      onClick={onClose}
    >
      <div
        className="prt-card prt-animate-in flex flex-col w-full h-full sm:h-auto sm:max-h-[92vh] sm:max-w-[760px] rounded-none sm:rounded-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        style={{ padding: 0 }}
      >
        <div className="flex items-start justify-between gap-3 px-4 pt-4 pb-3 sm:px-6 sm:pt-6 sm:pb-4 border-b border-slate-100 shrink-0">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-2 sm:mb-3">
              <button
                type="button"
                onClick={onClose}
                className="sm:hidden inline-flex items-center gap-1.5 shrink-0 rounded-lg px-2.5 py-1.5 bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200 transition-colors"
                aria-label="Back"
              >
                <ArrowLeft size={14} />
                Back
              </button>
              <Logo height={28} width={120} align="left" className="sm:hidden" />
              <Logo height={32} width={140} align="left" className="hidden sm:block" />
            </div>
            <h2 className="text-display-sm m-0 text-[var(--color-primary)] text-lg sm:text-xl">
              Create Service Ticket
            </h2>
            <p className="text-body-md m-0 mt-1 text-[var(--color-on-surface-variant)] text-xs sm:text-sm">
              Follow the steps below to record a new customer issue.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <CopyLinkButton companyId={clientConfig?.id || "default"} />
            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700 transition-colors"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
        {error && (
          <div
            className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-3 sm:px-4 text-sm text-[var(--color-error)]"
          >
            {error}
          </div>
        )}

        <div className="mb-5 sm:mb-6">
          <label className="text-label-caps block mb-2 text-[var(--color-on-surface-variant)]">
            1. Customer Identity
          </label>
          <div className="flex flex-col sm:flex-row gap-2.5 sm:gap-3">
            <div className="relative flex-1 flex items-center min-w-0">
              <div className="absolute left-3 sm:left-4 flex items-center gap-1.5 text-[var(--color-on-surface-variant)] pointer-events-none">
                <Phone size={16} className="sm:w-[18px] sm:h-[18px]" />
                <span className="text-sm font-medium">+91</span>
              </div>
              <input
                className="prt-input w-full !pl-[4.5rem] sm:!pl-[4.75rem]"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                placeholder="Mobile number"
                disabled={orders.length > 0}
              />
            </div>
            {orders.length === 0 ? (
              <button
                type="button"
                onClick={handleLookup}
                disabled={lookupLoading || phone.length < 10}
                className="prt-btn prt-btn-primary w-full sm:w-auto justify-center"
              >
                {lookupLoading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                {lookupLoading ? "Searching..." : "Find Orders"}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => { setOrders([]); setSelectedOrderId(""); setSelectedCustomerId(""); }}
                className="prt-btn prt-btn-secondary w-full sm:w-auto justify-center"
              >
                Change Number
              </button>
            )}
          </div>
        </div>

        {orders.length > 0 && (
          <div className="prt-animate-in">
            <div className="p-4 sm:p-6 mb-4 sm:mb-6 rounded-[var(--radius-lg)] border border-[var(--color-outline-variant)] bg-[var(--color-surface-container-lowest)]">
               <h3 className="text-title-sm mb-4 sm:mb-5 text-[var(--color-on-surface)] flex items-center gap-2">
                 <FileText size={18} className="text-blue-600 shrink-0" /> 2. Ticket Details
               </h3>
               
               <div className="mb-4 sm:mb-5">
                 <label className="text-label-caps block mb-2 text-[var(--color-on-surface-variant)]">Select Related Order</label>
                 <select
                   className="prt-input w-full"
                   value={selectedOrderId}
                   onChange={(e) => setSelectedOrderId(e.target.value)}
                 >
                   <option value="">Select an order...</option>
                   {orders.map((order) => (
                     <option key={order.id} value={order.id}>
                       {order.label}
                     </option>
                   ))}
                 </select>
               </div>

               <div className="mb-4 sm:mb-5">
                 <label className="text-label-caps block mb-2 text-[var(--color-on-surface-variant)]">Issue Description</label>
                 <textarea
                   className="prt-input w-full resize-y"
                   value={description}
                   onChange={(e) => setDescription(e.target.value)}
                   placeholder="Describe what is wrong or needs service..."
                   rows={4}
                 />
               </div>

               <div>
                 <label className="text-label-caps block mb-2 text-[var(--color-on-surface-variant)]">Initial Resolution (Optional)</label>
                 <textarea
                   className="prt-input w-full resize-y"
                   value={resolutionNotes}
                   onChange={(e) => setResolutionNotes(e.target.value)}
                   placeholder="Any initial steps taken or planned resolution..."
                   rows={3}
                 />
               </div>
            </div>

            <div className="p-4 sm:p-6 mb-5 sm:mb-8 rounded-[var(--radius-lg)] border border-[var(--color-outline-variant)] bg-[var(--color-surface-container-lowest)]">
               <h3 className="text-title-sm mb-4 sm:mb-5 text-[var(--color-on-surface)] flex items-center gap-2">
                 <Upload size={18} className="text-emerald-600 shrink-0" /> 3. Problem Photos
               </h3>
               
               <label
                  className="flex flex-col items-center justify-center gap-3 border-2 border-dashed border-[var(--color-outline-variant)] rounded-[var(--radius-lg)] px-4 py-6 sm:py-8 cursor-pointer bg-[var(--color-surface-container-low)] hover:border-[var(--color-primary)] hover:bg-[var(--color-surface-container-lowest)] transition-all"
                >
                  <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600">
                    <Upload size={24} />
                  </div>
                  <div className="text-center">
                    <p className="text-title-sm m-0 mb-1 text-[var(--color-on-surface)]">Click to upload images</p>
                    <p className="text-body-md m-0 text-[var(--color-on-surface-variant)] text-xs sm:text-sm">Upload photos showing the issue</p>
                  </div>
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const target = e.target;
                      await uploadFiles(target.files);
                      target.value = "";
                    }}
                  />
                </label>

                {photos.length > 0 && (
                  <div className="flex flex-wrap gap-3 mt-4 sm:mt-5">
                    {photos.map((photo, i) => (
                       <div
                         key={i}
                         className="group relative w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden border border-[var(--color-outline-variant)] shadow-sm"
                       >
                         <img src={photo.url} alt={`Preview ${i}`} className="w-full h-full object-cover" />
                         <div
                           className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 absolute inset-0 bg-slate-900/70 flex items-center justify-center gap-1.5 transition-opacity"
                         >
                           <a
                             href={photo.url}
                             target="_blank"
                             rel="noreferrer"
                             onClick={(e) => e.stopPropagation()}
                             className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center text-white hover:bg-white/40"
                             title="View"
                           >
                             <Eye size={14} />
                           </a>
                           <button
                             type="button"
                             onClick={(e) => { e.stopPropagation(); void removePhoto(i); }}
                             className="w-7 h-7 rounded-full bg-red-500/80 flex items-center justify-center text-white hover:bg-red-500"
                             title="Remove"
                           >
                             <Trash2 size={14} />
                           </button>
                         </div>
                       </div>
                    ))}
                  </div>
                )}
            </div>

            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5 sm:gap-3 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
              <button
                type="button"
                onClick={onClose}
                className="prt-btn prt-btn-secondary w-full sm:w-auto justify-center"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreate}
                disabled={!canSubmit}
                className="prt-btn prt-btn-primary w-full sm:w-auto justify-center"
                style={{
                  opacity: canSubmit ? 1 : 0.6,
                  cursor: canSubmit ? "pointer" : "not-allowed",
                }}
              >
                {saveLoading ? (
                  <>
                    <Loader2 size={18} className="animate-spin" /> Creating...
                  </>
                ) : (
                  "Create Service Ticket"
                )}
              </button>
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

