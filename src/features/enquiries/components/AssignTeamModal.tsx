import React, { useState, useEffect } from "react";
import { X, Users, CheckCircle2, ChevronRight, User } from "lucide-react";
import { fetchEmployeeStats, assignTeamToOrder } from "@/features/orders/actions/orderActions";
import {
  canStartAssignSubmit,
  isAssignSubmitDisabled,
  selectionSummaryLabel,
  toggleEmployeeSelection,
} from "@/features/enquiries/enquiryAssignLogic";

interface AssignTeamModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: string;
  onSuccess: () => void;
}

export function AssignTeamModal({ isOpen, onClose, orderId, onSuccess }: AssignTeamModalProps) {
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      setSelectedIds([]);
      fetchEmployeeStats()
        .then(data => {
          setEmployees(data);
          setLoading(false);
        })
        .catch(err => {
          console.error("Failed to fetch employee stats", err);
          setLoading(false);
        });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const toggleEmployee = (id: string) => {
    setSelectedIds((prev) => toggleEmployeeSelection(prev, id));
  };

  const handleSubmit = async () => {
    if (!canStartAssignSubmit(saving)) return;
    if (isAssignSubmitDisabled(selectedIds.length, saving)) return;
    try {
      setSaving(true);
      await assignTeamToOrder(orderId, selectedIds);
      setSaving(false);
      onSuccess();
    } catch (err) {
      console.error(err);
      setSaving(false);
      alert("Failed to assign team.");
    }
  };

  // All tenant staff roles (Designer, Recce & Installation, Production & Service, etc.)
  const visibleEmployees = employees;

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
        borderRadius: "20px",
        width: "100%",
        maxWidth: "520px",
        boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
        display: "flex",
        flexDirection: "column",
        maxHeight: "90vh",
        overflow: "hidden",
        animation: "slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)"
      }}>
        {/* Header */}
        <div style={{
          padding: "24px",
          borderBottom: "1px solid #f1f5f9",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}>
          <div>
            <h2 style={{ fontSize: "20px", fontWeight: "800", color: "#0f172a", margin: 0, display: "flex", alignItems: "center", gap: "10px", letterSpacing: "-0.02em" }}>
              <div style={{ background: "#eff6ff", padding: "8px", borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Users size={20} color="#3b82f6" />
              </div>
              Assign Employees
            </h2>
            <p style={{ fontSize: "14px", color: "#64748b", margin: "6px 0 0 0", fontWeight: "500" }}>
              Select one or more employees to assign to this order.
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "transparent", border: "none", color: "#94a3b8",
              cursor: "pointer", padding: "6px", display: "flex", alignItems: "center",
              justifyContent: "center", borderRadius: "8px", transition: "all 0.2s ease"
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "#f1f5f9"; e.currentTarget.style.color = "#475569"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#94a3b8"; }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: "20px 24px", overflowY: "auto", flex: 1, background: "#f8fafc" }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: "40px", color: "#64748b", fontSize: "14px", fontWeight: "500" }}>
              Loading staff availability...
            </div>
          ) : visibleEmployees.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px", background: "white", borderRadius: "16px", border: "1px dashed #cbd5e1" }}>
              <User size={32} color="#cbd5e1" style={{ margin: "0 auto 12px auto" }} />
              <h3 style={{ fontSize: "16px", fontWeight: "700", color: "#334155", margin: "0 0 4px 0" }}>No assignable employees</h3>
              <p style={{ fontSize: "13px", color: "#64748b", margin: 0 }}>There are no Designers or Marketers in the system.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {visibleEmployees.map(emp => {
                const isSelected = selectedIds.includes(emp.id);
                return (
                  <div
                    key={emp.id}
                    onClick={() => toggleEmployee(emp.id)}
                    style={{
                      padding: "14px 16px",
                      background: isSelected ? "#eff6ff" : "white",
                      border: isSelected ? "1px solid #bfdbfe" : "1px solid #e2e8f0",
                      borderRadius: "14px",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "14px",
                      transition: "all 0.2s ease",
                      boxShadow: isSelected ? "0 4px 6px -1px rgba(59, 130, 246, 0.1)" : "0 1px 2px 0 rgba(0,0,0,0.05)"
                    }}
                    onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.borderColor = "#cbd5e1"; }}
                    onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.borderColor = "#e2e8f0"; }}
                  >
                    {/* Avatar */}
                    <div style={{
                      width: "40px", height: "40px", borderRadius: "50%", flexShrink: 0,
                      background: isSelected ? "#3b82f6" : "#f1f5f9",
                      color: isSelected ? "white" : "#475569",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: "16px", fontWeight: "700"
                    }}>
                      {emp.name.charAt(0).toUpperCase()}
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: "14px", fontWeight: "700", color: "#0f172a" }}>{emp.name}</div>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "4px", flexWrap: "wrap" }}>
                        {emp.staff_role && (
                          <span style={{ fontSize: "11px", fontWeight: "600", color: "#475569", background: "#f1f5f9", padding: "2px 7px", borderRadius: "8px" }}>
                            {emp.staff_role}
                          </span>
                        )}
                        <span style={{
                          fontSize: "11px", fontWeight: "700", padding: "2px 8px", borderRadius: "10px",
                          background: emp.activeJobs > 0 ? "#fffbeb" : "#f1f5f9",
                          color: emp.activeJobs > 0 ? "#b45309" : "#64748b"
                        }}>
                          {emp.activeJobs} {emp.activeJobs === 1 ? "active job" : "active jobs"}
                        </span>
                      </div>
                    </div>

                    {/* Checkbox */}
                    <div style={{
                      width: "22px", height: "22px", borderRadius: "6px", flexShrink: 0,
                      border: isSelected ? "none" : "2px solid #cbd5e1",
                      background: isSelected ? "#3b82f6" : "transparent",
                      display: "flex", alignItems: "center", justifyContent: "center"
                    }}>
                      {isSelected && <CheckCircle2 size={16} color="white" />}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: "18px 24px",
          borderTop: "1px solid #f1f5f9",
          background: "white",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center"
        }}>
          <div style={{ fontSize: "13px", color: "#64748b", fontWeight: "500" }}>
            <span style={{ color: selectedIds.length > 0 ? "#3b82f6" : undefined, fontWeight: selectedIds.length > 0 ? "600" : "500" }}>
              {selectionSummaryLabel(selectedIds.length)}
            </span>
          </div>
          <button
            onClick={handleSubmit}
            disabled={isAssignSubmitDisabled(selectedIds.length, saving)}
            style={{
              padding: "11px 22px",
              background: "#1E40AF",
              border: "none",
              borderRadius: "12px",
              color: "white",
              fontSize: "14px",
              fontWeight: "700",
              cursor: isAssignSubmitDisabled(selectedIds.length, saving) ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              opacity: isAssignSubmitDisabled(selectedIds.length, saving) ? 0.6 : 1,
              transition: "all 0.2s ease",
              boxShadow: "0 4px 6px -1px rgba(30, 64, 175, 0.2)"
            }}
            onMouseEnter={(e) => { if (!isAssignSubmitDisabled(selectedIds.length, saving)) { e.currentTarget.style.background = "#1e3a8a"; e.currentTarget.style.transform = "translateY(-1px)"; } }}
            onMouseLeave={(e) => { if (!isAssignSubmitDisabled(selectedIds.length, saving)) { e.currentTarget.style.background = "#1E40AF"; e.currentTarget.style.transform = "translateY(0)"; } }}
          >
            {saving ? "Saving..." : "Save Assignments"}
            {!saving && <ChevronRight size={16} />}
          </button>
        </div>
      </div>
    </div>
  );
}
