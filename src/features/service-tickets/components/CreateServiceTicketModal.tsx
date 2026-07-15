"use client";

import React from "react";
import { Upload, Loader2, Search, X, Phone, FileText, Trash2, Eye } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { deleteStorageFilesAction } from "@/features/orders/actions/storageActions";
import {
  createServiceTicketAction,
  lookupOrdersByPhone,
  type TicketPhoto,
} from "@/features/service-tickets/actions/serviceTicketActions";
import { loadClientConfig } from "@/config/loadClientConfig";
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
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(12, 15, 26, 0.6)",
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
      }}
      onClick={onClose}
    >
      <div
        className="prt-card prt-animate-in"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: "760px",
          padding: "32px",
          maxHeight: "90vh",
          overflowY: "auto",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "32px" }}>
          <div>
            {clientConfig?.logoUrl && (
              <img src={clientConfig.logoUrl} alt="Logo" style={{ height: "32px", objectFit: "contain", marginBottom: "12px" }} />
            )}
            <h2 className="text-display-sm" style={{ margin: 0, color: "var(--color-primary)" }}>
              Create Service Ticket
            </h2>
            <p className="text-body-md" style={{ margin: "4px 0 0", color: "var(--color-on-surface-variant)" }}>
              Follow the steps below to record a new customer issue.
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <CopyLinkButton companyId={clientConfig?.id || "default"} />
            <button 
              onClick={onClose} 
            style={{ 
              border: "none", 
              background: "var(--color-surface-container-lowest)", 
              borderRadius: "50%",
              width: "36px",
              height: "36px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer", 
              color: "var(--color-on-surface-variant)",
              transition: "background 0.2s"
            }}
            onMouseOver={(e) => { e.currentTarget.style.background = "var(--color-surface-container-low)" }}
            onMouseOut={(e) => { e.currentTarget.style.background = "var(--color-surface-container-lowest)" }}
          >
            <X size={20} />
          </button>
          </div>
        </div>

        {error && (
          <div
            style={{
              padding: "16px",
              borderRadius: "var(--radius-lg)",
              background: "#fef2f2",
              color: "var(--color-error)",
              border: "1px solid #fecaca",
              marginBottom: "24px",
              fontSize: "14px",
            }}
          >
            {error}
          </div>
        )}

        <div style={{ marginBottom: "24px" }}>
          <label className="text-label-caps" style={{ display: "block", marginBottom: "8px", color: "var(--color-on-surface-variant)" }}>1. Customer Identity</label>
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
            <div style={{ position: "relative", flex: 1, display: "flex", alignItems: "center", minWidth: "200px" }}>
              <div style={{ 
                position: "absolute", 
                left: "16px", 
                display: "flex", 
                alignItems: "center", 
                gap: "6px",
                color: "var(--color-on-surface-variant)",
                pointerEvents: "none"
              }}>
                <Phone size={18} />
                <span style={{ fontSize: "14px", fontWeight: 500 }}>+91</span>
              </div>
              <input
                className="prt-input"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                placeholder="Mobile number"
                disabled={orders.length > 0}
                style={{ width: "100%", paddingLeft: "72px" }}
              />
            </div>
            {orders.length === 0 ? (
              <button
                onClick={handleLookup}
                disabled={lookupLoading || phone.length < 10}
                className="prt-btn prt-btn-primary"
              >
                {lookupLoading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                {lookupLoading ? "Searching..." : "Find Orders"}
              </button>
            ) : (
              <button
                onClick={() => { setOrders([]); setSelectedOrderId(""); setSelectedCustomerId(""); }}
                className="prt-btn prt-btn-secondary"
              >
                Change Number
              </button>
            )}
          </div>
        </div>

        {orders.length > 0 && (
          <div className="prt-animate-in">
            <div style={{ padding: "24px", background: "var(--color-surface-container-lowest)", borderRadius: "var(--radius-lg)", border: "1px solid var(--color-outline-variant)", marginBottom: "24px" }}>
               <h3 className="text-title-sm" style={{ marginBottom: "20px", color: "var(--color-on-surface)", display: "flex", alignItems: "center", gap: "8px" }}>
                 <FileText size={18} className="text-blue-600" /> 2. Ticket Details
               </h3>
               
               <div style={{ marginBottom: "20px" }}>
                 <label className="text-label-caps" style={{ display: "block", marginBottom: "8px", color: "var(--color-on-surface-variant)" }}>Select Related Order</label>
                 <select
                   className="prt-input"
                   value={selectedOrderId}
                   onChange={(e) => setSelectedOrderId(e.target.value)}
                   style={{ width: "100%" }}
                 >
                   <option value="">Select an order...</option>
                   {orders.map((order) => (
                     <option key={order.id} value={order.id}>
                       {order.label}
                     </option>
                   ))}
                 </select>
               </div>

               <div style={{ marginBottom: "20px" }}>
                 <label className="text-label-caps" style={{ display: "block", marginBottom: "8px", color: "var(--color-on-surface-variant)" }}>Issue Description</label>
                 <textarea
                   className="prt-input"
                   value={description}
                   onChange={(e) => setDescription(e.target.value)}
                   placeholder="Describe what is wrong or needs service..."
                   rows={4}
                   style={{ width: "100%", resize: "vertical" }}
                 />
               </div>

               <div>
                 <label className="text-label-caps" style={{ display: "block", marginBottom: "8px", color: "var(--color-on-surface-variant)" }}>Initial Resolution (Optional)</label>
                 <textarea
                   className="prt-input"
                   value={resolutionNotes}
                   onChange={(e) => setResolutionNotes(e.target.value)}
                   placeholder="Any initial steps taken or planned resolution..."
                   rows={3}
                   style={{ width: "100%", resize: "vertical" }}
                 />
               </div>
            </div>

            <div style={{ padding: "24px", background: "var(--color-surface-container-lowest)", borderRadius: "var(--radius-lg)", border: "1px solid var(--color-outline-variant)", marginBottom: "32px" }}>
               <h3 className="text-title-sm" style={{ marginBottom: "20px", color: "var(--color-on-surface)", display: "flex", alignItems: "center", gap: "8px" }}>
                 <Upload size={18} className="text-emerald-600" /> 3. Problem Photos
               </h3>
               
               <label
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "12px",
                    border: "2px dashed var(--color-outline-variant)",
                    borderRadius: "var(--radius-lg)",
                    padding: "32px 16px",
                    cursor: "pointer",
                    background: "var(--color-surface-container-low)",
                    transition: "all 0.2s"
                  }}
                  onMouseOver={(e) => { e.currentTarget.style.borderColor = "var(--color-primary)"; e.currentTarget.style.background = "var(--color-surface-container-lowest)"; }}
                  onMouseOut={(e) => { e.currentTarget.style.borderColor = "var(--color-outline-variant)"; e.currentTarget.style.background = "var(--color-surface-container-low)"; }}
                >
                  <div style={{ width: "48px", height: "48px", borderRadius: "50%", background: "#e0e7ff", display: "flex", alignItems: "center", justifyContent: "center", color: "#4f46e5" }}>
                    <Upload size={24} />
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <p className="text-title-sm" style={{ margin: "0 0 4px", color: "var(--color-on-surface)" }}>Click to upload images</p>
                    <p className="text-body-md" style={{ margin: 0, color: "var(--color-on-surface-variant)" }}>Upload photos showing the issue</p>
                  </div>
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    style={{ display: "none" }}
                    onChange={async (e) => {
                      const target = e.target;
                      await uploadFiles(target.files);
                      target.value = "";
                    }}
                  />
                </label>

                {photos.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", marginTop: "20px" }}>
                    {photos.map((photo, i) => (
                       <div
                         key={i}
                         className="group"
                         style={{
                           position: "relative",
                           width: "96px",
                           height: "96px",
                           borderRadius: "12px",
                           overflow: "hidden",
                           border: "1px solid var(--color-outline-variant)",
                           boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                         }}
                       >
                         <img src={photo.url} alt={`Preview ${i}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                         <div
                           className="opacity-0 group-hover:opacity-100"
                           style={{
                             position: "absolute",
                             inset: 0,
                             background: "rgba(15,23,42,0.7)",
                             display: "flex",
                             alignItems: "center",
                             justifyContent: "center",
                             gap: "6px",
                             transition: "opacity 0.2s",
                           }}
                         >
                           <a
                             href={photo.url}
                             target="_blank"
                             rel="noreferrer"
                             onClick={(e) => e.stopPropagation()}
                             style={{
                               width: "28px",
                               height: "28px",
                               borderRadius: "50%",
                               background: "rgba(255,255,255,0.2)",
                               display: "flex",
                               alignItems: "center",
                               justifyContent: "center",
                               color: "#fff",
                               border: "none",
                               cursor: "pointer",
                               transition: "background 0.15s",
                             }}
                             onMouseOver={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.4)"; }}
                             onMouseOut={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.2)"; }}
                             title="View"
                           >
                             <Eye size={14} />
                           </a>
                           <button
                             type="button"
                             onClick={(e) => { e.stopPropagation(); void removePhoto(i); }}
                             style={{
                               width: "28px",
                               height: "28px",
                               borderRadius: "50%",
                               background: "rgba(239,68,68,0.8)",
                               display: "flex",
                               alignItems: "center",
                               justifyContent: "center",
                               color: "#fff",
                               border: "none",
                               cursor: "pointer",
                               transition: "background 0.15s",
                             }}
                             onMouseOver={(e) => { e.currentTarget.style.background = "rgba(239,68,68,1)"; }}
                             onMouseOut={(e) => { e.currentTarget.style.background = "rgba(239,68,68,0.8)"; }}
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

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px" }}>
              <button
                onClick={onClose}
                className="prt-btn prt-btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={!canSubmit}
                className="prt-btn prt-btn-primary"
                style={{
                  opacity: canSubmit ? 1 : 0.6,
                  cursor: canSubmit ? "pointer" : "not-allowed",
                  padding: "12px 24px"
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
  );
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

