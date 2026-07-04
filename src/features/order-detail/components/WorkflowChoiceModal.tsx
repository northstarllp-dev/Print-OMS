"use client";

import React, { useState } from "react";
import { FileText, Palette, X, ArrowRight } from "lucide-react";

interface WorkflowChoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onChoose: (workflowType: "quote_first" | "design_first") => Promise<void>;
}

const PATH_QUOTE_FIRST = [
  { icon: "📍", label: "Site Visit" },
  { icon: "📄", label: "Quote" },
  { icon: "🎨", label: "Design" },
  { icon: "🏭", label: "Production" },
  { icon: "🔧", label: "Installation" },
];

const PATH_DESIGN_FIRST = [
  { icon: "📍", label: "Site Visit" },
  { icon: "🎨", label: "Design" },
  { icon: "📄", label: "Quote" },
  { icon: "🏭", label: "Production" },
  { icon: "🔧", label: "Installation" },
];

export function WorkflowChoiceModal({ isOpen, onClose, onChoose }: WorkflowChoiceModalProps) {
  const [loading, setLoading] = useState<"quote_first" | "design_first" | null>(null);

  if (!isOpen) return null;

  const handleChoose = async (type: "quote_first" | "design_first") => {
    setLoading(type);
    try {
      await onChoose(type);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div style={{
      position: "fixed", inset: 0,
      background: "rgba(15, 23, 42, 0.5)",
      backdropFilter: "blur(6px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 2000, padding: "20px",
    }}>
      <div style={{
        background: "white", borderRadius: "20px", width: "100%", maxWidth: "680px",
        boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)",
        overflow: "hidden", animation: "slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
      }}>
        {/* Header */}
        <div style={{
          padding: "20px 24px", borderBottom: "1px solid #E2E8F0",
          display: "flex", justifyContent: "space-between", alignItems: "center",
          background: "#F8FAFC",
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: "17px", fontWeight: "800", color: "#0F172A" }}>
              Choose Workflow Path
            </h2>
            <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#64748B" }}>
              Site visit is approved. How do you want to proceed for this order?
            </p>
          </div>
          <button
            onClick={onClose}
            style={{ background: "transparent", border: "none", cursor: "pointer", color: "#94A3B8", padding: "4px", borderRadius: "6px" }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Cards */}
        <div style={{ padding: "24px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
          {/* Quote First */}
          <button
            onClick={() => handleChoose("quote_first")}
            disabled={!!loading}
            style={{
              background: loading === "quote_first" ? "#EFF6FF" : "white",
              border: "2px solid",
              borderColor: loading === "quote_first" ? "#3B82F6" : "#E2E8F0",
              borderRadius: "14px", padding: "20px",
              cursor: loading ? "not-allowed" : "pointer",
              textAlign: "left", transition: "all 0.2s",
              opacity: loading && loading !== "quote_first" ? 0.5 : 1,
            }}
            onMouseEnter={(e) => { if (!loading) { e.currentTarget.style.borderColor = "#3B82F6"; e.currentTarget.style.background = "#EFF6FF"; e.currentTarget.style.transform = "translateY(-2px)"; }}}
            onMouseLeave={(e) => { if (!loading) { e.currentTarget.style.borderColor = "#E2E8F0"; e.currentTarget.style.background = "white"; e.currentTarget.style.transform = "translateY(0)"; }}}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px" }}>
              <div style={{ width: "40px", height: "40px", background: "#DBEAFE", borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <FileText size={20} color="#2563EB" />
              </div>
              <div>
                <div style={{ fontSize: "15px", fontWeight: "800", color: "#0F172A" }}>Quote First</div>
                <div style={{ fontSize: "12px", color: "#64748B" }}>Standard workflow</div>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {PATH_QUOTE_FIRST.map((step, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px" }}>
                  <span style={{ fontSize: "15px" }}>{step.icon}</span>
                  <span style={{ color: "#334155", fontWeight: "500" }}>{step.label}</span>
                  {i < PATH_QUOTE_FIRST.length - 1 && (
                    <ArrowRight size={10} color="#CBD5E1" style={{ marginLeft: "auto" }} />
                  )}
                </div>
              ))}
            </div>
            <div style={{ marginTop: "16px", padding: "8px 12px", background: loading === "quote_first" ? "#DBEAFE" : "#F1F5F9", borderRadius: "8px", fontSize: "12px", fontWeight: "700", color: loading === "quote_first" ? "#1D4ED8" : "#475569", textAlign: "center" }}>
              {loading === "quote_first" ? "Setting up..." : "Select Quote First →"}
            </div>
          </button>

          {/* Design First */}
          <button
            onClick={() => handleChoose("design_first")}
            disabled={!!loading}
            style={{
              background: loading === "design_first" ? "#FDF4FF" : "white",
              border: "2px solid",
              borderColor: loading === "design_first" ? "#A855F7" : "#E2E8F0",
              borderRadius: "14px", padding: "20px",
              cursor: loading ? "not-allowed" : "pointer",
              textAlign: "left", transition: "all 0.2s",
              opacity: loading && loading !== "design_first" ? 0.5 : 1,
            }}
            onMouseEnter={(e) => { if (!loading) { e.currentTarget.style.borderColor = "#A855F7"; e.currentTarget.style.background = "#FDF4FF"; e.currentTarget.style.transform = "translateY(-2px)"; }}}
            onMouseLeave={(e) => { if (!loading) { e.currentTarget.style.borderColor = "#E2E8F0"; e.currentTarget.style.background = "white"; e.currentTarget.style.transform = "translateY(0)"; }}}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px" }}>
              <div style={{ width: "40px", height: "40px", background: "#F3E8FF", borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Palette size={20} color="#9333EA" />
              </div>
              <div>
                <div style={{ fontSize: "15px", fontWeight: "800", color: "#0F172A" }}>Design First</div>
                <div style={{ fontSize: "12px", color: "#64748B" }}>Design before quote</div>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {PATH_DESIGN_FIRST.map((step, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px" }}>
                  <span style={{ fontSize: "15px" }}>{step.icon}</span>
                  <span style={{ color: "#334155", fontWeight: "500" }}>{step.label}</span>
                  {i < PATH_DESIGN_FIRST.length - 1 && (
                    <ArrowRight size={10} color="#CBD5E1" style={{ marginLeft: "auto" }} />
                  )}
                </div>
              ))}
            </div>
            <div style={{ marginTop: "16px", padding: "8px 12px", background: loading === "design_first" ? "#F3E8FF" : "#F1F5F9", borderRadius: "8px", fontSize: "12px", fontWeight: "700", color: loading === "design_first" ? "#7E22CE" : "#475569", textAlign: "center" }}>
              {loading === "design_first" ? "Setting up..." : "Select Design First →"}
            </div>
          </button>
        </div>

        <style>{`
          @keyframes slideUp {
            from { opacity: 0; transform: translateY(12px); }
            to   { opacity: 1; transform: translateY(0); }
          }
        `}</style>
      </div>
    </div>
  );
}
