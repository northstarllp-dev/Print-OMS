"use client";

import React from "react";
import { Upload, X } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
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

  if (!ticket) return null;

  async function uploadResolutionFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
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
  }

  async function handleSaveResolution() {
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
          padding: "24px",
          maxHeight: "90vh",
          overflowY: "auto",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px" }}>
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
            {renderPhotoGallery(ticket.photos, "No photos uploaded.")}
          </div>
        </div>

        <div style={{ marginTop: "24px", borderTop: "1px solid var(--color-outline-variant)", paddingTop: "24px" }}>
          <h3 className="text-title-sm" style={{ margin: "0 0 12px", color: "var(--color-on-surface)" }}>
            Resolution Photos
          </h3>
          {renderPhotoGallery(resolutionPhotos, "No resolution photos uploaded yet.")}
        </div>

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
                marginBottom: "12px",
                resize: "vertical",
              }}
            />
            <label
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                border: "1px dashed var(--color-outline-variant)",
                borderRadius: "var(--radius-lg)",
                padding: "12px 16px",
                cursor: "pointer",
                background: "var(--color-surface-container-low)",
                color: "var(--color-on-surface)",
                fontWeight: 600,
                transition: "border-color 0.2s"
              }}
              onMouseOver={(e) => { e.currentTarget.style.borderColor = "var(--color-outline)"; }}
              onMouseOut={(e) => { e.currentTarget.style.borderColor = "var(--color-outline-variant)"; }}
            >
              <Upload size={16} color="var(--color-on-surface-variant)" />
              <span className="text-body-md" style={{ fontWeight: 600 }}>Add resolution photos</span>
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={async (e) => {
                  const target = e.target;
                  await uploadResolutionFiles(target.files);
                  target.value = "";
                }}
              />
            </label>
            <div className="text-label-caps" style={{ marginTop: "8px", color: "var(--color-on-surface-variant)" }}>
              {resolutionPhotos.length} resolution photo(s)
            </div>
          </div>
        )}

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

function renderPhotoGallery(photos: TicketPhoto[], emptyText: string) {
  if (photos.length === 0) {
    return <div className="text-body-md" style={{ color: "var(--color-on-surface-variant)" }}>{emptyText}</div>;
  }

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "12px",
      }}
    >
      {photos.map((photo, idx) => (
        <a
          key={`${photo.url}-${idx}`}
          href={photo.url}
          target="_blank"
          rel="noreferrer"
          style={{
            display: "block",
            width: "80px",
            height: "80px",
            borderRadius: "var(--radius-md)",
            overflow: "hidden",
            border: "1px solid var(--color-outline-variant)",
            boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
            transition: "opacity 0.2s",
          }}
          onMouseOver={(e) => { e.currentTarget.style.opacity = "0.8"; }}
          onMouseOut={(e) => { e.currentTarget.style.opacity = "1"; }}
          title={photo.name || `Photo ${idx + 1}`}
        >
          <img
            src={photo.url}
            alt={photo.name || `Ticket photo ${idx + 1}`}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          />
        </a>
      ))}
    </div>
  );
}

