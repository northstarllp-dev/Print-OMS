import React, { useState, useEffect, useMemo } from "react";
import { X } from "lucide-react";
import { Employee } from "@/types";
import { getStaffRolesForTenant } from "@/features/orders/workspace/shared/stageGrants";

interface EmployeeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (employee: Omit<Employee, "id">) => void;
  initialData?: Employee;
  /** Tenant id — drives the available staff_role options. */
  companyId?: string | null;
}

export function EmployeeModal({ isOpen, onClose, onSubmit, initialData, companyId = null }: EmployeeModalProps) {
  const [name, setName] = useState("");
  const [role, setRole] = useState("Designer");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  // Tenant-aware role list. Falls back to default role keys when no tenant config.
  const roleOptions = useMemo(() => getStaffRolesForTenant(companyId), [companyId]);

  useEffect(() => {
    if (initialData) {
      setName(initialData.name);
      setRole(initialData.role);
      setPhone(initialData.phone);
      setEmail(initialData.email || "");
    } else {
      setName("");
      setRole(roleOptions[0] ?? "Designer");
      setPhone("");
      setEmail("");
    }
  }, [initialData, isOpen, roleOptions]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      name,
      role,
      phone,
      email,
    });
  };

  return (
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(15, 23, 42, 0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "20px" }}>
      <div style={{ background: "white", borderRadius: "16px", width: "100%", maxWidth: "480px", boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)", overflow: "hidden" }}>
        <div style={{ padding: "24px", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ margin: 0, fontSize: "18px", fontWeight: "700", color: "#0f172a" }}>
            {initialData ? "Edit Employee" : "Add New Employee"}
          </h2>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", padding: "4px", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "6px" }} onMouseEnter={(e) => e.currentTarget.style.background = "#f1f5f9"} onMouseLeave={(e) => e.currentTarget.style.background = "none"}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "20px" }}>
          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#475569", marginBottom: "6px" }}>Full Name</label>
            <input type="text" required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Amit Sharma" style={{ width: "100%", padding: "10px 12px", border: "1px solid #cbd5e1", borderRadius: "8px", fontSize: "14px", color: "#0f172a", outline: "none", transition: "border-color 0.2s" }} onFocus={(e) => e.currentTarget.style.borderColor = "var(--color-primary)"} onBlur={(e) => e.currentTarget.style.borderColor = "#cbd5e1"} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#475569", marginBottom: "6px" }}>Role</label>
              <select value={role} onChange={(e) => setRole(e.target.value)} style={{ width: "100%", padding: "10px 12px", border: "1px solid #cbd5e1", borderRadius: "8px", fontSize: "14px", color: "#0f172a", outline: "none", background: "white", cursor: "pointer" }}>
                {roleOptions.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
                {/* Keep the existing role selectable when editing a legacy employee whose role isn't in the tenant list */}
                {initialData && initialData.role && !roleOptions.includes(initialData.role) && (
                  <option value={initialData.role}>{initialData.role}</option>
                )}
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#475569", marginBottom: "6px" }}>Phone</label>
              <input type="text" required value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 9876543210" style={{ width: "100%", padding: "10px 12px", border: "1px solid #cbd5e1", borderRadius: "8px", fontSize: "14px", color: "#0f172a", outline: "none", transition: "border-color 0.2s" }} onFocus={(e) => e.currentTarget.style.borderColor = "var(--color-primary)"} onBlur={(e) => e.currentTarget.style.borderColor = "#cbd5e1"} />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "16px" }}>
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#475569", marginBottom: "6px" }}>Email ID</label>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="e.g. amit@printoms.com" style={{ width: "100%", padding: "10px 12px", border: "1px solid #cbd5e1", borderRadius: "8px", fontSize: "14px", color: "#0f172a", outline: "none", transition: "border-color 0.2s" }} onFocus={(e) => e.currentTarget.style.borderColor = "var(--color-primary)"} onBlur={(e) => e.currentTarget.style.borderColor = "#cbd5e1"} />
            </div>
          </div>

          <div style={{ marginTop: "12px", display: "flex", justifyContent: "flex-end", gap: "12px" }}>
            <button type="button" onClick={onClose} style={{ padding: "10px 16px", background: "none", border: "1px solid #cbd5e1", borderRadius: "8px", color: "#475569", fontSize: "14px", fontWeight: "600", cursor: "pointer" }}>
              Cancel
            </button>
            <button type="submit" style={{ padding: "10px 16px", background: "var(--color-primary)", border: "none", borderRadius: "8px", color: "white", fontSize: "14px", fontWeight: "600", cursor: "pointer", transition: "background 0.2s" }} onMouseEnter={(e) => e.currentTarget.style.background = "var(--color-primary-container)"} onMouseLeave={(e) => e.currentTarget.style.background = "var(--color-primary)"}>
              {initialData ? "Save Changes" : "Add Employee"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
