"use client";

import React, { useState } from "react";
import { Search, Plus, MoreVertical, Users, Star, Clock, AlertCircle, Edit, Trash2, Briefcase, BarChart2, Key, X, RefreshCw, Shield, Ban, CircleCheck } from "lucide-react";
import { Employee } from "@/types";
import { EmployeeModal } from "./EmployeeModal";
import {
  createEmployee as createEmployeeAction,
  updateEmployee as updateEmployeeAction,
  deleteEmployee as deleteEmployeeAction,
  setEmployeeStatus as setEmployeeStatusAction,
} from "@/features/employees/actions/employeeActions";
import { adminResetUserPassword } from "@/features/auth/actions/authActions";
import { useRouter } from "next/navigation";

interface EmployeesViewNewProps {
  initialEmployees: Employee[];
  /** Tenant id — drives the available staff_role options in EmployeeModal. */
  companyId?: string | null;
  /** Admin-only: show Directory / Roles tabs inside Employees. */
  showRolesTab?: boolean;
  initialTab?: "directory" | "roles";
}

export function EmployeesViewNew({
  initialEmployees,
  companyId = null,
  showRolesTab = false,
  initialTab = "directory",
}: EmployeesViewNewProps) {
  const router = useRouter();
  const [activeTab, setActiveTabState] = useState<"directory" | "roles">(
    showRolesTab && initialTab === "roles" ? "roles" : "directory"
  );

  const setActiveTab = (tab: "directory" | "roles") => {
    setActiveTabState(tab);
    if (!showRolesTab) return;
    router.replace(tab === "roles" ? "/admin/employees?tab=roles" : "/admin/employees");
  };

  const [employees, setEmployees] = useState<Employee[]>(initialEmployees);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "Active" | "Inactive">("ALL");
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
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

  const handleToggleFreeze = async (emp: Employee) => {
    const nextStatus = emp.status === "Inactive" ? "Active" : "Inactive";
    const label = nextStatus === "Inactive" ? "freeze" : "reactivate";
    if (!confirm(`Are you sure you want to ${label} ${emp.name}?`)) {
      setActionDropdownId(null);
      return;
    }
    try {
      const result = await setEmployeeStatusAction(emp.id, nextStatus);
      setEmployees((prev) =>
        prev.map((e) =>
          e.id === emp.id ? { ...e, status: result.status || nextStatus } : e
        )
      );
    } catch (err: any) {
      console.error(err);
      alert(err?.message || `Failed to ${label} employee.`);
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

  const filteredEmployees = employees.filter((emp) => {
    const status = emp.status || "Active";
    if (statusFilter !== "ALL" && status !== statusFilter) return false;
    const q = searchTerm.toLowerCase();
    if (!q) return true;
    return (
      emp.name.toLowerCase().includes(q) ||
      emp.role.toLowerCase().includes(q) ||
      emp.id.toLowerCase().includes(q) ||
      (!!emp.employeeId && emp.employeeId.toLowerCase().includes(q))
    );
  });

  const resetFilters = () => {
    setSearchTerm("");
    setStatusFilter("ALL");
  };

  const activeFilterCount = [statusFilter !== "ALL"].filter(Boolean).length;

  return (
    <div className="p-3 sm:p-4 md:p-8 bg-slate-50 min-h-0 pb-6">
      {/* Header Section */}
      <div className="mb-5 md:mb-8">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4 md:mb-6">
          <div className="min-w-0 flex-1">
            <h1 className="text-xl sm:text-2xl md:text-[28px] font-extrabold text-slate-900 m-0 mb-1 md:mb-2">
              Employees Directory
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 m-0">
              Monitor team members, assigned workloads, and performance ratings
            </p>
          </div>
        </div>

        {showRolesTab && (
          <div className="mb-4 md:mb-6 inline-flex w-full sm:w-auto rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
            <button
              type="button"
              onClick={() => setActiveTab("directory")}
              className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-[12px] font-bold transition-colors ${
                activeTab === "directory"
                  ? "bg-[var(--color-primary,#1E40AF)] text-white"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              Employees
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("roles")}
              className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-[12px] font-bold transition-colors inline-flex items-center justify-center gap-1.5 ${
                activeTab === "roles"
                  ? "bg-[var(--color-primary,#1E40AF)] text-white"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              <Shield size={13} />
              Roles
            </button>
          </div>
        )}

        {activeTab === "directory" && (
          <>
        {/* Mobile KPI chips */}
        <div className="lg:hidden flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="shrink-0 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold border border-slate-200 bg-white text-slate-500"
            >
              <span>{stat.label}</span>
              <span className="inline-flex min-w-[1.25rem] items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-extrabold bg-slate-100 text-slate-600">
                {stat.value}
              </span>
            </div>
          ))}
        </div>

        {/* Desktop Stats Cards */}
        <div className="hidden lg:grid grid-cols-2 xl:grid-cols-4 gap-4">
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
          </>
        )}
      </div>

      {activeTab === "roles" ? (
        <div className="flex items-center justify-center py-10 sm:py-16">
          <div className="w-full max-w-lg text-center bg-white border border-slate-200 rounded-2xl px-6 py-12 sm:px-10 shadow-sm">
            <div className="mx-auto mb-5 w-14 h-14 rounded-2xl bg-[rgba(30,64,175,0.08)] flex items-center justify-center">
              <Shield size={26} className="text-[var(--color-primary,#1E40AF)]" />
            </div>
            <p className="m-0 mb-2 text-[11px] font-extrabold uppercase tracking-[0.14em] text-[var(--color-primary,#1E40AF)]">
              Coming soon
            </p>
            <h2 className="m-0 mb-3 text-xl sm:text-2xl font-extrabold text-slate-900">
              Roles & Permissions
            </h2>
            <p className="m-0 text-sm text-slate-500 leading-relaxed">
              Control who can approve Design, Production, and other stage gates with finer access rules.
            </p>
          </div>
        </div>
      ) : (
      <>

      {/* Table Section */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-visible">
        {/* Search & Filter Bar */}
        <div className="p-3 sm:p-4 border-b border-slate-200">
          {/* Mobile / tablet: search + Filters + Reset */}
          <div className="lg:hidden flex items-center gap-2">
            <div className="relative flex-1 min-w-0">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Search employees…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-[34px] pr-8 py-2.5 border border-slate-200 rounded-full text-[13px] outline-none focus:border-[var(--color-primary)] bg-slate-50"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                >
                  <X size={14} />
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => setMobileFiltersOpen(true)}
              className={`relative shrink-0 inline-flex items-center gap-1.5 h-10 px-3.5 rounded-full border text-[12px] font-bold transition-colors ${
                activeFilterCount > 0
                  ? "bg-slate-900 text-white border-slate-900"
                  : "bg-white text-slate-700 border-slate-200"
              }`}
            >
              <Filter size={14} />
              Filters
              {activeFilterCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[var(--color-primary)] text-white text-[10px] font-extrabold flex items-center justify-center border-2 border-white">
                  {activeFilterCount}
                </span>
              )}
            </button>
            <button
              type="button"
              title="Reset filters"
              onClick={resetFilters}
              className="shrink-0 w-10 h-10 inline-flex items-center justify-center rounded-full bg-red-50 border border-red-200 text-red-600"
            >
              <RefreshCw size={14} />
            </button>
          </div>

          {mobileFiltersOpen && (
            <div className="lg:hidden fixed inset-0 z-[80]">
              <button
                type="button"
                aria-label="Close filters"
                className="absolute inset-0 bg-slate-900/40"
                onClick={() => setMobileFiltersOpen(false)}
              />
              <div className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-2xl bg-white shadow-xl">
                <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-white rounded-t-2xl">
                  <h3 className="text-sm font-extrabold text-slate-900">Filters</h3>
                  <button
                    type="button"
                    onClick={() => setMobileFiltersOpen(false)}
                    className="w-8 h-8 inline-flex items-center justify-center rounded-full bg-slate-100 text-slate-500"
                  >
                    <X size={16} />
                  </button>
                </div>
                <div className="p-4 space-y-4">
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Status</label>
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value as "ALL" | "Active" | "Inactive")}
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-medium text-slate-700"
                    >
                      <option value="ALL">All statuses</option>
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                  </div>
                </div>
                <div className="sticky bottom-0 flex gap-2 px-4 py-3 border-t border-slate-100 bg-white pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="flex-1 h-10 inline-flex items-center justify-center gap-1.5 rounded-xl bg-red-50 border border-red-200 text-red-600 text-[13px] font-bold"
                  >
                    <RefreshCw size={14} /> Reset
                  </button>
                  <button
                    type="button"
                    onClick={() => setMobileFiltersOpen(false)}
                    className="flex-1 h-10 inline-flex items-center justify-center rounded-xl bg-slate-900 text-white text-[13px] font-bold"
                  >
                    Apply
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Desktop: inline filters */}
          <div className="hidden lg:flex flex-nowrap gap-2 items-center">
            <div className="relative flex-1 min-w-[12rem]">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Search by employee name, role or ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full py-2.5 pl-9 pr-3 border border-slate-200 rounded-lg text-[13px] outline-none"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as "ALL" | "Active" | "Inactive")}
              className="shrink-0 px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-[13px] font-semibold text-slate-600"
              aria-label="Filter by status"
            >
              <option value="ALL">All statuses</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
            <button
              title="Reset Filters"
              type="button"
              onClick={resetFilters}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 h-[39px] bg-red-50 border border-red-200 rounded-lg text-red-600 font-semibold text-[13px] shrink-0"
            >
              <RefreshCw size={14} />
              Reset
            </button>
          </div>
        </div>

        {/* Mobile cards */}
        <div className="lg:hidden p-3 space-y-2.5 min-h-[200px] bg-slate-50/80">
          {filteredEmployees.length === 0 ? (
            <div className="py-12 px-4 text-center text-sm text-slate-500 font-medium bg-white rounded-xl border border-slate-200">
              No employees found.
            </div>
          ) : (
            filteredEmployees.map((emp) => (
              <div
                key={emp.id}
                className={`rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden ${
                  emp.status === "Inactive" ? "opacity-75" : ""
                }`}
              >
                <div className="flex">
                  <div
                    className={`w-1 shrink-0 self-stretch ${
                      emp.status === "Inactive" ? "bg-slate-400" : "bg-[var(--color-primary)]"
                    }`}
                    aria-hidden
                  />
                  <div className="flex-1 min-w-0 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-[12px] font-bold text-slate-500">
                          {emp.employeeId || emp.id.substring(0, 8)}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 min-w-0">
                          <div className="text-[14px] font-extrabold text-slate-900 truncate">{emp.name}</div>
                          {emp.status === "Inactive" && (
                            <span className="shrink-0 text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                              Frozen
                            </span>
                          )}
                        </div>
                        <div className="text-[12px] text-slate-500 mt-0.5">{emp.role}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteEmployee(emp.id)}
                        className="p-1.5 text-slate-400 hover:text-red-500 shrink-0"
                        title="Delete"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>

                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleEditEmployee(emp)}
                        className="flex-1 min-w-0 inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 py-2 text-[12px] font-bold text-slate-700"
                      >
                        <Edit size={13} className="shrink-0" /> Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => setResetModalEmpId(emp.id)}
                        className="flex-1 min-w-0 inline-flex items-center justify-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2 py-2 text-[12px] font-bold text-amber-600"
                      >
                        <Key size={13} className="shrink-0" /> Reset
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleFreeze(emp)}
                        className={`flex-1 min-w-0 inline-flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-[12px] font-bold ${
                          emp.status === "Inactive"
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : "border-slate-300 bg-slate-50 text-slate-700"
                        }`}
                      >
                        {emp.status === "Inactive" ? (
                          <><CircleCheck size={13} className="shrink-0" /> Activate</>
                        ) : (
                          <><Ban size={13} className="shrink-0" /> Freeze</>
                        )}
                      </button>
                    </div>

                    <div className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-500">
                      <span>{emp.phone || "—"}</span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-semibold">
                        {emp.jobsAssigned || 0} jobs
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Desktop Table View */}
        <div className="hidden lg:block overflow-x-auto">
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "800px" }}>
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
                const isInactive = emp.status === "Inactive";
                return (
                  <tr
                    key={emp.id}
                    style={{
                      borderBottom: "1px solid #e2e8f0",
                      transition: "background 0.2s",
                      opacity: isInactive ? 0.72 : 1,
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "#f8fafc"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                  >
                    <td style={{ padding: "16px 20px", fontSize: "13px", fontWeight: "700", color: "#0f172a" }}>{emp.employeeId || emp.id.substring(0, 8)}</td>
                    <td style={{ padding: "16px 20px", fontSize: "13px", fontWeight: "600", color: "#0f172a" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span>{emp.name}</span>
                        {isInactive && (
                          <span style={{ fontSize: "9px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.04em", padding: "2px 6px", borderRadius: "999px", background: "#f1f5f9", color: "#475569", border: "1px solid #e2e8f0" }}>
                            Frozen
                          </span>
                        )}
                      </div>
                    </td>
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
                          <div style={{ position: "absolute", right: "40px", top: "50%", transform: "translateY(-50%)", background: "white", border: "1px solid #e2e8f0", borderRadius: "8px", boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)", zIndex: 50, overflow: "hidden", minWidth: "168px", whiteSpace: "nowrap" }}>
                            <button 
                              onClick={() => handleEditEmployee(emp)}
                              style={{ display: "flex", alignItems: "center", gap: "8px", width: "100%", padding: "10px 16px", background: "none", border: "none", borderBottom: "1px solid #f1f5f9", cursor: "pointer", fontSize: "13px", color: "#475569", textAlign: "left", whiteSpace: "nowrap" }}
                            >
                              <Edit size={14} className="shrink-0" /> Edit
                            </button>
                            <button 
                              onClick={() => {
                                setResetModalEmpId(emp.id);
                                setActionDropdownId(null);
                              }}
                              style={{ display: "flex", alignItems: "center", gap: "8px", width: "100%", padding: "10px 16px", background: "none", border: "none", borderBottom: "1px solid #f1f5f9", cursor: "pointer", fontSize: "13px", color: "#f59e0b", textAlign: "left", whiteSpace: "nowrap" }}
                            >
                              <Key size={14} className="shrink-0" /> Reset Password
                            </button>
                            <button
                              onClick={() => handleToggleFreeze(emp)}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "8px",
                                width: "100%",
                                padding: "10px 16px",
                                background: "none",
                                border: "none",
                                borderBottom: "1px solid #f1f5f9",
                                cursor: "pointer",
                                fontSize: "13px",
                                color: isInactive ? "#059669" : "#475569",
                                textAlign: "left",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {isInactive ? <CircleCheck size={14} className="shrink-0" /> : <Ban size={14} className="shrink-0" />}
                              {isInactive ? "Reactivate" : "Freeze"}
                            </button>
                            <button 
                              onClick={() => handleDeleteEmployee(emp.id)}
                              style={{ display: "flex", alignItems: "center", gap: "8px", width: "100%", padding: "10px 16px", background: "none", border: "none", cursor: "pointer", fontSize: "13px", color: "#ef4444", textAlign: "left", whiteSpace: "nowrap" }}
                            >
                              <Trash2 size={14} className="shrink-0" /> Delete
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
      </>
      )}

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
