"use client";

import React, { useState } from "react";
import { Search, Filter, Plus, MoreVertical, Users, Star, Clock, AlertCircle, Edit, Trash2, Briefcase, BarChart2, Key, X, RefreshCw } from "lucide-react";
import { Employee } from "@/types";
import { EmployeeModal } from "./EmployeeModal";
import {
  createEmployee as createEmployeeAction,
  updateEmployee as updateEmployeeAction,
  deleteEmployee as deleteEmployeeAction
} from "@/features/employees/actions/employeeActions";
import { adminResetUserPassword } from "@/features/auth/actions/authActions";

interface EmployeesViewNewProps {
  initialEmployees: Employee[];
  /** Tenant id — drives the available staff_role options in EmployeeModal. */
  companyId?: string | null;
}

export function EmployeesViewNew({ initialEmployees, companyId = null }: EmployeesViewNewProps) {
  const [employees, setEmployees] = useState<Employee[]>(initialEmployees);
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | undefined>(undefined);
  const [actionDropdownId, setActionDropdownId] = useState<string | null>(null);

  // Password reset state
  const [resetModalEmpId, setResetModalEmpId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [resetStatus, setResetStatus] = useState<"idle" | "saving" | "error" | "success">("idle");
  const [resetErrorMsg, setResetErrorMsg] = useState("");

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetModalEmpId) return;
    if (newPassword.length < 6) {
      setResetStatus("error");
      setResetErrorMsg("Password must be at least 6 characters");
      return;
    }
    
    setResetStatus("saving");
    try {
      const res = await adminResetUserPassword(resetModalEmpId, newPassword);
      if (res.error) {
        setResetStatus("error");
        setResetErrorMsg(res.error);
      } else {
        setResetStatus("success");
        setTimeout(() => {
          setResetModalEmpId(null);
          setNewPassword("");
          setResetStatus("idle");
        }, 1500);
      }
    } catch (err: any) {
      setResetStatus("error");
      setResetErrorMsg(err.message || "An error occurred");
    }
  };
  const handleEditEmployee = (emp: Employee) => {
    setEditingEmployee(emp);
    setIsModalOpen(true);
    setActionDropdownId(null);
  };

  const handleDeleteEmployee = async (id: string) => {
    if (confirm("Are you sure you want to delete this employee?")) {
      try {
        await deleteEmployeeAction(id);
        setEmployees(prev => prev.filter(e => e.id !== id));
      } catch (err) {
        console.error(err);
        alert("Failed to delete employee.");
      }
    }
    setActionDropdownId(null);
  };

  const handleModalSubmit = async (empData: Omit<Employee, "id">) => {
    try {
      if (editingEmployee) {
        const updates = {
          name: empData.name,
          staff_role: empData.role, // database uses column staff_role
          phone: empData.phone,
          email: empData.email
        };
        const result = await updateEmployeeAction(editingEmployee.id, updates);
        if (result && result[0]) {
          const mapped = {
            id: result[0].id,
            employeeId: result[0].employee_id,
            name: result[0].name,
            role: result[0].staff_role || "",
            phone: result[0].phone || "",
            email: result[0].email || "",
            status: result[0].status || "Active",
            rating: Number(result[0].rating) || 5.0,
            workload: Number(result[0].workload) || 0,
            jobsAssigned: editingEmployee ? editingEmployee.jobsAssigned : 0
          };
          setEmployees(prev => prev.map(e => e.id === editingEmployee.id ? mapped : e));
        }
      } else {
        const payload = {
          name: empData.name,
          staff_role: empData.role,
          phone: empData.phone,
          email: empData.email
        };
        const result = await createEmployeeAction(payload);
        if (result && result[0]) {
          const mapped = {
            id: result[0].id,
            employeeId: result[0].employee_id,
            name: result[0].name,
            role: result[0].staff_role || "",
            phone: result[0].phone || "",
            email: result[0].email || "",
            status: result[0].status || "Active",
            rating: Number(result[0].rating) || 5.0,
            workload: Number(result[0].workload) || 0,
            jobsAssigned: 0
          };
          setEmployees(prev => [mapped, ...prev]);
        }
      }
    } catch (err) {
      console.error(err);
      alert("Failed to save employee details.");
    }
    setIsModalOpen(false);
  };

  const totalEmployees = employees.length;
  const activeEmployees = employees.length;
  const activePercentage = totalEmployees > 0 ? Math.round((activeEmployees / totalEmployees) * 100) : 0;
  const totalJobsAssigned = employees.reduce((sum, emp) => sum + (emp.jobsAssigned || 0), 0);
  const avgJobsPerEmployee = totalEmployees > 0 ? (totalJobsAssigned / totalEmployees).toFixed(1) : "0";

  const stats = [
    {
      label: "TOTAL EMPLOYEES",
      value: totalEmployees.toString(),
      change: "All time",
      icon: Users,
      color: "#3b82f6",
    },
    {
      label: "ACTIVE NOW",
      value: activeEmployees.toString(),
      change: `${activePercentage}% of workforce`,
      icon: AlertCircle,
      color: "var(--color-primary)",
    },
    {
      label: "TOTAL JOBS",
      value: totalJobsAssigned.toString(),
      change: "Currently assigned",
      icon: Briefcase,
      color: "#f59e0b",
    },
    {
      label: "AVG JOBS / EMP",
      value: avgJobsPerEmployee,
      change: "Workload distribution",
      icon: BarChart2,
      color: "#06b6d4",
    },
  ];

  const filteredEmployees = employees.filter(emp => 
    emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.role.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (emp.employeeId && emp.employeeId.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div style={{ padding: "32px", background: "#f8fafc", minHeight: "100vh" }}>
      {/* Header Section */}
      <div style={{ marginBottom: "32px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px" }}>
          <div>
            <h1 style={{ fontSize: "28px", fontWeight: "800", color: "#0f172a", margin: "0 0 8px" }}>
              Employees Directory
            </h1>
            <p style={{ fontSize: "14px", color: "#64748b", margin: 0 }}>
              Monitor team members, assigned workloads, and performance ratings
            </p>
          </div>
        </div>

        {/* Stats Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "16px" }}>
          {stats.map((stat, idx) => {
            const Icon = stat.icon;
            return (
              <div
                key={idx}
                style={{
                  background: "white",
                  border: "1px solid #e2e8f0",
                  borderRadius: "12px",
                  padding: "20px",
                  transition: "all 0.3s",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.08)";
                  e.currentTarget.style.transform = "translateY(-2px)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = "none";
                  e.currentTarget.style.transform = "translateY(0)";
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
                  <span style={{ fontSize: "11px", fontWeight: "700", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    {stat.label}
                  </span>
                  <div style={{ width: "32px", height: "32px", background: `${stat.color}15`, borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Icon size={16} style={{ color: stat.color }} />
                  </div>
                </div>
                <div style={{ fontSize: "28px", fontWeight: "800", color: "#0f172a", marginBottom: "8px" }}>
                  {stat.value}
                </div>
                <div style={{ fontSize: "12px", color: "#64748b" }}>
                  {stat.change}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Table Section */}
      <div style={{ background: "white", borderRadius: "12px", border: "1px solid #e2e8f0", overflow: "visible" }}>
        {/* Search & Filter Bar */}
        <div style={{ padding: "20px", borderBottom: "1px solid #e2e8f0", display: "flex", gap: "12px", alignItems: "center" }}>
          <div style={{ flex: 1, position: "relative" }}>
            <Search size={16} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
            <input
              type="text"
              placeholder="Search by employee name, role or ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 12px 10px 36px",
                border: "1px solid #e2e8f0",
                borderRadius: "8px",
                fontSize: "13px",
                fontFamily: "inherit",
                transition: "all 0.2s",
              }}
            />
          </div>
          <button
            style={{
              padding: "10px 16px",
              background: "#f1f5f9",
              border: "1px solid #cbd5e1",
              borderRadius: "8px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              fontSize: "13px",
              fontWeight: "600",
              color: "#475569",
              transition: "all 0.2s",
            }}
          >
            <Filter size={16} /> Filters
          </button>
          
          {/* Reset Button */}
          <button
            title="Reset Filters"
            onClick={() => setSearchTerm("")}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "0 14px",
              background: "#fef2f2",
              border: "1px solid #fecaca",
              borderRadius: "8px",
              cursor: "pointer",
              color: "#dc2626",
              outline: "none",
              height: "39px",
              transition: "all 0.2s",
              fontWeight: "600",
              fontSize: "13px",
              gap: "6px",
              flexShrink: 0
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "#fee2e2"; e.currentTarget.style.borderColor = "#fca5a5"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "#fef2f2"; e.currentTarget.style.borderColor = "#fecaca"; }}
          >
            <RefreshCw size={14} />
            Reset
          </button>
        </div>

        {/* Table View */}
        <div style={{ overflow: "visible" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead style={{ position: "sticky", top: 0, background: "#f8fafc", zIndex: 10 }}>
              <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                <th style={{ padding: "14px 20px", textAlign: "left", fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", borderTopLeftRadius: "12px" }}>EMPLOYEE ID</th>
                <th style={{ padding: "14px 20px", textAlign: "left", fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>NAME</th>
                <th style={{ padding: "14px 20px", textAlign: "left", fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>ROLE</th>
                <th style={{ padding: "14px 20px", textAlign: "left", fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>PHONE</th>
                <th style={{ padding: "14px 20px", textAlign: "left", fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>EMAIL ID</th>
                <th style={{ padding: "14px 20px", textAlign: "left", fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>JOBS ASSIGNED</th>
                <th style={{ padding: "14px 20px", textAlign: "center", fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", borderTopRightRadius: "12px" }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {filteredEmployees.map((emp) => {
                return (
                  <tr key={emp.id} style={{ borderBottom: "1px solid #e2e8f0", transition: "background 0.2s" }} onMouseEnter={(e) => { e.currentTarget.style.background = "#f8fafc"; }} onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}>
                    <td style={{ padding: "16px 20px", fontSize: "13px", fontWeight: "700", color: "#0f172a" }}>{emp.employeeId || emp.id.substring(0, 8)}</td>
                    <td style={{ padding: "16px 20px", fontSize: "13px", fontWeight: "600", color: "#0f172a" }}>{emp.name}</td>
                    <td style={{ padding: "16px 20px", fontSize: "13px", color: "#64748b" }}>{emp.role}</td>
                    <td style={{ padding: "16px 20px", fontSize: "13px", color: "#0f172a" }}>{emp.phone}</td>
                    <td style={{ padding: "16px 20px", fontSize: "13px", color: "#0f172a" }}>{emp.email}</td>
                    <td style={{ padding: "16px 20px", fontSize: "13px", color: "#0f172a", fontWeight: "600" }}>
                      <span style={{ background: "#e0e7ff", color: "#4f46e5", padding: "4px 8px", borderRadius: "12px", fontSize: "12px" }}>
                        {emp.jobsAssigned || 0}
                      </span>
                    </td>
                    <td style={{ padding: "16px 20px", textAlign: "center", position: "relative" }}>
                      <button 
                        onClick={() => setActionDropdownId(actionDropdownId === emp.id ? null : emp.id)}
                        style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", padding: "4px 8px", transition: "all 0.2s" }} 
                      >
                        <MoreVertical size={16} />
                      </button>
                      
                      {actionDropdownId === emp.id && (
                        <>
                          <div 
                            style={{ position: "fixed", inset: 0, zIndex: 49 }} 
                            onClick={() => setActionDropdownId(null)} 
                          />
                          <div style={{ position: "absolute", right: "40px", top: "50%", transform: "translateY(-50%)", background: "white", border: "1px solid #e2e8f0", borderRadius: "8px", boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)", zIndex: 50, overflow: "hidden", minWidth: "120px" }}>
                            <button 
                              onClick={() => handleEditEmployee(emp)}
                              style={{ display: "flex", alignItems: "center", gap: "8px", width: "100%", padding: "10px 16px", background: "none", border: "none", borderBottom: "1px solid #f1f5f9", cursor: "pointer", fontSize: "13px", color: "#475569", textAlign: "left" }}
                            >
                              <Edit size={14} /> Edit
                            </button>
                            <button 
                              onClick={() => {
                                setResetModalEmpId(emp.id);
                                setActionDropdownId(null);
                              }}
                              style={{ display: "flex", alignItems: "center", gap: "8px", width: "100%", padding: "10px 16px", background: "none", border: "none", borderBottom: "1px solid #f1f5f9", cursor: "pointer", fontSize: "13px", color: "#f59e0b", textAlign: "left" }}
                            >
                              <Key size={14} /> Reset Password
                            </button>
                            <button 
                              onClick={() => handleDeleteEmployee(emp.id)}
                              style={{ display: "flex", alignItems: "center", gap: "8px", width: "100%", padding: "10px 16px", background: "none", border: "none", cursor: "pointer", fontSize: "13px", color: "#ef4444", textAlign: "left" }}
                            >
                              <Trash2 size={14} /> Delete
                            </button>
                          </div>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <EmployeeModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleModalSubmit}
        initialData={editingEmployee}
        companyId={companyId}
      />

      {/* Admin Reset Password Modal */}
      {resetModalEmpId && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0,0,0,0.4)", backdropFilter: "blur(2px)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100
        }}>
          <div style={{
            background: "white", borderRadius: "12px", width: "100%", maxWidth: "400px",
            boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)", padding: "24px"
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
              <h2 style={{ fontSize: "18px", fontWeight: "700", margin: 0 }}>Reset Password</h2>
              <button onClick={() => setResetModalEmpId(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b" }}>
                <X size={20} />
              </button>
            </div>
            <p style={{ fontSize: "13px", color: "#64748b", marginBottom: "16px" }}>
              You are manually setting a new password for this user.
            </p>
            <form onSubmit={handleResetPassword} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div>
                <label style={{ fontSize: "13px", fontWeight: "600", color: "#0f172a", marginBottom: "6px", display: "block" }}>New Password</label>
                <input 
                  type="text" 
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  style={{
                    width: "100%", padding: "10px 12px", border: "1px solid #e2e8f0", borderRadius: "8px", fontSize: "14px"
                  }}
                  required
                />
              </div>

              {resetStatus === "error" && (
                <div style={{ fontSize: "13px", color: "#ef4444", background: "#fef2f2", padding: "8px 12px", borderRadius: "6px" }}>
                  {resetErrorMsg}
                </div>
              )}
              {resetStatus === "success" && (
                <div style={{ fontSize: "13px", color: "#10b981", background: "#dcfce7", padding: "8px 12px", borderRadius: "6px" }}>
                  Password reset successfully!
                </div>
              )}

              <button 
                type="submit" 
                disabled={resetStatus === "saving" || resetStatus === "success"}
                style={{
                  width: "100%", padding: "12px", background: "#f59e0b", color: "white", border: "none",
                  borderRadius: "8px", fontSize: "14px", fontWeight: "600", cursor: "pointer", marginTop: "8px",
                  opacity: (resetStatus === "saving" || resetStatus === "success") ? 0.7 : 1
                }}
              >
                {resetStatus === "saving" ? "Updating..." : "Force Reset Password"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
