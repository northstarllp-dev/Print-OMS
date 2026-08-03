"use client";

import React, { useMemo, useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  MessageSquare,
  X,
} from "lucide-react";
import {
  CUSTOMER_MESSAGE_TEMPLATES,
  CustomerMessageKey,
} from "./templates";
import {
  ALL_CUSTOMER_MESSAGE_KEYS,
  getCatchUpTemplatesForStage,
} from "./stageTemplates";

type CustomerMessageTemplatePickerProps = {
  isOpen: boolean;
  onClose: () => void;
  stage: string;
  workflowType?: "quote_first" | "design_first";
  onSelect: (key: CustomerMessageKey) => void;
  /** Template keys already shared for this order. */
  sentKeys?: ReadonlySet<CustomerMessageKey> | CustomerMessageKey[];
  /** Friendly order number shown in the header. */
  orderNo?: string;
};

function TemplateRow({
  messageKey,
  badge,
  emphasized,
  sent,
  onSelect,
}: {
  messageKey: CustomerMessageKey;
  badge?: string;
  emphasized?: boolean;
  sent?: boolean;
  onSelect: (key: CustomerMessageKey) => void;
}) {
  const template = CUSTOMER_MESSAGE_TEMPLATES[messageKey];
  return (
    <button
      type="button"
      onClick={() => onSelect(messageKey)}
      style={{
        width: "100%",
        textAlign: "left",
        padding: emphasized ? "14px 16px" : "12px 14px",
        borderRadius: "10px",
        border: emphasized ? "1.5px solid #86efac" : "1px solid #e2e8f0",
        background: emphasized ? "#f0fdf4" : "white",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: "12px",
        transition: "background 0.15s, border-color 0.15s",
      }}
      onMouseEnter={(e) => {
        if (!emphasized) e.currentTarget.style.background = "#f8fafc";
      }}
      onMouseLeave={(e) => {
        if (!emphasized) e.currentTarget.style.background = "white";
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: "50%",
          background: emphasized ? "#25D366" : "#f1f5f9",
          color: emphasized ? "white" : "#64748b",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <MessageSquare size={16} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            flexWrap: "wrap",
          }}
        >
          <span
            style={{
              fontSize: emphasized ? "14px" : "13px",
              fontWeight: 700,
              color: "#0f172a",
            }}
          >
            {template.title}
          </span>
          {badge && (
            <span
              style={{
                fontSize: "10px",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                padding: "2px 8px",
                borderRadius: "999px",
                background: emphasized ? "#dcfce7" : "#e2e8f0",
                color: emphasized ? "#15803d" : "#475569",
              }}
            >
              {badge}
            </span>
          )}
        </div>
        <p
          style={{
            margin: "4px 0 0",
            fontSize: "12px",
            color: "#64748b",
            lineHeight: 1.4,
          }}
        >
          {template.emailSubject}
        </p>
      </div>
      {sent ? (
        <span
          title="Sent"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "4px",
            color: "#16a34a",
            flexShrink: 0,
          }}
        >
          <CheckCircle2 size={18} />
          <span
            style={{
              fontSize: "10px",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.04em",
            }}
          >
            Sent
          </span>
        </span>
      ) : (
        <ChevronRight size={16} style={{ color: "#94a3b8", flexShrink: 0 }} />
      )}
    </button>
  );
}

export function CustomerMessageTemplatePicker({
  isOpen,
  onClose,
  stage,
  workflowType = "quote_first",
  onSelect,
  sentKeys,
  orderNo,
}: CustomerMessageTemplatePickerProps) {
  const [showAll, setShowAll] = useState(false);

  const sentSet = useMemo(() => {
    if (!sentKeys) return new Set<CustomerMessageKey>();
    return sentKeys instanceof Set ? sentKeys : new Set(sentKeys);
  }, [sentKeys]);

  const { primary, suggested, otherKeys } = useMemo(() => {
    const catchUp = getCatchUpTemplatesForStage(stage, workflowType);
    return {
      primary: catchUp.primary,
      suggested: catchUp.suggested.filter((k) => k !== catchUp.primary),
      // Full catalog (including featured) so sent ticks are visible here too.
      otherKeys: ALL_CUSTOMER_MESSAGE_KEYS,
    };
  }, [stage, workflowType]);

  if (!isOpen) return null;

  const handleSelect = (key: CustomerMessageKey) => {
    onSelect(key);
    onClose();
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15, 23, 42, 0.4)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        zIndex: 1100,
        padding: "12px",
        fontFamily: "var(--font-sans), sans-serif",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "white",
          borderRadius: "16px",
          width: "100%",
          maxWidth: "480px",
          maxHeight: "85vh",
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.15)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          marginBottom: "max(8px, env(safe-area-inset-bottom))",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: "18px 20px",
            borderBottom: "1px solid #e2e8f0",
            background: "#f8fafc",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: "12px",
          }}
        >
          <div style={{ minWidth: 0 }}>
            <h2
              style={{
                fontSize: "16px",
                fontWeight: 700,
                color: "#0f172a",
                margin: 0,
              }}
            >
              Send customer message
            </h2>
            {orderNo && (
              <p
                style={{
                  fontSize: "13px",
                  fontWeight: 700,
                  color: "#0f172a",
                  margin: "6px 0 0",
                }}
              >
                Order: {orderNo}
              </p>
            )}
            <p
              style={{
                fontSize: "12px",
                color: "#64748b",
                margin: "4px 0 0",
              }}
            >
              Stage: <strong style={{ color: "#334155" }}>{stage}</strong>
            </p>
            <p
              style={{
                fontSize: "11px",
                color: "#94a3b8",
                margin: "6px 0 0",
                lineHeight: 1.4,
              }}
            >
              Use this if you skipped the popup after a stage update. Green tick
              appears after you Copy / WhatsApp / Email.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              background: "#f1f5f9",
              border: "none",
              color: "#64748b",
              cursor: "pointer",
              padding: "8px",
              borderRadius: "8px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div
          style={{
            padding: "16px",
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: "16px",
          }}
        >
          <div>
            <div
              style={{
                fontSize: "10px",
                fontWeight: 700,
                color: "#64748b",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                marginBottom: "8px",
              }}
            >
              For this stage
            </div>
            <TemplateRow
              messageKey={primary}
              badge="Send for this stage"
              emphasized
              sent={sentSet.has(primary)}
              onSelect={handleSelect}
            />
          </div>

          {suggested.length > 0 && (
            <div>
              <div
                style={{
                  fontSize: "10px",
                  fontWeight: 700,
                  color: "#64748b",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  marginBottom: "8px",
                }}
              >
                Also useful
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {suggested.map((key) => (
                  <TemplateRow
                    key={key}
                    messageKey={key}
                    sent={sentSet.has(key)}
                    onSelect={handleSelect}
                  />
                ))}
              </div>
            </div>
          )}

          <div>
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                background: "transparent",
                border: "none",
                padding: "4px 0",
                cursor: "pointer",
                marginBottom: showAll ? "8px" : 0,
              }}
            >
              <span
                style={{
                  fontSize: "10px",
                  fontWeight: 700,
                  color: "#64748b",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                All templates
              </span>
              {showAll ? (
                <ChevronDown size={14} style={{ color: "#94a3b8" }} />
              ) : (
                <ChevronRight size={14} style={{ color: "#94a3b8" }} />
              )}
            </button>
            {showAll && (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {otherKeys.map((key) => (
                  <TemplateRow
                    key={key}
                    messageKey={key}
                    sent={sentSet.has(key)}
                    onSelect={handleSelect}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
