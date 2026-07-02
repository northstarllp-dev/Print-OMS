import React, { useState, useEffect, useRef } from "react";
import { X, Search } from "lucide-react";
import { getActiveProducts } from "@/features/products/actions/productActions";

interface ConvertEnquiryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (projectName: string, productType: string, requirements: string) => void;
  defaultProjectName: string;
  defaultRequirements?: string;
}

export function ConvertEnquiryModal({ isOpen, onClose, onSubmit, defaultProjectName, defaultRequirements = "" }: ConvertEnquiryModalProps) {
  const [projectName, setProjectName] = useState(defaultProjectName);
  const [productType, setProductType] = useState("");
  const [requirements, setRequirements] = useState(defaultRequirements);
  const [products, setProducts] = useState<{ id: string; name: string }[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      getActiveProducts().then((data) => {
        const finalProducts = data.filter((p) => p.final_prdt === true);
        setProducts(finalProducts.map((p) => ({ id: p.id, name: p.name })));
      }).catch(console.error);
    }
  }, [isOpen]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredProducts = products.filter(p => p.name.toLowerCase().includes(productType.toLowerCase()));

  if (!isOpen) return null;

  return (
    <div style={{
      position: "fixed",
      top: 0, left: 0, right: 0, bottom: 0,
      background: "rgba(15, 23, 42, 0.4)",
      backdropFilter: "blur(4px)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 1000,
      padding: "20px"
    }}>
      <div style={{
        background: "white",
        borderRadius: "16px",
        width: "100%",
        maxWidth: "500px",
        boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
        display: "flex",
        flexDirection: "column",
        maxHeight: "90vh",
        overflow: "hidden",
        animation: "slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)"
      }}>
        {/* Header */}
        <div style={{
          padding: "20px 24px",
          borderBottom: "1px solid #e2e8f0",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: "#f8fafc"
        }}>
          <div>
            <h2 style={{ fontSize: "18px", fontWeight: "700", color: "#0f172a", margin: 0 }}>Convert to Order</h2>
            <p style={{ fontSize: "13px", color: "#64748b", margin: "4px 0 0 0" }}>Set up the initial project details.</p>
          </div>
          <button 
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              color: "#94a3b8",
              cursor: "pointer",
              padding: "4px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "6px",
              transition: "all 0.2s"
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "#e2e8f0"; e.currentTarget.style.color = "#475569"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#94a3b8"; }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: "24px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "20px" }}>
          
          {/* Project Name */}
          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#475569", marginBottom: "8px" }}>
              Project Name <span style={{ color: "#ef4444" }}>*</span>
            </label>
            <input 
              type="text" 
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="e.g. Lobby Signage - Northstar"
              style={{
                width: "100%",
                padding: "10px 12px",
                border: "1px solid #cbd5e1",
                borderRadius: "8px",
                fontSize: "14px",
                color: "#0f172a",
                outline: "none",
                transition: "border-color 0.2s"
              }}
              onFocus={(e) => e.target.style.borderColor = "var(--color-primary)"}
              onBlur={(e) => e.target.style.borderColor = "#cbd5e1"}
            />
          </div>

          {/* Product Type */}
          <div ref={dropdownRef} style={{ position: "relative" }}>
            <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#475569", marginBottom: "8px" }}>
              Product Type / Sign Type
            </label>
            <div style={{ position: "relative" }}>
              <input 
                type="text" 
                value={productType}
                onChange={(e) => {
                  setProductType(e.target.value);
                  setShowDropdown(true);
                }}
                onFocus={() => setShowDropdown(true)}
                placeholder="Search or enter product..."
                style={{
                  width: "100%",
                  padding: "10px 12px 10px 36px",
                  border: "1px solid #cbd5e1",
                  borderRadius: "8px",
                  fontSize: "14px",
                  color: "#0f172a",
                  outline: "none",
                  transition: "border-color 0.2s"
                }}
              />
              <Search size={16} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
            </div>
            
            {showDropdown && (
              <div style={{
                position: "absolute",
                top: "100%",
                left: 0,
                right: 0,
                marginTop: "4px",
                background: "white",
                border: "1px solid #e2e8f0",
                borderRadius: "8px",
                boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
                maxHeight: "200px",
                overflowY: "auto",
                zIndex: 10
              }}>
                {filteredProducts.length > 0 ? (
                  filteredProducts.map((p) => (
                    <div
                      key={p.id}
                      onClick={() => {
                        setProductType(p.name);
                        setShowDropdown(false);
                      }}
                      style={{
                        padding: "10px 12px",
                        fontSize: "14px",
                        color: "#0f172a",
                        cursor: "pointer",
                        borderBottom: "1px solid #f1f5f9"
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = "#f8fafc"}
                      onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                    >
                      {p.name}
                    </div>
                  ))
                ) : (
                  <div style={{ padding: "10px 12px", fontSize: "14px", color: "#94a3b8", textAlign: "center" }}>
                    No products found matching "{productType}"
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Requirements */}
          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#475569", marginBottom: "8px" }}>
              Initial Requirements & Notes
            </label>
            <textarea 
              value={requirements}
              onChange={(e) => setRequirements(e.target.value)}
              placeholder="Mention any specific requirements, materials, or details for the team..."
              rows={3}
              style={{
                width: "100%",
                padding: "10px 12px",
                border: "1px solid #cbd5e1",
                borderRadius: "8px",
                fontSize: "14px",
                color: "#0f172a",
                outline: "none",
                resize: "vertical",
                transition: "border-color 0.2s"
              }}
              onFocus={(e) => e.target.style.borderColor = "var(--color-primary)"}
              onBlur={(e) => e.target.style.borderColor = "#cbd5e1"}
            />
          </div>

        </div>

        {/* Footer */}
        <div style={{
          padding: "16px 24px",
          borderTop: "1px solid #e2e8f0",
          background: "#f8fafc",
          display: "flex",
          justifyContent: "flex-end",
          gap: "12px"
        }}>
          <button 
            onClick={onClose}
            style={{
              padding: "10px 16px",
              background: "white",
              border: "1px solid #cbd5e1",
              borderRadius: "8px",
              color: "#475569",
              fontSize: "14px",
              fontWeight: "600",
              cursor: "pointer",
              transition: "all 0.2s"
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = "#f1f5f9"}
            onMouseLeave={(e) => e.currentTarget.style.background = "white"}
          >
            Cancel
          </button>
          <button 
            onClick={() => onSubmit(projectName, productType, requirements)}
            disabled={!projectName.trim()}
            style={{
              padding: "10px 16px",
              background: "var(--color-primary)",
              border: "1px solid var(--color-primary)",
              borderRadius: "8px",
              color: "white",
              fontSize: "14px",
              fontWeight: "600",
              cursor: projectName.trim() ? "pointer" : "not-allowed",
              opacity: projectName.trim() ? 1 : 0.6,
              transition: "all 0.2s"
            }}
          >
            Create Order
          </button>
        </div>
      </div>
      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
