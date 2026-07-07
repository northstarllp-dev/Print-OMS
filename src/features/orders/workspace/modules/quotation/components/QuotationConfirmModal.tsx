import React from "react";
import { Check, X } from "lucide-react";

export function QuotationConfirmModal({
  subtotal,
  discount,
  tax,
  grandTotal,
  totalItems,
  sectionSummaries,
  onConfirm,
  onClose,
}: {
  subtotal: number;
  discount: number;
  tax: number;
  grandTotal: number;
  totalItems: number;
  sectionSummaries: {
    id: string;
    name: string;
    linesCount: number;
    amount: number;
    lines: { id: string; description: string; amount: number; }[];
  }[];
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        backdropFilter: "blur(2px)",
        zIndex: 99999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
      }}
    >
      <div
        style={{
          backgroundColor: "white",
          borderRadius: "16px",
          maxWidth: "400px",
          width: "100%",
          overflow: "hidden",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
          border: "1px solid #f1f5f9",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Header */}
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #f1f5f9", backgroundColor: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h4 style={{ margin: 0, fontSize: "14px", fontWeight: 800, color: "#0f172a", textTransform: "uppercase" }}>
              Confirm Quotation
            </h4>
            <span style={{ fontSize: "10px", color: "#64748b", fontWeight: 600 }}>
              Sending to Customer for Approval
            </span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "12px" }}>
          {/* Section Summaries Breakdown */}
          {sectionSummaries && sectionSummaries.length > 0 && (
            <div style={{ maxHeight: "160px", overflowY: "auto", borderBottom: "1px dashed #cbd5e1", paddingBottom: "12px", marginBottom: "4px", display: "flex", flexDirection: "column", gap: "10px" }}>
              {sectionSummaries.map((sec) => (
                <div key={sec.id} style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      <span style={{ fontSize: "12px", color: "#334155", fontWeight: 700 }}>{sec.name}</span>
                      <span style={{ fontSize: "10px", color: "#94a3b8", fontWeight: 600 }}>{sec.linesCount} line item{sec.linesCount !== 1 ? 's' : ''}</span>
                    </div>
                    <span style={{ fontSize: "12px", color: "#0f172a", fontWeight: 700 }}>
                      ₹{sec.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  {/* Detailed Lines */}
                  {sec.lines && sec.lines.length > 0 && (
                    <div style={{ paddingLeft: "8px", borderLeft: "2px solid #e2e8f0", display: "flex", flexDirection: "column", gap: "4px" }}>
                      {sec.lines.map(line => (
                        <div key={line.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontSize: "11px", color: "#64748b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "220px" }}>
                            {line.description}
                          </span>
                          <span style={{ fontSize: "11px", color: "#475569", fontWeight: 600 }}>
                            ₹{line.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "12px", color: "#64748b", fontWeight: 600 }}>Total Items</span>
            <span style={{ fontSize: "12px", color: "#0f172a", fontWeight: 800 }}>{totalItems}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "12px", color: "#64748b", fontWeight: 600 }}>Subtotal</span>
            <span style={{ fontSize: "12px", color: "#0f172a", fontWeight: 800 }}>₹{subtotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
          </div>
          {discount > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "12px", color: "#64748b", fontWeight: 600 }}>Discount</span>
              <span style={{ fontSize: "12px", color: "#16a34a", fontWeight: 800 }}>-₹{discount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "12px", color: "#64748b", fontWeight: 600 }}>Tax (GST)</span>
            <span style={{ fontSize: "12px", color: "#0f172a", fontWeight: 800 }}>+₹{tax.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
          </div>
          <div style={{ borderTop: "1px dashed #cbd5e1", margin: "4px 0" }} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "14px", color: "#0f172a", fontWeight: 900 }}>Grand Total</span>
            <span style={{ fontSize: "16px", color: "#2563eb", fontWeight: 900 }}>₹{grandTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: "16px 20px", borderTop: "1px solid #f1f5f9", backgroundColor: "#f8fafc", display: "flex", justifyContent: "flex-end", gap: "8px" }}>
          <button
            onClick={onClose}
            style={{ padding: "8px 16px", backgroundColor: "white", color: "#475569", border: "1px solid #cbd5e1", borderRadius: "8px", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#f1f5f9"}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "white"}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            style={{ padding: "8px 16px", backgroundColor: "#22c55e", color: "white", border: "none", borderRadius: "8px", fontSize: "12px", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#16a34a"}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "#22c55e"}
          >
            <Check size={14} /> Confirm & Proceed
          </button>
        </div>
      </div>
    </div>
  );
}
