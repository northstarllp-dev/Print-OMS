"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { 
  Search,
  Filter,
  ChevronDown,
  TrendingUp,
  Clock,
  AlertCircle,
  Eye,
  Trash2,
  X,
  Briefcase,
  AlertTriangle,
  CheckCircle,
  Calendar,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
} from "lucide-react";
import { updateOrder, assignTeamToOrder } from "@/features/orders/actions/orderActions";
import { loadClientConfig } from "@/config/loadClientConfig";
import { parseOrderStage } from "@/features/orders/workspace/shared/stageGrants";
import {
  countQueueViews,
  partitionQueueOrdersByView,
  queueHasIncomingTab,
} from "@/features/orders/workspace/shared/staffQueueStages";
import { QueueViewToggle } from "./QueueViewToggle";
import type { QueueView } from "@/features/orders/workspace/shared/staffQueueStages";

const getStatusColor = (status: string) => {
  const colors: Record<string, { bg: string; text: string; label: string }> = {
    "Site Visit Pending":     { bg: "var(--secondary-fixed)", text: "var(--color-secondary)", label: "Site Visit Pending" },
    "Site Visit Scheduled":   { bg: "var(--secondary-fixed)", text: "var(--color-secondary)", label: "Site Visit Scheduled" },
    "Site Visit Completed":   { bg: "var(--secondary-fixed)", text: "var(--color-secondary)", label: "Site Visit Completed" },
    "Quotation In Progress":  { bg: "#fef3c7", text: "#F97316", label: "Quotation In Progress" },
    "Quotation Sent":         { bg: "#fef3c7", text: "#F97316", label: "Quotation Sent" },
    "Quotation Negotiation":  { bg: "#fef3c7", text: "#F97316", label: "Quotation Negotiation" },
    "Quotation Approved":     { bg: "#fef3c7", text: "#F97316", label: "Quotation Approved" },
    "Design In Progress":     { bg: "#f3e8ff", text: "#a855f7", label: "Design In Progress" },
    "Design Approved":        { bg: "#f3e8ff", text: "#a855f7", label: "Design Approved" },
    "Production":             { bg: "#dbeafe", text: "#0284c7", label: "Production" },
    "Ready For Installation": { bg: "#dbeafe", text: "#0284c7", label: "Ready For Installation" },
    "Installation Scheduled": { bg: "#dbeafe", text: "#0284c7", label: "Installation Scheduled" },
    "Completed":              { bg: "#dcfce7", text: "#22c55e", label: "Completed" },
    "Closed":                 { bg: "#dcfce7", text: "#22c55e", label: "Closed" },
  };
  return colors[status] || { bg: "#f1f5f9", text: "#64748b", label: status };
};

const getHealthBadgeColor = (health: string) => {
  const colors: Record<string, string> = {
    "Active": "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
    "On Hold": "bg-amber-500/10 text-amber-600 border-amber-500/20",
    "Lost": "bg-rose-500/10 text-rose-600 border-rose-500/20",
    "Cancelled": "bg-slate-500/10 text-slate-600 border-slate-500/20",
    "Completed": "bg-indigo-500/10 text-indigo-600 border-indigo-500/20",
  };
  return colors[health] || "bg-slate-100 text-slate-600 border-slate-200";
};

export function OrdersManagementDashboard({ 
  initialOrders,
  initialCustomers,
  initialEmployees,
  initialEnquiries,
  userRole,
  currentEmployeeName,
  orderDetailBasePath,
  entryStage,
  currentUserId,
  hideTitle,
  title,
  subtitle,
}: { 
  initialOrders: any[];
  initialCustomers: any[];
  initialEmployees: any[];
  initialEnquiries: any[];
  userRole: "Admin" | "Employee";
  currentEmployeeName: string;
  /** Base path for order detail links (e.g. `/staff/orders`). Defaults by role. */
  orderDetailBasePath?: string;
  /** Optional current user ID for admin assigned filter */
  currentUserId?: string;
  /** Optional entryStage query param (e.g. staff queue lock). */
  entryStage?: string;
  /** Hides the default "Orders Management" title header if true */
  hideTitle?: boolean;
  /** Custom override for the main heading */
  title?: string;
  /** Custom override for the subtitle */
  subtitle?: string;
}) {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [orders, setOrders] = useState(initialOrders);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [stageFilter, setStageFilter] = useState("ALL");
  const [healthFilter, setHealthFilter] = useState("ALL");
  const [adminAssignedFilter, setAdminAssignedFilter] = useState<"ALL" | "MINE">("MINE");
  const [selectedKpi, setSelectedKpi] = useState<string | null>(null);
  const clientConfig = loadClientConfig();
  const parsedEntryStage = parseOrderStage(entryStage);
  const [queueView, setQueueView] = useState<QueueView>("current");
  
  // Custom Date Range Filter
  const [dateFilterType, setDateFilterType] = useState<"all" | "range">("range");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Debounce search — 220 ms
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchTerm.trim().toLowerCase()), 220);
    return () => clearTimeout(t);
  }, [searchTerm]);

  useEffect(() => {
    setOrders(initialOrders);
  }, [initialOrders]);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    router.refresh();
    setTimeout(() => setIsRefreshing(false), 600);
  }, [router]);
  
  const currentUserRole = userRole;

  const resolveOrderHref = useCallback(
    (order: { orderId?: string; id: string }) => {
      const basePath =
        orderDetailBasePath ??
        (currentUserRole === "Admin" ? "/admin/orders" : "/staff/orders");
      const base = `${basePath}/${order.orderId || order.id}`;
      return entryStage ? `${base}?entryStage=${entryStage}` : base;
    },
    [orderDetailBasePath, entryStage, currentUserRole]
  );
  const employeeName = currentEmployeeName;
  const currentEmployeeObj = initialEmployees.find(e => e.name === employeeName || e.email === employeeName || e.id === employeeName);
  const currentEmployeeId = currentEmployeeObj?.id || employeeName;
  const customers = initialCustomers;
  const employees = initialEmployees;
  const enquiries = initialEnquiries;

  const queueViewCounts = useMemo(() => {
    if (!parsedEntryStage) return { incoming: 0, current: 0, completed: 0 };
    return countQueueViews(orders, parsedEntryStage);
  }, [orders, parsedEntryStage]);

  const queueScopedOrders = useMemo(() => {
    if (!parsedEntryStage) return orders;
    return partitionQueueOrdersByView(orders, parsedEntryStage, queueView);
  }, [orders, parsedEntryStage, queueView]);
  
  // State for right assignment panel
  const [assignPanelOrderId, setAssignPanelOrderId] = useState<string | null>(null);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  
  // State for options dropdown
  const [optionsOrderId, setOptionsOrderId] = useState<string | null>(null);
  
  const assignEmployeesToOrderLocal = async (orderId: string, assigned: string[]) => {
    // Optimistic UI update
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, assignedEmployees: assigned } : o));
    // Server mutation — write to order_assignments table
    try {
      await assignTeamToOrder(orderId, assigned);
    } catch (err) {
      console.error(err);
      alert("Failed to assign employees.");
    }
  };

  // Calculations for Admin
  const activeOrders = orders.filter(o => o.stage !== "Completed" && o.stage !== "Closed").length;
  const unassignedOrders = orders.filter(o => o.stage !== "Completed" && o.stage !== "Closed" && (!o.assignedEmployees || o.assignedEmployees.length === 0)).length;
  const pendingApprovals = orders.filter(o => o.stageStatus && o.stageStatus !== "Normal").length;
  const completedOrders = orders.filter(o => o.stage === "Completed" || o.stage === "Closed").length;

  // Calculations for Staff
  const myActiveOrders = orders.filter(o => o.stage !== "Completed" && o.stage !== "Closed" && (o.assignedEmployees.includes(employeeName) || o.assignedEmployees.includes(currentEmployeeId))).length;
  const myCompletedOrders = orders.filter(o => (o.stage === "Completed" || o.stage === "Closed") && (o.assignedEmployees.includes(employeeName) || o.assignedEmployees.includes(currentEmployeeId))).length;

  const stats = currentUserRole === "Employee" ? [
    {
      label: "ASSIGNED TO ME",
      value: myActiveOrders.toString(),
      change: "Active projects in your queue",
      filterKey: "myactive",
      icon: Briefcase,
      color: "var(--color-secondary)",
    },
    {
      label: "MY COMPLETED",
      value: myCompletedOrders.toString(),
      change: "All-time completed orders",
      filterKey: "mycompleted",
      icon: CheckCircle,
      color: "#22c55e",
    },
  ] : [
    {
      label: "TOTAL ACTIVE",
      value: activeOrders.toString(),
      change: "Current orders in pipeline",
      filterKey: "active",
      icon: TrendingUp,
      color: "var(--color-primary)",
    },
    {
      label: "UNASSIGNED",
      value: unassignedOrders.toString(),
      change: "Needs team assignment",
      filterKey: "unassigned",
      icon: AlertTriangle,
      color: "#ef4444",
    },
    {
      label: "APPROVALS REQ.",
      value: pendingApprovals.toString(),
      change: "Pending admin review",
      filterKey: "approvals",
      icon: AlertCircle,
      color: "#F97316",
    },
    {
      label: "COMPLETED",
      value: completedOrders.toString(),
      change: "All-time completed orders",
      filterKey: "completed",
      icon: CheckCircle,
      color: "#22c55e",
    },
  ];

  const getKpiFilteredOrders = () => {
    if (selectedKpi === "active")       return queueScopedOrders.filter(o => o.stage !== "Completed" && o.stage !== "Closed");
    if (selectedKpi === "unassigned")   return queueScopedOrders.filter(o => o.stage !== "Completed" && o.stage !== "Closed" && (!o.assignedEmployees || o.assignedEmployees.length === 0));
    if (selectedKpi === "approvals")    return queueScopedOrders.filter(o => o.stageStatus && o.stageStatus !== "Normal");
    if (selectedKpi === "completed")    return queueScopedOrders.filter(o => o.stage === "Completed" || o.stage === "Closed");
    if (selectedKpi === "myactive")     return queueScopedOrders.filter(o => o.stage !== "Completed" && o.stage !== "Closed" && (o.assignedEmployees?.includes(employeeName) || o.assignedEmployees?.includes(currentEmployeeId)));
    if (selectedKpi === "mycompleted")  return queueScopedOrders.filter(o => (o.stage === "Completed" || o.stage === "Closed") && (o.assignedEmployees?.includes(employeeName) || o.assignedEmployees?.includes(currentEmployeeId)));
    return null;
  };

  const kpiFilteredOrders = getKpiFilteredOrders();

  const filteredOrders = (kpiFilteredOrders ?? queueScopedOrders).filter(order => {
    if (debouncedSearch) {
      const q = debouncedSearch;
      // Resolve customer name from customers list
      const cust = customers.find((c: any) => c.id === order.customerId);
      const custName = (cust?.name || order.customerName || "").toLowerCase();
      const matches =
        (order.clientName || "").toLowerCase().includes(q) ||
        (order.businessName || "").toLowerCase().includes(q) ||
        (order.orderCode || order.id || "").toLowerCase().includes(q) ||
        custName.includes(q);
      if (!matches) return false;
    }

    if (dateFilterType === "range") {
      const orderDate = order.dateCreated
        ? new Date(order.dateCreated).toISOString().split("T")[0]
        : null;
      if (!orderDate) return false;
      if (startDate && orderDate < startDate) return false;
      if (endDate && orderDate > endDate) return false;
    }

    if (stageFilter !== "ALL") {
      const s = order.stage || "";
      if (stageFilter === "Site Visit" && !s.includes("Site Visit")) return false;
      if (stageFilter === "Quotation" && !s.includes("Quotation")) return false;
      if (stageFilter === "Designing" && !s.includes("Design")) return false;
      if (stageFilter === "Production" && s !== "Production") return false;
      if (stageFilter === "Installation" && !s.includes("Installation")) return false;
      if (stageFilter === "Completed" && !["Completed", "Closed"].includes(s)) return false;
    }
    if (healthFilter !== "ALL" && (order.health || "Active") !== healthFilter) return false;

    if (currentUserRole === "Employee" && !kpiFilteredOrders) {
      return order.assignedEmployees?.includes(employeeName) || order.assignedEmployees?.includes(currentEmployeeId);
    }
    
    if (currentUserRole === "Admin" && adminAssignedFilter === "MINE") {
      if (!currentUserId) return false;
      return order.assignedAdmins?.includes(currentUserId);
    }

    return true;
  });

  const resetFilters = () => {
    setDateFilterType("range");
    setStartDate("");
    setEndDate("");
    setStageFilter("ALL");
    setHealthFilter("ALL");
    setAdminAssignedFilter("MINE");
    setSearchTerm("");
    setSelectedKpi(null);
  };

  const activeFilterCount = [
    stageFilter !== "ALL",
    healthFilter !== "ALL",
    Boolean(startDate || endDate),
    currentUserRole === "Admin" &&
      clientConfig.features.enableAdminAssignment &&
      adminAssignedFilter !== "MINE",
    Boolean(selectedKpi),
  ].filter(Boolean).length;

  const showAdminAssignFilter =
    currentUserRole === "Admin" && clientConfig.features.enableAdminAssignment;

  return (
    <div 
      className={`p-3 sm:p-4 md:p-8 bg-slate-50 min-h-screen transition-all duration-300 ${assignPanelOrderId ? "md:pr-[412px]" : ""}`}
    >
      {/* Header Section */}
      <div className="mb-5 md:mb-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-start mb-4 md:mb-6">
          <div className="min-w-0">
            {!hideTitle && (
              <>
                <h1 className="text-xl sm:text-2xl md:text-[28px] font-extrabold text-slate-900 m-0 mb-1 md:mb-2">
                  {title || "Orders Management"}
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 m-0">
                  {subtitle || "Track and process initial project requests"}
                </p>
              </>
            )}
          </div>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="inline-flex items-center justify-center gap-2 self-start px-3.5 py-2.5 text-xs sm:text-[13px] font-semibold text-slate-900 bg-white border border-slate-200 rounded-[10px] shrink-0 disabled:opacity-70 disabled:cursor-wait"
          >
            <RefreshCw size={16} className={isRefreshing ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>

        {parsedEntryStage && (
          <div className="mb-4 md:mb-5 -mx-1 px-1 overflow-x-auto">
            <QueueViewToggle
              value={queueView}
              onChange={setQueueView}
              incomingCount={queueViewCounts.incoming}
              currentCount={queueViewCounts.current}
              completedCount={queueViewCounts.completed}
              hideIncoming={!queueHasIncomingTab(parsedEntryStage)}
            />
          </div>
        )}

        {/* Mobile: compact filter chips instead of large KPI cards */}
        <div className="md:hidden flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
          {stats.map((stat: any) => {
            const isActive = selectedKpi === stat.filterKey;
            return (
              <button
                key={stat.filterKey}
                type="button"
                onClick={() => setSelectedKpi(isActive ? null : stat.filterKey)}
                className="shrink-0 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold border transition-colors"
                style={{
                  background: isActive ? `${stat.color}14` : "white",
                  borderColor: isActive ? stat.color : "#e2e8f0",
                  color: isActive ? stat.color : "#64748b",
                }}
              >
                <span>{stat.label}</span>
                <span
                  className="inline-flex min-w-[1.25rem] items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-extrabold"
                  style={{
                    background: isActive ? stat.color : "#f1f5f9",
                    color: isActive ? "white" : "#475569",
                  }}
                >
                  {stat.value}
                </span>
              </button>
            );
          })}
        </div>

        {/* Desktop/tablet: Stats Cards */}
        <div className="hidden md:grid grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat: any, idx) => {
            const Icon = stat.icon;
            const isActive = selectedKpi === stat.filterKey;
            return (
              <div
                key={idx}
                onClick={() => setSelectedKpi(isActive ? null : stat.filterKey)}
                style={{
                  background: isActive ? `${stat.color}12` : "white",
                  border: isActive ? `2px solid ${stat.color}` : "1px solid #e2e8f0",
                  borderRadius: "12px",
                  padding: isActive ? "19px" : "20px",
                  transition: "all 0.2s",
                  cursor: "pointer",
                  userSelect: "none",
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.08)";
                    e.currentTarget.style.transform = "translateY(-2px)";
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = "none";
                  e.currentTarget.style.transform = "translateY(0)";
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
                  <span style={{ fontSize: "11px", fontWeight: "700", color: isActive ? stat.color : "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    {stat.label}
                  </span>
                  <div style={{ width: "32px", height: "32px", background: `${stat.color}15`, borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Icon size={16} style={{ color: stat.color }} />
                  </div>
                </div>
                <div style={{ fontSize: "28px", fontWeight: "800", color: isActive ? stat.color : "#0f172a", marginBottom: "8px" }}>
                  {stat.value}
                </div>
                <div style={{ fontSize: "12px", color: isActive ? stat.color : "#64748b", opacity: isActive ? 0.85 : 1 }}>
                  {isActive ? `${filteredOrders.length} result${filteredOrders.length !== 1 ? "s" : ""}` : stat.change}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* Table Section */}
        <div className="w-full lg:flex-1 bg-white rounded-xl border border-slate-200 overflow-visible min-w-0">
          {/* Search & Filter Bar */}
        <div className="p-3 sm:p-4 border-b border-slate-200">
          {/* Mobile: Airbnb-style — search + Filters chip + icon reset */}
          <div className="md:hidden flex items-center gap-2">
            <div className="relative flex-1 min-w-0">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Search orders…"
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

          {/* Mobile filter sheet */}
          {mobileFiltersOpen && (
            <div className="md:hidden fixed inset-0 z-[80]">
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
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Stage</label>
                    <select
                      value={stageFilter}
                      onChange={(e) => setStageFilter(e.target.value)}
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-medium text-slate-700"
                    >
                      <option value="ALL">All Stages</option>
                      <option value="Site Visit">Site Visit</option>
                      <option value="Quotation">Quotation</option>
                      <option value="Designing">Designing</option>
                      <option value="Production">Production</option>
                      <option value="Installation">Installation</option>
                      <option value="Completed">Completed</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Health</label>
                    <select
                      value={healthFilter}
                      onChange={(e) => setHealthFilter(e.target.value)}
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-medium text-slate-700"
                    >
                      <option value="ALL">All Health States</option>
                      <option value="Active">Active</option>
                      <option value="On Hold">On Hold</option>
                      <option value="Lost">Lost</option>
                      <option value="Cancelled">Cancelled</option>
                      <option value="Completed">Completed</option>
                    </select>
                  </div>
                  {showAdminAssignFilter && (
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Assignment</label>
                      <select
                        value={adminAssignedFilter}
                        onChange={(e) => setAdminAssignedFilter(e.target.value as "ALL" | "MINE")}
                        className="w-full px-3 py-2.5 bg-[var(--color-primary-container,#eff6ff)] border-2 border-[var(--color-primary,#3b82f6)] rounded-xl text-[13px] font-bold text-[var(--color-primary,#1d4ed8)]"
                      >
                        <option value="ALL">All Assigned Admins</option>
                        <option value="MINE">My Assigned Orders</option>
                      </select>
                    </div>
                  )}
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Date range</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="date"
                        value={startDate}
                        onChange={(e) => {
                          setDateFilterType("range");
                          setStartDate(e.target.value);
                        }}
                        className="flex-1 min-w-0 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[13px] text-slate-700"
                      />
                      <span className="text-[12px] text-slate-400 font-medium">to</span>
                      <input
                        type="date"
                        value={endDate}
                        onChange={(e) => {
                          setDateFilterType("range");
                          setEndDate(e.target.value);
                        }}
                        className="flex-1 min-w-0 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[13px] text-slate-700"
                      />
                    </div>
                  </div>
                </div>
                <div className="sticky bottom-0 flex gap-2 px-4 py-3 border-t border-slate-100 bg-white pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                  <button
                    type="button"
                    onClick={() => {
                      resetFilters();
                    }}
                    className="flex-1 py-3 rounded-xl border border-slate-200 text-[13px] font-bold text-slate-600 bg-white"
                  >
                    Clear all
                  </button>
                  <button
                    type="button"
                    onClick={() => setMobileFiltersOpen(false)}
                    className="flex-[1.4] py-3 rounded-xl bg-slate-900 text-white text-[13px] font-bold"
                  >
                    Show results
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Desktop / tablet: inline filters */}
          <div className="hidden md:flex flex-row flex-wrap gap-3 items-center">
            <div className="flex-1 relative min-w-[12rem]">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Search orders…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-[34px] pr-8 py-2.5 border border-slate-200 rounded-lg text-[13px] outline-none focus:border-[var(--color-primary)] focus:ring-[3px] focus:ring-[rgba(30,64,175,0.1)]"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <select
              value={stageFilter}
              onChange={(e) => setStageFilter(e.target.value)}
              className="px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-[13px] font-medium text-slate-600"
            >
              <option value="ALL">All Stages</option>
              <option value="Site Visit">Site Visit</option>
              <option value="Quotation">Quotation</option>
              <option value="Designing">Designing</option>
              <option value="Production">Production</option>
              <option value="Installation">Installation</option>
              <option value="Completed">Completed</option>
            </select>

            {showAdminAssignFilter && (
              <select
                value={adminAssignedFilter}
                onChange={(e) => setAdminAssignedFilter(e.target.value as "ALL" | "MINE")}
                className="px-3 py-2 bg-[var(--color-primary-container,#eff6ff)] border-2 border-[var(--color-primary,#3b82f6)] rounded-lg text-[13px] font-bold text-[var(--color-primary,#1d4ed8)]"
              >
                <option value="ALL">All Assigned Admins</option>
                <option value="MINE">My Assigned Orders</option>
              </select>
            )}

            <div className="flex flex-wrap items-center gap-1.5">
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setDateFilterType("range");
                  setStartDate(e.target.value);
                }}
                className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-[13px] text-slate-600"
              />
              <span className="text-[13px] text-slate-500 font-medium">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setDateFilterType("range");
                  setEndDate(e.target.value);
                }}
                className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-[13px] text-slate-600"
              />
              {(startDate || endDate) && (
                <button
                  type="button"
                  onClick={() => {
                    setStartDate("");
                    setEndDate("");
                    setDateFilterType("all");
                  }}
                  className="flex items-center justify-center bg-white border border-slate-200 rounded-lg cursor-pointer text-slate-400 p-2.5"
                  title="Clear Dates"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <select
              value={healthFilter}
              onChange={(e) => setHealthFilter(e.target.value)}
              className="px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-[13px] font-medium text-slate-600"
            >
              <option value="ALL">All Health States</option>
              <option value="Active">Active</option>
              <option value="On Hold">On Hold</option>
              <option value="Lost">Lost</option>
              <option value="Cancelled">Cancelled</option>
              <option value="Completed">Completed</option>
            </select>

            <button
              type="button"
              title="Reset Filters"
              onClick={resetFilters}
              className="inline-flex items-center justify-center gap-1.5 h-[38px] px-3.5 bg-red-50 border border-red-200 rounded-lg text-red-600 text-[13px] font-semibold shrink-0 hover:bg-red-100"
            >
              <RefreshCw size={14} />
              Reset
            </button>
          </div>
        </div>

        {/* Mobile: compact inbox-style cards (not a tall divider stack) */}
        <div className="md:hidden p-3 space-y-2.5 min-h-[200px] bg-slate-50/80">
          {filteredOrders.length === 0 ? (
            <div className="py-12 px-4 text-center text-sm text-slate-500 font-medium bg-white rounded-xl border border-slate-200">
              No orders found matching your search.
            </div>
          ) : (
            filteredOrders.map((order) => {
              const isSiteVisitStage = order.stage === "Site Visit Scheduled" || order.stage === "Site Visit Completed";
              const hasNoDate = !order.siteVisitDetails || !order.siteVisitDetails.auditDate;
              const displayStage = (isSiteVisitStage && hasNoDate) ? "Site Visit Pending" : order.stage;
              const statusColor = getStatusColor(displayStage);
              const dateStr = new Date(order.dateCreated).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
              const isInstallQueue = parsedEntryStage === "installation";
              const inst = order.installationDetails;
              const sv = order.siteVisitDetails;
              const visitDate = isInstallQueue ? inst?.scheduledDate : sv?.auditDate;
              const visitTime = isInstallQueue ? inst?.scheduledTime : sv?.auditTime;
              const mapAddress = sv?.customerAddress || sv?.siteAddress || sv?.site_address || null;
              const title = order.businessName || order.clientName || "Order";

              return (
                <button
                  key={order.id}
                  type="button"
                  onClick={() => router.push(resolveOrderHref(order))}
                  className="w-full text-left rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden active:scale-[0.99] transition-transform"
                >
                  <div className="flex">
                    <div
                      className="w-1 shrink-0 self-stretch"
                      style={{ background: statusColor.text }}
                      aria-hidden
                    />
                    <div className="flex-1 min-w-0 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span className="text-[13px] font-extrabold text-slate-900">
                              {order.orderCode || order.id}
                            </span>
                            <span
                              className="inline-block px-2 py-0.5 rounded-md text-[10px] font-bold"
                              style={{ background: statusColor.bg, color: statusColor.text }}
                            >
                              {statusColor.label}
                            </span>
                          </div>
                          <div className="text-[13px] font-semibold text-slate-800 truncate mt-1">
                            {title}
                          </div>
                          {order.businessName && order.clientName ? (
                            <div className="text-[11px] text-slate-500 truncate">{order.clientName}</div>
                          ) : null}
                        </div>
                        <ChevronRight size={18} className="shrink-0 text-slate-300 mt-0.5" />
                      </div>

                      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-500">
                        <span className="font-medium">{dateStr}</span>
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border ${getHealthBadgeColor(order.health || "Active")}`}
                        >
                          {order.health || "Active"}
                        </span>
                      </div>

                      {(visitDate && visitTime) ? (
                        <div className="mt-2 rounded-lg bg-slate-50 border border-slate-100 px-2.5 py-1.5">
                          <div className="text-[11px] font-bold text-slate-800">{visitDate} • {visitTime}</div>
                          {mapAddress ? (
                            <div className="text-[10px] text-slate-500 mt-0.5 truncate" title={mapAddress}>
                              {mapAddress}
                            </div>
                          ) : null}
                        </div>
                      ) : null}

                      <div className="mt-2.5 flex items-center gap-1">
                        {order.assignedEmployees?.slice(0, 4).map((empId: string, i: number) => {
                          const staff = employees.find(e => e.id === empId);
                          const name = staff ? staff.name : "Un";
                          return (
                            <div
                              key={i}
                              title={name}
                              className="w-6 h-6 rounded-full bg-[var(--color-primary)] text-white flex items-center justify-center text-[9px] font-bold border-2 border-white"
                              style={{ marginLeft: i > 0 ? "-6px" : "0" }}
                            >
                              {name.substring(0, 2).toUpperCase()}
                            </div>
                          );
                        })}
                        {(!order.assignedEmployees || order.assignedEmployees.length === 0) && (
                          <span className="text-[11px] text-slate-400 italic">Unassigned</span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Desktop table */}
        <div className="hidden md:block overflow-x-auto min-h-[300px]">
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "900px" }}>
            <thead style={{ position: "sticky", top: 0, background: "#f8fafc", zIndex: 10 }}>
              <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                <th style={{ padding: "14px 20px", textAlign: "left", fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  ORDER ID
                </th>
                <th style={{ padding: "14px 20px", textAlign: "left", fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  DATE
                </th>
                <th style={{ padding: "14px 20px", textAlign: "left", fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  CLIENT NAME
                </th>
                <th style={{ padding: "14px 20px", textAlign: "left", fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  BUSINESS NAME
                </th>
                <th style={{ padding: "14px 20px", textAlign: "center", fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  {parsedEntryStage === "installation" ? "INSTALLATION VISIT" : "SITE VISIT"}
                </th>
                <th style={{ padding: "14px 20px", textAlign: "center", fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  STAGE
                </th>
                <th style={{ padding: "14px 20px", textAlign: "center", fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  HEALTH
                </th>
                <th style={{ padding: "14px 20px", textAlign: "left", fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  TEAM
                </th>
                <th style={{ padding: "14px 20px", textAlign: "center", fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  ACTIONS
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map((order, idx) => {
                const isSiteVisitStage = order.stage === "Site Visit Scheduled" || order.stage === "Site Visit Completed";
                const hasNoDate = !order.siteVisitDetails || !order.siteVisitDetails.auditDate;
                const displayStage = (isSiteVisitStage && hasNoDate) ? "Site Visit Pending" : order.stage;
                const statusColor = getStatusColor(displayStage);
                
                const customerName = customers.find(c => c.id === order.customerId)?.name || "Unknown";
                const dateStr = new Date(order.dateCreated).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
                
                return (
                  <tr
                    key={order.id}
                    style={{
                      borderBottom: "1px solid #e2e8f0",
                      transition: "background 0.2s",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "#f8fafc";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "transparent";
                    }}
                  >
                    <td style={{ padding: "16px 20px", fontSize: "13px", color: "#0f172a", fontWeight: "600" }}>
                      {order.orderCode || order.id}
                    </td>
                    <td style={{ padding: "16px 20px", fontSize: "13px", color: "#64748b", fontWeight: "500" }}>
                      {dateStr}
                    </td>
                    <td style={{ padding: "16px 20px" }}>
                      <div style={{ fontSize: "13px", fontWeight: "600", color: "#0f172a" }}>
                        {order.clientName}
                      </div>
                    </td>
                    <td style={{ padding: "16px 20px", fontSize: "13px", color: "#0f172a", fontWeight: "500" }}>
                      {order.businessName}
                    </td>
                    <td style={{ padding: "16px 20px", textAlign: "left" }}>
                      {(() => {
                        const isInstallQueue = parsedEntryStage === "installation";
                        const inst = order.installationDetails;
                        const sv = order.siteVisitDetails;
                        const visitDate = isInstallQueue ? inst?.scheduledDate : sv?.auditDate;
                        const visitTime = isInstallQueue ? inst?.scheduledTime : sv?.auditTime;
                        const mapLink =
                          (isInstallQueue && (inst?.gmapLink || inst?.gmap_link)) ||
                          sv?.gmapLink ||
                          sv?.gmap_link ||
                          null;
                        const mapAddress =
                          sv?.customerAddress ||
                          sv?.siteAddress ||
                          sv?.site_address ||
                          null;
                        const mapHref = mapLink
                          ? mapLink
                          : mapAddress
                            ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapAddress)}`
                            : null;
                        const mapLabel = mapAddress || (mapLink ? "Open map location" : null);

                        if (visitDate && visitTime) {
                          return (
                            <div style={{ textAlign: "left" }}>
                              <div style={{ fontSize: "12px", fontWeight: "600", color: "#0f172a" }}>
                                {visitDate} • {visitTime}
                              </div>
                              {mapHref && mapLabel && (
                                <div style={{ fontSize: "11px", marginTop: "2px", maxWidth: 220 }}>
                                  <a
                                    href={mapHref}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    title={mapLabel}
                                    style={{
                                      color: "#64748b",
                                      textDecoration: "none",
                                      cursor: "pointer",
                                      display: "block",
                                      overflow: "hidden",
                                      textOverflow: "ellipsis",
                                      whiteSpace: "nowrap",
                                    }}
                                    onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")}
                                    onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    {mapLabel}
                                  </a>
                                </div>
                              )}
                            </div>
                          );
                        }

                        return (
                          <span style={{ fontSize: "12px", color: "#94a3b8", fontStyle: "italic" }}>
                            Not yet booked
                          </span>
                        );
                      })()}
                    </td>
                    <td style={{ padding: "16px 20px", textAlign: "center" }}>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "4px 12px",
                          background: statusColor.bg,
                          color: statusColor.text,
                          borderRadius: "6px",
                          fontSize: "11px",
                          fontWeight: "700",
                          whiteSpace: "nowrap"
                        }}
                      >
                        {statusColor.label}
                      </span>
                    </td>
                    <td style={{ padding: "16px 20px", textAlign: "center" }}>
                      <span
                        className={`inline-block px-3 py-1 rounded-full text-xs font-bold border whitespace-nowrap ${getHealthBadgeColor(order.health || "Active")}`}
                      >
                        {order.health || "Active"}
                      </span>
                    </td>
                    <td 
                      style={{ 
                        padding: "16px 20px", 
                        cursor: currentUserRole === "Admin" ? "pointer" : "default",
                        transition: "background 0.2s"
                      }}
                      onClick={() => {
                        if (currentUserRole === "Admin") {
                          setAssignPanelOrderId(order.id);
                        }
                      }}
                      title={currentUserRole === "Admin" ? "Click to assign team" : ""}
                      onMouseEnter={(e) => {
                        if (currentUserRole === "Admin") {
                          e.currentTarget.style.background = "#eff6ff";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (currentUserRole === "Admin") {
                          e.currentTarget.style.background = "transparent";
                        }
                      }}
                    >
                      <div className="flex items-center gap-1 relative">
                        {order.assignedEmployees && order.assignedEmployees.map((empId: string, i: number) => {
                          const staff = employees.find(e => e.id === empId);
                          const name = staff ? staff.name : "Un";
                          return (
                            <div
                              key={i}
                              title={name}
                              className="w-7 h-7 rounded-full bg-[var(--color-primary)] text-white flex items-center justify-center text-[10px] font-bold border-2 border-white"
                              style={{ marginLeft: i > 0 ? "-8px" : "0" }}
                            >
                              {name.substring(0, 2).toUpperCase()}
                            </div>
                          );
                        })}
                        {(!order.assignedEmployees || order.assignedEmployees.length === 0) && (
                          <span className="text-xs text-slate-400 italic">Unassigned</span>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: "16px 20px", textAlign: "center" }}>
                      <button
                        onClick={() => {
                          router.push(resolveOrderHref(order));
                        }}
                        style={{
                          padding: "6px 12px",
                          background: "var(--color-primary)",
                          border: "none",
                          borderRadius: "6px",
                          color: "white",
                          fontSize: "12px",
                          fontWeight: "700",
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                          transition: "all 0.2s",
                          whiteSpace: "nowrap",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = "var(--color-primary-container)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = "var(--color-primary)";
                        }}
                      >
                        <Eye size={14} /> View Order
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filteredOrders.length === 0 && (
                <tr>
                  <td colSpan={9} style={{ padding: "40px 20px", textAlign: "center", color: "#64748b" }}>
                    No orders found matching your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        </div>
        
        {/* Assignment Right Drawer */}
        <div 
          style={{ 
            position: "fixed", 
            top: 0, 
            right: assignPanelOrderId ? 0 : "-100%", 
            bottom: 0, 
            width: "min(380px, 100vw)", 
            background: "white", 
            borderLeft: "1px solid #e2e8f0", 
            zIndex: 100, 
            display: "flex", 
            flexDirection: "column", 
            boxShadow: assignPanelOrderId ? "-10px 0 15px -3px rgba(0, 0, 0, 0.1)" : "none", 
            transition: "right 0.3s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.3s ease" 
          }}
        >
          {assignPanelOrderId && (() => {
              const assignOrder = orders.find(o => o.id === assignPanelOrderId);
              if (!assignOrder) return null;
              
              return (
                <div style={{ display: "flex", flexDirection: "column", height: "100%", padding: "24px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                    <h3 style={{ fontSize: "18px", fontWeight: "700", color: "#0f172a", margin: 0 }}>Assign Team</h3>
                    <button onClick={() => setAssignPanelOrderId(null)} style={{ background: "#f1f5f9", border: "none", cursor: "pointer", color: "#64748b", padding: "6px", borderRadius: "8px" }}>
                      <X size={18} />
                    </button>
                  </div>
                  
                  <div style={{ padding: "16px", background: "#f8fafc", borderRadius: "8px", marginBottom: "24px" }}>
                    <div style={{ fontSize: "14px", fontWeight: "600", color: "#0f172a", marginBottom: "4px" }}>{assignOrder.businessName} - {assignOrder.clientName}</div>
                    <div style={{ fontSize: "12px", color: "#64748b" }}>Order ID: {assignOrder.id}</div>
                  </div>
                  
                  <div style={{ fontSize: "13px", fontWeight: "600", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "12px" }}>
                    Select Staff Directory
                  </div>
                  
                  <div style={{ display: "flex", flexDirection: "column", gap: "12px", overflowY: "auto", flex: 1, paddingRight: "8px" }}>
                    {employees.map(staff => {
                      const isAssigned = assignOrder.assignedEmployees?.includes(staff.id);
                      return (
                        <label key={staff.id} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "14px", border: "1px solid", borderColor: isAssigned ? "var(--color-primary)" : "#e2e8f0", borderRadius: "8px", cursor: "pointer", transition: "all 0.2s", background: isAssigned ? "var(--color-primary-container)" : "white" }}>
                          <input 
                            type="checkbox" 
                            checked={isAssigned || false}
                            onChange={(e) => {
                              let current = assignOrder.assignedEmployees || [];
                              if (e.target.checked) current = [...current, staff.id];
                              else current = current.filter((x: string) => x !== staff.id);
                              assignEmployeesToOrderLocal(assignOrder.id, current);
                            }}
                            style={{ width: "18px", height: "18px", cursor: "pointer", accentColor: "var(--color-primary)" }}
                          />
                          <div style={{ display: "flex", alignItems: "center", gap: "12px", flex: 1 }}>
                            <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: isAssigned ? "var(--color-primary)" : "#f1f5f9", color: isAssigned ? "white" : "#475569", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", fontWeight: "bold" }}>
                              {staff.name.substring(0, 2).toUpperCase()}
                            </div>
                            <div style={{ display: "flex", flexDirection: "column" }}>
                              <span style={{ fontSize: "14px", fontWeight: "600", color: "#0f172a" }}>{staff.name}</span>
                              <span style={{ fontSize: "12px", color: "#64748b" }}>{staff.role} • {staff.email}</span>
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                  
                  <button 
                    onClick={() => setAssignPanelOrderId(null)} 
                    style={{ width: "100%", marginTop: "24px", padding: "14px", background: "var(--color-primary)", color: "white", border: "none", borderRadius: "8px", fontSize: "14px", fontWeight: "600", cursor: "pointer", transition: "all 0.2s" }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "var(--color-primary-container)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "var(--color-primary)";
                    }}
                  >
                    Save Assignments
                  </button>
                </div>
              );
            })()}
        </div>
      </div>
      

    </div>
  );
}
