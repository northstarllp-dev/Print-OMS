"use client";

import React, { useEffect } from "react";
import { Loader2, Upload, CheckCircle2, AlertCircle, Calendar, Tag, Activity, Phone, FileText, X } from "lucide-react";

import { Logo } from "@/components/ui/Logo";
import { withBasePath } from "@/lib/appBasePath";

type LookupOrder = {
  id: string;
  orderId: string;
  label: string;
  stage?: string;
  productType?: string;
  dateCreated?: string;
};

function isTechnicalError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("uuid") ||
    lower.includes("syntax") ||
    lower.includes("invalid input") ||
    lower.includes("postgres") ||
    lower.includes("pgrst")
  );
}

export default function ServiceTicketPublicClient() {
  const [phone, setPhone] = React.useState("");
  const [orders, setOrders] = React.useState<LookupOrder[]>([]);
  const [customerId, setCustomerId] = React.useState("");
  const [orderId, setOrderId] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [files, setFiles] = React.useState<File[]>([]);
  const [loadingLookup, setLoadingLookup] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [createdTicketId, setCreatedTicketId] = React.useState<string | null>(null);
  
  // Create object URLs for previews
  const [previewUrls, setPreviewUrls] = React.useState<string[]>([]);

  useEffect(() => {
    // Revoke old object URLs to avoid memory leaks
    previewUrls.forEach(url => URL.revokeObjectURL(url));
    // Create new object URLs for current files
    const newUrls = files.map(file => URL.createObjectURL(file));
    setPreviewUrls(newUrls);
    
    // Cleanup on unmount
    return () => {
      newUrls.forEach(url => URL.revokeObjectURL(url));
    };
  }, [files]);

  const removeFile = (indexToRemove: number) => {
    setFiles(files.filter((_, index) => index !== indexToRemove));
  };

  const getFormattedPhone = () => {
    let p = phone.replace(/\s+/g, "");
    if (p.startsWith('+91')) return p;
    if (p.startsWith('91') && p.length === 12) return '+' + p;
    if (p.startsWith('0') && p.length === 11) return '+91' + p.substring(1);
    return '+91' + p;
  };

  async function handleLookup(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!phone.trim()) return;
    setLoadingLookup(true);
    setError(null);
    try {
      const res = await fetch(withBasePath("/api/public/service-ticket/lookup"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: getFormattedPhone() }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof payload.error === "string" && !isTechnicalError(payload.error)
            ? payload.error
            : "Unable to look up orders. Please try again."
        );
      }
      setCustomerId(payload.customer?.id || "");
      setOrders(payload.orders || []);
      setOrderId("");
      if (!payload.customer || (payload.orders || []).length === 0) {
        setError("No orders found with this number.");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "";
      setError(
        msg && !isTechnicalError(msg)
          ? msg
          : "Unable to look up orders. Please try again."
      );
    } finally {
      setLoadingLookup(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!customerId || !orderId || !description.trim() || !phone.trim()) {
      setError("Please complete all required fields.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.set("customerId", customerId);
      formData.set("orderId", orderId);
      formData.set("phone", getFormattedPhone());
      formData.set("description", description);
      files.forEach((file) => formData.append("photos", file));

      const res = await fetch(withBasePath("/api/public/service-ticket"), {
        method: "POST",
        body: formData,
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || "Unable to submit ticket");

      setCreatedTicketId(payload.ticketId || "Created");
      setDescription("");
      setFiles([]);
      setOrderId("");
      setOrders([]);
      setCustomerId("");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "";
      setError(
        msg && !isTechnicalError(msg)
          ? msg
          : "Unable to submit ticket. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFiles = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
      setFiles(prev => [...prev, ...droppedFiles]);
    }
  };

  return (
    <div className="prt-page" style={{ 
      minHeight: "100vh", 
      background: "var(--color-background)",
      display: "flex",
      alignItems: "flex-start",
      justifyContent: "center"
    }}>
      <div className="prt-card prt-animate-in" style={{
        width: "100%",
        maxWidth: "640px",
        padding: "40px",
        marginTop: "24px"
      }}>
        <div style={{ textAlign: "center", marginBottom: "32px", display: "flex", flexDirection: "column", alignItems: "center" }}>
          <Logo height={48} className="mb-6" />
          <h1 className="text-display-lg" style={{ margin: "0 0 12px", color: "var(--color-primary)" }}>
            Service Support
          </h1>
          <p className="text-body-md" style={{ margin: 0, color: "var(--color-on-surface-variant)" }}>
            Need help with an order? Enter your mobile number below to retrieve your orders and submit a ticket.
          </p>
        </div>

        {createdTicketId ? (
          <div>
            <div style={{ background: "var(--color-success-container)", color: "var(--color-success)", border: "1px solid var(--color-success)", borderRadius: "var(--radius-lg)", padding: "16px", marginBottom: "24px", display: "flex", alignItems: "center", gap: "12px" }}>
              <CheckCircle2 size={24} />
              <div>
                <h3 className="text-title-sm" style={{ margin: "0 0 4px" }}>Ticket Submitted</h3>
                <p className="text-body-md" style={{ margin: 0 }}>Your reference number is <strong>{createdTicketId}</strong>. We'll be in touch soon.</p>
              </div>
            </div>
            <button
               type="button"
               className="prt-btn prt-btn-primary"
               onClick={() => { setCreatedTicketId(""); setPhone(""); }}
            >
               Submit Another Ticket
            </button>
          </div>
        ) : (
          <>
            {error && (
              <div style={{
                background: error.toLowerCase().includes("no orders") ? "#fffbeb" : "#fef2f2",
                color: error.toLowerCase().includes("no orders") ? "#b45309" : "var(--color-error)",
                border: `1px solid ${error.toLowerCase().includes("no orders") ? "#fde68a" : "#fecaca"}`,
                borderRadius: "var(--radius-lg)",
                padding: "16px",
                marginBottom: "24px",
                display: "flex",
                alignItems: "center",
                gap: "12px",
              }}>
                <AlertCircle size={24} />
                <div>
                  <h3 className="text-title-sm" style={{ margin: 0 }}>{error}</h3>
                </div>
              </div>
            )}

            <form onSubmit={orders.length === 0 ? handleLookup : handleSubmit}>
              <div style={{ marginBottom: "24px" }}>
            <label className="text-label-caps" style={{ display: "block", marginBottom: "8px", color: "var(--color-on-surface-variant)" }}>Mobile Number</label>
            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
              <div style={{ position: "relative", flex: "1 1 200px", display: "flex", alignItems: "center" }}>
                <div style={{ 
                  position: "absolute", 
                  left: "12px", 
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
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="98765 43210"
                  style={{ paddingLeft: "76px" }}
                />
              </div>
              <button
                type="button"
                className={`prt-btn ${phone.trim() ? 'prt-btn-primary' : 'prt-btn-secondary'}`}
                onClick={handleLookup}
                disabled={loadingLookup || !phone.trim()}
                style={{ 
                  height: "42px",
                  justifyContent: "center",
                  minWidth: "140px",
                  flex: "0 0 auto",
                  opacity: (!phone.trim() || loadingLookup) ? 0.6 : 1,
                  cursor: (!phone.trim() || loadingLookup) ? "not-allowed" : "pointer"
                }}
              >
                {loadingLookup ? <Loader2 size={18} className="animate-spin" /> : "Find Orders"}
              </button>
            </div>
          </div>

          {orders.length > 0 && (
            <div className="prt-animate-in">
              <div style={{ marginBottom: "24px" }}>
                <label className="text-label-caps" style={{ display: "block", marginBottom: "12px", color: "var(--color-on-surface-variant)" }}>Select an Order</label>
                <div style={{ display: "grid", gap: "12px", maxHeight: "300px", overflowY: "auto", padding: "4px" }} className="custom-scrollbar">
                  {orders.map((order) => {
                    const isSelected = orderId === order.id;
                    return (
                      <div
                        key={order.id}
                        onClick={() => setOrderId(order.id)}
                        style={{
                          border: isSelected ? "2px solid var(--color-primary)" : "1px solid var(--color-outline-variant)",
                          borderRadius: "var(--radius-lg)",
                          padding: "16px",
                          cursor: "pointer",
                          background: isSelected ? "var(--color-primary-container)" : "var(--color-surface-container-lowest)",
                          transition: "all 0.2s",
                          position: "relative"
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                          <div className="text-title-sm" style={{ color: isSelected ? "var(--color-primary)" : "var(--color-on-surface)" }}>
                            {order.label}
                          </div>
                          {isSelected && <CheckCircle2 size={18} color="var(--color-primary)" />}
                        </div>
                        
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
                          {order.productType && (
                            <div className="prt-badge prt-badge-design" style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                              <Tag size={12} />
                              {order.productType}
                            </div>
                          )}
                          {order.stage && (
                            <div className="prt-badge prt-badge-production" style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                              <Activity size={12} />
                              {order.stage}
                            </div>
                          )}
                          {order.dateCreated && (
                            <div className="text-data-tabular" style={{ display: "flex", alignItems: "center", gap: "4px", color: "var(--color-on-surface-variant)" }}>
                              <Calendar size={14} />
                              {new Date(order.dateCreated).toLocaleDateString()}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div style={{ marginBottom: "24px" }}>
                <label className="text-label-caps" style={{ display: "block", marginBottom: "8px", color: "var(--color-on-surface-variant)" }}>Describe the Issue</label>
                <div style={{ position: "relative" }}>
                  <FileText size={18} color="var(--color-on-surface-variant)" style={{ position: "absolute", left: "12px", top: "12px" }} />
                  <textarea
                    className="prt-input"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Please provide details about what went wrong..."
                    rows={4}
                    style={{ paddingLeft: "40px", resize: "vertical" }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: "32px" }}>
                <label className="text-label-caps" style={{ display: "block", marginBottom: "8px", color: "var(--color-on-surface-variant)" }}>Attachments (Optional)</label>
                <div
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  style={{
                    border: "2px dashed var(--color-outline-variant)",
                    borderRadius: "var(--radius-lg)",
                    padding: "32px",
                    textAlign: "center",
                    background: "var(--color-surface-container-low)",
                    transition: "all 0.2s",
                    cursor: "pointer",
                    position: "relative"
                  }}
                  onMouseOver={(e) => { e.currentTarget.style.borderColor = "var(--color-outline)"; }}
                  onMouseOut={(e) => { e.currentTarget.style.borderColor = "var(--color-outline-variant)"; }}
                >
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer", width: "100%", height: "100%", zIndex: 10 }}
                    onChange={(e) => {
                      if (e.target.files) {
                        const newFiles = Array.from(e.target.files).filter(f => f.type.startsWith('image/'));
                        setFiles(prev => [...prev, ...newFiles]);
                      }
                    }}
                  />
                  <Upload size={32} color="var(--color-on-surface-variant)" style={{ margin: "0 auto 12px" }} />
                  <p className="text-body-md" style={{ margin: "0 0 4px", fontWeight: 600, color: "var(--color-on-surface)" }}>
                    Click or drag photos here
                  </p>
                  <p className="text-label-caps" style={{ margin: 0, color: "var(--color-on-surface-variant)" }}>
                    Supported formats: JPG, PNG, GIF
                  </p>
                </div>
                
                {previewUrls.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", marginTop: "16px" }}>
                    {files.map((file, index) => {
                      const objectUrl = previewUrls[index];
                      return (
                        <div key={index} style={{ position: "relative", width: "80px", height: "80px", borderRadius: "var(--radius-md)", overflow: "hidden", border: "1px solid var(--color-outline-variant)", boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }}>
                          <img
                            src={objectUrl}
                            alt={`Preview ${index}`}
                            style={{ width: "100%", height: "100%", objectFit: "cover" }}
                          />
                          <button
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); removeFile(index); }}
                            style={{
                              position: "absolute",
                              top: "4px",
                              right: "4px",
                              background: "rgba(0,0,0,0.6)",
                              color: "white",
                              border: "none",
                              borderRadius: "50%",
                              width: "20px",
                              height: "20px",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              cursor: "pointer",
                              padding: "2px"
                            }}
                            title="Remove"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <button
                type="submit"
                className={`prt-btn ${(!orderId || !description.trim()) ? 'prt-btn-secondary' : 'prt-btn-primary'}`}
                disabled={submitting || !orderId || !description.trim()}
                style={{
                  width: "100%",
                  padding: "16px",
                  fontSize: "16px",
                  justifyContent: "center",
                  opacity: (!orderId || !description.trim()) ? 0.6 : 1,
                  cursor: (!orderId || !description.trim()) ? "not-allowed" : "pointer"
                }}
              >
                {submitting ? (
                  <>
                    <Loader2 size={20} className="animate-spin" />
                    Submitting Ticket...
                  </>
                ) : (
                  "Submit Service Ticket"
                )}
              </button>
            </div>
          )}
        </form>
        </>
      )}
      </div>
    </div>
  );
}

