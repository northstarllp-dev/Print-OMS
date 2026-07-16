"use client";

import React from "react";
import { Upload, X, Eye, Download, Trash2, Camera } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { deleteStorageFilesAction } from "@/features/orders/actions/storageActions";
import {
  completeTicketAction,
  updateTicketResolutionAction,
  type ServiceTicketRecord,
  type TicketPhoto,
} from "@/features/service-tickets/actions/serviceTicketActions";

interface ServiceTicketDetailModalProps {
  ticket: ServiceTicketRecord | null;
  canManage: boolean;
  onClose: () => void;
  onUpdated: () => void;
}

export function ServiceTicketDetailModal({
  ticket,
  canManage,
  onClose,
  onUpdated,
}: ServiceTicketDetailModalProps) {
  const [resolutionNotes, setResolutionNotes] = React.useState(
    ticket?.resolution_notes ?? ""
  );
  const [resolutionPhotos, setResolutionPhotos] = React.useState<TicketPhoto[]>(
    ticket?.resolution_photos ?? []
  );
  const [showCompleteConfirm, setShowCompleteConfirm] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [uploadingResolution, setUploadingResolution] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  if (!ticket) return null;

  async function uploadResolutionFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploadingResolution(true);
    try {
      const supabase = createClient();
      const uploaded: TicketPhoto[] = [];
      for (const file of Array.from(files)) {
        const ext = file.name.split(".").pop() || "jpg";
        const path = `resolution/${Date.now()}-${Math.random()
          .toString(36)
          .slice(2)}.${ext}`;
        const { error } = await supabase.storage
          .from("service-ticket-resolution-photos")
          .upload(path, file, { contentType: file.type, upsert: false });
        if (error) throw new Error(error.message);
        const { data } = supabase.storage
          .from("service-ticket-resolution-photos")
          .getPublicUrl(path);
        uploaded.push({
          url: data.publicUrl,
          name: file.name,
          uploadedBy: "Service Manager",
          createdAt: new Date().toISOString(),
        });
      }
      setResolutionPhotos((prev) => [...prev, ...uploaded]);
    } finally {
      setUploadingResolution(false);
    }
  }

  async function removeResolutionPhoto(index: number) {
    const photo = resolutionPhotos[index];
    try {
      const path = photo.url.split("/service-ticket-resolution-photos/").pop();
      if (path) {
        await deleteStorageFilesAction("service-ticket-resolution-photos", [path]);
      }
    } catch {
      // best-effort cleanup
    }
    setResolutionPhotos((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSaveResolution() {
    if (!ticket) return;
    setSaving(true);
    try {
      await updateTicketResolutionAction(ticket.id, {
        resolutionNotes,
        resolutionPhotos,
      });
      onUpdated();
    } finally {
      setSaving(false);
    }
  }

  async function handleComplete() {
    if (!ticket) return;
    setSaving(true);
    try {
      await updateTicketResolutionAction(ticket.id, {
        resolutionNotes,
        resolutionPhotos,
      });
      await completeTicketAction(ticket.id);
      onUpdated();
      onClose();
    } finally {
      setSaving(false);
      setShowCompleteConfirm(false);
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
        justifyContent: "center",
        alignItems: "center",
        padding: "20px",
      }}
      onClick={onClose}
    >
      <div
        className="prt-card prt-animate-in"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: "900px",
          padding: "28px",
          maxHeight: "90vh",
          overflowY: "auto",
        }}
      >
        {/* ─── Header ─── */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px" }}>
          <div>
            <h2 className="text-headline-md" style={{ margin: 0, color: "var(--color-primary)" }}>
              Ticket {ticket.ticket_id}
            </h2>
            <p className="text-body-md" style={{ margin: "4px 0 0", color: "var(--color-on-surface-variant)" }}>
              {ticket.customer_name || "-"} ({ticket.customer_business_name || "-"}) &bull; {ticket.phone}
            </p>
          </div>
          <button 
            onClick={onClose} 
            style={{ 
              border: "none", 
              background: "transparent", 
              cursor: "pointer", 
              color: "var(--color-on-surface-variant)",
              padding: "4px"
            }}
          >
            <X size={24} />
          </button>
        </div>

        {/* ─── Problem + Issue Photos ─── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
          <div style={{ border: "1px solid var(--color-outline-variant)", borderRadius: "var(--radius-lg)", padding: "16px", background: "var(--color-surface-container-lowest)" }}>
            <h3 className="text-title-sm" style={{ margin: "0 0 12px", color: "var(--color-on-surface)" }}>Problem Description</h3>
            <p className="text-body-md" style={{ margin: 0, color: "var(--color-on-surface)", whiteSpace: "pre-wrap" }}>
              {ticket.description}
            </p>
            <div style={{ marginTop: "16px", display: "flex", flexWrap: "wrap", gap: "8px" }}>
              <span className="prt-badge prt-badge-design">Order: {ticket.order_code || ticket.order_id}</span>
              <span className="prt-badge prt-badge-site-visit">Status: {ticket.status}</span>
            </div>
          </div>
          <div style={{ border: "1px solid var(--color-outline-variant)", borderRadius: "var(--radius-lg)", padding: "16px", background: "var(--color-surface-container-lowest)" }}>
            <h3 className="text-title-sm" style={{ margin: "0 0 12px", color: "var(--color-on-surface)" }}>Issue Photos</h3>
            <PhotoGallery photos={ticket.photos} emptyText="No photos uploaded." />
          </div>
        </div>

        {/* ─── Resolution Photos ─── */}
        <div style={{ marginTop: "24px", borderTop: "1px solid var(--color-outline-variant)", paddingTop: "24px" }}>
          <h3 className="text-title-sm" style={{ margin: "0 0 12px", color: "var(--color-on-surface)" }}>
            Resolution Photos
          </h3>
          {resolutionPhotos.length > 0 ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
              {resolutionPhotos.map((photo, idx) => (
                <div
                  key={`${photo.url}-${idx}`}
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
                  <img
                    src={photo.url}
                    alt={photo.name || `Resolution photo ${idx + 1}`}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
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
                      style={overlayBtnStyle}
                      onMouseOver={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.4)"; }}
                      onMouseOut={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.2)"; }}
                      title="View"
                    >
                      <Eye size={14} />
                    </a>
                    <a
                      href={`${photo.url}?download=`}
                      target="_blank"
                      rel="noreferrer"
                      style={overlayBtnStyle}
                      onMouseOver={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.4)"; }}
                      onMouseOut={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.2)"; }}
                      title="Download"
                    >
                      <Download size={14} />
                    </a>
                    {canManage && (
                      <button
                        type="button"
                        onClick={() => void removeResolutionPhoto(idx)}
                        style={overlayDeleteBtnStyle}
                        onMouseOver={(e) => { e.currentTarget.style.background = "rgba(239,68,68,1)"; }}
                        onMouseOut={(e) => { e.currentTarget.style.background = "rgba(239,68,68,0.8)"; }}
                        title="Remove"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-body-md" style={{ color: "var(--color-on-surface-variant)" }}>
              No resolution photos uploaded yet.
            </div>
          )}
        </div>

        {/* ─── Resolution Notes + Upload ─── */}
        {canManage && (
          <div style={{ marginTop: "24px", borderTop: "1px solid var(--color-outline-variant)", paddingTop: "24px" }}>
            <h3 className="text-title-sm" style={{ margin: "0 0 12px", color: "var(--color-on-surface)" }}>
              Resolution
            </h3>
            <textarea
              className="prt-input"
              value={resolutionNotes}
              onChange={(e) => setResolutionNotes(e.target.value)}
              rows={4}
              placeholder="Add notes on required fix and resolution details..."
              style={{
                marginBottom: "16px",
                resize: "vertical",
              }}
            />

            {/* Styled upload zone */}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*"
              style={{ display: "none" }}
              onChange={async (e) => {
                const target = e.target;
                await uploadResolutionFiles(target.files);
                target.value = "";
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingResolution}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "10px 16px",
                background: "var(--color-surface-container-low)",
                border: "1px dashed var(--color-outline-variant)",
                borderRadius: "var(--radius-lg)",
                color: "var(--color-on-surface)",
                fontWeight: 600,
                fontSize: "13px",
                cursor: uploadingResolution ? "wait" : "pointer",
                transition: "border-color 0.2s, background 0.2s",
                opacity: uploadingResolution ? 0.7 : 1,
              }}
              onMouseOver={(e) => { e.currentTarget.style.borderColor = "var(--color-outline)"; e.currentTarget.style.background = "var(--color-surface-container-lowest)"; }}
              onMouseOut={(e) => { e.currentTarget.style.borderColor = "var(--color-outline-variant)"; e.currentTarget.style.background = "var(--color-surface-container-low)"; }}
            >
              {uploadingResolution ? (
                <>
                  <span style={{ width: "14px", height: "14px", border: "2px solid var(--color-outline-variant)", borderTopColor: "var(--color-primary)", borderRadius: "50%", display: "inline-block" }} className="animate-spin" />
                  Uploading…
                </>
              ) : (
                <>
                  <Camera size={16} color="var(--color-on-surface-variant)" />
                  Add resolution photos
                </>
              )}
            </button>
            <div className="text-label-caps" style={{ marginTop: "8px", color: "var(--color-on-surface-variant)" }}>
              {resolutionPhotos.length} resolution photo(s)
            </div>
          </div>
        )}

        {/* ─── Footer ─── */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "32px" }}>
          {canManage && (
            <button
              className="prt-btn prt-btn-secondary"
              onClick={handleSaveResolution}
              disabled={saving}
            >
              Save Resolution
            </button>
          )}
          {canManage && ticket.status !== "closed" && (
            <button
              className="prt-btn prt-btn-primary"
              onClick={() => setShowCompleteConfirm(true)}
              disabled={saving}
            >
              Ticket Completed
            </button>
          )}
        </div>
      </div>

      {/* ─── Complete Confirmation ─── */}
      {showCompleteConfirm && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(12, 15, 26, 0.65)",
            zIndex: 110,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
          }}
        >
          <div
            className="prt-card prt-animate-in"
            style={{
              width: "100%",
              maxWidth: "420px",
              padding: "24px",
            }}
          >
            <h4 className="text-title-sm" style={{ margin: "0 0 8px", color: "var(--color-on-surface)" }}>Complete Ticket?</h4>
            <p className="text-body-md" style={{ margin: "0 0 24px", color: "var(--color-on-surface-variant)" }}>
              This will move the ticket to the closed stage.
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px" }}>
              <button
                className="prt-btn prt-btn-secondary"
                onClick={() => setShowCompleteConfirm(false)}
              >
                Cancel
              </button>
              <button
                className="prt-btn prt-btn-primary"
                onClick={handleComplete}
                disabled={saving}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Shared Photo Gallery Component ─── */

function PhotoGallery({ photos, emptyText }: { photos: TicketPhoto[]; emptyText: string }) {
  if (photos.length === 0) {
    return <div className="text-body-md" style={{ color: "var(--color-on-surface-variant)" }}>{emptyText}</div>;
  }

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
      {photos.map((photo, idx) => (
        <div
          key={`${photo.url}-${idx}`}
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
          <img
            src={photo.url}
            alt={photo.name || `Photo ${idx + 1}`}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
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
              style={overlayBtnStyle}
              onMouseOver={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.4)"; }}
              onMouseOut={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.2)"; }}
              title="View"
            >
              <Eye size={14} />
            </a>
            <a
              href={`${photo.url}?download=`}
              target="_blank"
              rel="noreferrer"
              style={overlayBtnStyle}
              onMouseOver={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.4)"; }}
              onMouseOut={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.2)"; }}
              title="Download"
            >
              <Download size={14} />
            </a>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── Shared Styles ─── */

const overlayBtnStyle: React.CSSProperties = {
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
  textDecoration: "none",
};

const overlayDeleteBtnStyle: React.CSSProperties = {
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
};

