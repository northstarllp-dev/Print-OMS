"use client";

import React, { useEffect, useState } from "react";
import { Copy, Mail, MessageSquare, X } from "lucide-react";
import { loadClientConfig } from "@/config/loadClientConfig";
import { withBasePath } from "@/lib/appBasePath";
import { CUSTOMER_MESSAGE_TEMPLATES, CustomerMessageKey } from "./templates";
import { renderCustomerMessage } from "./renderMessage";
import { buildMailtoLink, buildWhatsAppShareLink } from "./buildShareLinks";
import {
  recordCustomerMessageShare,
  type CustomerMessageShareChannel,
} from "./shareActions";
import { getAppSettings } from "@/features/settings/actions/settingsActions";

const URL_OR_MARKUP =
  /(https?:\/\/[^\s]+|\*[^*\n]+\*|_[^_\n]+_)/g;

/** Render WhatsApp *bold* / _italic_ and bare URLs in the preview. */
function renderPreviewNodes(text: string): React.ReactNode[] {
  const parts = text.split(URL_OR_MARKUP);
  return parts.map((part, i) => {
    if (!part) return null;
    if (/^https?:\/\//.test(part)) {
      return (
        <a
          key={i}
          href={part}
          target="_blank"
          rel="noreferrer"
          style={{
            color: "#2563eb",
            textDecoration: "underline",
            wordBreak: "break-all",
            fontWeight: 600,
          }}
        >
          {part}
        </a>
      );
    }
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
      return (
        <strong key={i} style={{ fontWeight: 700, color: "#0f172a" }}>
          {part.slice(1, -1)}
        </strong>
      );
    }
    if (part.startsWith("_") && part.endsWith("_") && part.length > 2) {
      return (
        <em key={i} style={{ fontStyle: "italic", color: "#0f172a" }}>
          {part.slice(1, -1)}
        </em>
      );
    }
    return <React.Fragment key={i}>{part}</React.Fragment>;
  });
}

export type CustomerMessageInfo = {
  /** Customer id (uuid or friendly) — required for portal link generation. */
  customerId?: string;
  /** Order id (uuid or friendly) — scopes the portal link to the order. */
  orderId?: string;
  businessName: string;
  phone?: string;
  email?: string;
  enquiryNo?: string;
  orderNo?: string;
  date?: string;
  time?: string;
  ticketNo?: string;
};

type CustomerMessageModalProps = {
  isOpen: boolean;
  onClose: () => void;
  templateKey: CustomerMessageKey;
  info: CustomerMessageInfo;
  /** Optional label for the header close button (default "Close"). */
  closeLabel?: string;
  /** Fired after a share is recorded for an order-scoped message. */
  onShared?: (templateKey: CustomerMessageKey) => void;
};

export function CustomerMessageModal({
  isOpen,
  onClose,
  templateKey,
  info,
  closeLabel,
  onShared,
}: CustomerMessageModalProps) {
  const [loading, setLoading] = useState(false);
  const [portalUrl, setPortalUrl] = useState("");
  const [reviewUrl, setReviewUrl] = useState("");
  const [copied, setCopied] = useState(false);

  const markShared = (channel: CustomerMessageShareChannel) => {
    const shareOrderId = info.orderNo || info.orderId;
    if (!shareOrderId) return;
    // Optimistic UI — tick updates even if network is slow.
    onShared?.(templateKey);
    void recordCustomerMessageShare({
      orderId: shareOrderId,
      templateKey,
      channel,
    }).then((res) => {
      if ("error" in res) {
        console.error("Failed to record customer message share:", res.error);
      }
    });
  };

  useEffect(() => {
    if (!isOpen) return;
    setCopied(false);
    setPortalUrl("");
    setReviewUrl("");

    let cancelled = false;

    // Feedback message uses the Google review link from settings — not portal.
    if (templateKey === "feedback_request") {
      setLoading(true);
      void getAppSettings()
        .then((settings) => {
          if (!cancelled) setReviewUrl((settings.googleReviewLink || "").trim());
        })
        .catch((err) => {
          console.error("Error loading Google review link:", err);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }

    if (!info.customerId) return;

    setLoading(true);
    const params = new URLSearchParams({ customer_id: info.customerId });
    if (info.orderId) params.append("order_id", info.orderId);
    fetch(withBasePath(`/api/portal-token?${params.toString()}`))
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok || !data.url) {
          throw new Error(data.error || "Failed to generate portal link");
        }
        if (!cancelled) setPortalUrl(data.url);
      })
      .catch((err) => {
        console.error("Error fetching portal token:", err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, info.customerId, info.orderId, templateKey]);

  if (!isOpen) return null;

  const template = CUSTOMER_MESSAGE_TEMPLATES[templateKey];
  const clientName = loadClientConfig().name;
  const messageText = renderCustomerMessage(templateKey, {
    businessName: info.businessName,
    clientName,
    enquiryNo: info.enquiryNo,
    orderNo: info.orderNo,
    date: info.date,
    time: info.time,
    ticketNo: info.ticketNo,
    portalUrl: portalUrl || undefined,
    reviewUrl: reviewUrl || undefined,
  });

  const hasPhone = !!info.phone?.replace(/[^0-9]/g, "");
  const hasEmail = !!info.email;

  const handleCopy = () => {
    navigator.clipboard.writeText(messageText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    markShared("copy");
  };

  const handleSendWhatsApp = () => {
    if (!info.phone) return;
    window.open(buildWhatsAppShareLink(info.phone, messageText), "_blank");
    markShared("whatsapp");
  };

  const handleSendEmail = () => {
    if (!info.email) return;
    window.open(
      buildMailtoLink(info.email, template.emailSubject, messageText),
      "_blank"
    );
    markShared("email");
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(15, 23, 42, 0.4)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1100,
        padding: "20px",
        fontFamily: "var(--font-sans), sans-serif",
      }}
    >
      <div
        style={{
          background: "white",
          borderRadius: "16px",
          width: "100%",
          maxWidth: "520px",
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
          display: "flex",
          flexDirection: "column",
          maxHeight: "90vh",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "20px 24px",
            borderBottom: "1px solid #e2e8f0",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            background: "#f8fafc",
            gap: "12px",
          }}
        >
          <div style={{ minWidth: 0 }}>
            <h2 style={{ fontSize: "16px", fontWeight: "700", color: "#0f172a", margin: 0 }}>
              {template.title} — Customer Message
            </h2>
            <p style={{ fontSize: "12px", color: "#64748b", margin: "4px 0 0 0" }}>
              Review and send this update to {info.businessName || "the customer"}.
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "var(--color-primary)",
              border: "none",
              color: "white",
              cursor: "pointer",
              padding: "6px 12px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "6px",
              fontSize: "13px",
              fontWeight: "600",
              gap: "6px",
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
          >
            {closeLabel || "Close"} <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div
          style={{
            padding: "24px",
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: "16px",
          }}
        >
          {loading ? (
            <div style={{ padding: "40px", textAlign: "center", color: "#64748b" }}>
              <div
                style={{
                  width: "24px",
                  height: "24px",
                  border: "2px solid var(--color-primary)",
                  borderTopColor: "transparent",
                  borderRadius: "50%",
                  animation: "spin 0.8s linear infinite",
                  margin: "0 auto 12px",
                }}
              />
              {templateKey === "feedback_request"
                ? "Loading Google review link..."
                : "Generating secure customer link..."}
            </div>
          ) : (
            <>
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "11px",
                    fontWeight: "700",
                    color: "#64748b",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    marginBottom: "8px",
                  }}
                >
                  Message Preview
                </label>
                <div
                  style={{
                    width: "100%",
                    minHeight: "200px",
                    padding: "12px",
                    border: "1px solid #cbd5e1",
                    borderRadius: "8px",
                    fontSize: "13px",
                    color: "#334155",
                    fontFamily: "inherit",
                    background: "#f8fafc",
                    whiteSpace: "pre-wrap",
                    lineHeight: 1.55,
                    overflowY: "auto",
                  }}
                >
                  {renderPreviewNodes(messageText)}
                </div>
              </div>

              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  onClick={handleCopy}
                  style={{
                    flex: 1,
                    padding: "10px 14px",
                    background: copied ? "#dcfce7" : "#f1f5f9",
                    border: `1px solid ${copied ? "#86efac" : "#cbd5e1"}`,
                    color: copied ? "#16a34a" : "#475569",
                    borderRadius: "8px",
                    fontSize: "12px",
                    fontWeight: "600",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "6px",
                    cursor: "pointer",
                  }}
                >
                  <Copy size={14} />
                  {copied ? "Copied!" : "Copy Message"}
                </button>

                <button
                  onClick={handleSendWhatsApp}
                  disabled={!hasPhone}
                  title={hasPhone ? undefined : "No phone number on record"}
                  style={{
                    flex: 1,
                    padding: "10px 14px",
                    background: "#25D366",
                    color: "white",
                    border: "none",
                    borderRadius: "8px",
                    fontSize: "12px",
                    fontWeight: "600",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "6px",
                    cursor: hasPhone ? "pointer" : "not-allowed",
                    opacity: hasPhone ? 1 : 0.5,
                  }}
                >
                  <MessageSquare size={14} />
                  Send WhatsApp
                </button>

                <button
                  onClick={handleSendEmail}
                  disabled={!hasEmail}
                  title={hasEmail ? undefined : "No email on record"}
                  style={{
                    flex: 1,
                    padding: "10px 14px",
                    background: "var(--color-secondary)",
                    color: "white",
                    border: "none",
                    borderRadius: "8px",
                    fontSize: "12px",
                    fontWeight: "600",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "6px",
                    cursor: hasEmail ? "pointer" : "not-allowed",
                    opacity: hasEmail ? 1 : 0.5,
                  }}
                >
                  <Mail size={14} />
                  Send Email
                </button>
              </div>
            </>
          )}
        </div>
      </div>
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
