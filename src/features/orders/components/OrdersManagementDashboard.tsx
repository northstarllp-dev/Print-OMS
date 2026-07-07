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
import { parseOrderStage } from "@/features/orders/workspace/shared/stageGrants";
import {
  countQueueViews,
  partitionQueueOrdersByView,
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
}: { 
  initialOrders: any[];
  initialCustomers: any[];
  initialEmployees: any[];
  initialEnquiries: any[];
  userRole: "Admin" | "Employee";
  currentEmployeeName: string;
  /** Base path for order detail links (e.g. `/staff/orders`). Defaults by role. */
  orderDetailBasePath?: string;
  /** Optional entryStage query param (e.g. staff queue lock). */
  entryStage?: string;
}) {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [orders, setOrders] = useState(initialOrders);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [stageFilter, setStageFilter] = useState("ALL");
  const [healthFilter, setHealthFilter] = useState("ALL");
  const [selectedKpi, setSelectedKpi] = useState<string | null>(null);
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
  const pendingCalls = enquiries ? enquiries.filter(e => e.status === "Pending" && e.source === "Phone Call").length : 0;
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
      label: "PENDING CALLS",
      value: pendingCalls.toString(),
      change: "Immediate action req.",
      filterKey: "pendingcalls",
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
    if (selectedKpi === "pendingcalls") return queueScopedOrders.filter(o => enquiries?.find((e: any) => e.orderId === o.id && e.status === "Pending" && e.source === "Phone Call"));
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

    return true;
  });

  return (
    <div style={{ padding: "32px", paddingRight: assignPanelOrderId ? "412px" : "32px", transition: "padding-right 0.3s cubic-bezier(0.4, 0, 0.2, 1)", background: "#f8fafc", minHeight: "100vh" }}>
      {/* Header Section */}
      <div style={{ marginBottom: "32px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px" }}>
          <div>
            <h1 style={{ fontSize: "28px", fontWeight: "800", color: "#0f172a", margin: "0 0 8px" }}>
              Orders Management
            </h1>
            <p style={{ fontSize: "14px", color: "#64748b", margin: 0 }}>
              Track and process initial project requests
            </p>
          </div>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "10px 16px",
              fontSize: "13px",
              fontWeight: "600",
              color: "#0f172a",
              background: "white",
              border: "1px solid #e2e8f0",
              borderRadius: "10px",
              cursor: isRefreshing ? "wait" : "pointer",
              opacity: isRefreshing ? 0.7 : 1,
            }}
          >
            <RefreshCw size={16} className={isRefreshing ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>

        {parsedEntryStage && (
          <div style={{ marginBottom: "20px" }}>
            <QueueViewToggle
              value={queueView}
              onChange={setQueueView}
              incomingCount={queueViewCounts.incoming}
              currentCount={queueViewCounts.current}
              completedCount={queueViewCounts.completed}
            />
          </div>
        )}

        {/* Stats Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px" }}>
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
      <div style={{ display: "flex", gap: "24px", alignItems: "flex-start" }}>
        {/* Table Section */}
        <div style={{ flex: 1, background: "white", borderRadius: "12px", border: "1px solid #e2e8f0", overflow: "visible", minWidth: 0 }}>
          {/* Search & Filter Bar */}
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #e2e8f0", display: "flex", flexDirection: "column", gap: "10px" }}>
          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            {/* Search */}
            <div style={{ flex: 1, position: "relative" }}>
              <Search size={15} style={{ position: "absolute", left: "11px", top: "50%", transform: "translateY(-50%)", color: "#94a3b8", pointerEvents: "none" }} />
              <input
                type="text"
                placeholder="Search by order ID, project name or customer…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ width: "100%", padding: "9px 32px 9px 34px", border: "1px solid #e2e8f0", borderRadius: "8px", fontSize: "13px", fontFamily: "inherit", transition: "all 0.2s", outline: "none", boxSizing: "border-box" }}
                onFocus={(e) => { e.currentTarget.style.borderColor = "var(--color-primary)"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(30,64,175,0.1)"; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = "#e2e8f0"; e.currentTarget.style.boxShadow = "none"; }}
              />
              {searchTerm && (
                <button onClick={() => setSearchTerm("")} style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#94a3b8", padding: 0, display: "flex" }}>
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Custom Date inputs */}
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                style={{ padding: "8px 12px", border: "1px solid #e2e8f0", borderRadius: "8px", fontSize: "13px", color: "#475569", outline: "none" }}
              />
              <span style={{ fontSize: "12px", color: "#64748b" }}>to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                style={{ padding: "8px 12px", border: "1px solid #e2e8f0", borderRadius: "8px", fontSize: "13px", color: "#475569", outline: "none" }}
              />
            </div>

            {/* Stage filter */}
            <select value={stageFilter} onChange={(e) => setStageFilter(e.target.value)} style={{ padding: "9px 12px", background: "white", border: "1px solid #e2e8f0", borderRadius: "8px", fontSize: "13px", fontWeight: "500", color: "#475569", cursor: "pointer", outline: "none" }}>
              <option value="ALL">All Stages</option>
              <option value="Site Visit">Site Visit</option>
              <option value="Quotation">Quotation</option>
              <option value="Designing">Designing</option>
              <option value="Production">Production</option>
              <option value="Installation">Installation</option>
              <option value="Completed">Completed</option>
            </select>

            {/* Health filter */}
            <select value={healthFilter} onChange={(e) => setHealthFilter(e.target.value)} style={{ padding: "9px 12px", background: "white", border: "1px solid #e2e8f0", borderRadius: "8px", fontSize: "13px", fontWeight: "500", color: "#475569", cursor: "pointer", outline: "none" }}>
              <option value="ALL">All Health States</option>
              <option value="Active">Active</option>
              <option value="On Hold">On Hold</option>
              <option value="Lost">Lost</option>
              <option value="Cancelled">Cancelled</option>
              <option value="Completed">Completed</option>
            </select>
          </div>

          {/* Reset Button */}
          {(startDate !== "" || endDate !== "" || stageFilter !== "ALL" || healthFilter !== "ALL" || searchTerm !== "" || selectedKpi !== null) && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "10px" }}>
              <button
                onClick={() => {
                  setDateFilterType("range");
                  setStartDate("");
                  setEndDate("");
                  setStageFilter("ALL");
                  setHealthFilter("ALL");
                  setSearchTerm("");
                  setSelectedKpi(null);
                }}
                style={{ padding: "9px 12px", background: "#f1f5f9", border: "1px solid #cbd5e1", borderRadius: "8px", cursor: "pointer", fontSize: "13px", fontWeight: "600", color: "#475569", outline: "none" }}
              >
                Reset Filters
              </button>
            </div>
          )}
        </div>

        {/* Table View */}
        <div style={{ overflow: "visible" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
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
                  SITE VISIT
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
                      {order.siteVisitDetails?.auditDate && order.siteVisitDetails?.auditTime ? (
                        <div style={{ textAlign: "left" }}>
                          <div style={{ fontSize: "12px", fontWeight: "600", color: "#0f172a" }}>
                            {order.siteVisitDetails.auditDate} • {order.siteVisitDetails.auditTime}
                          </div>
                          {order.siteVisitDetails.customerAddress && (
                            <div style={{ fontSize: "11px", marginTop: "2px" }}>
                              <a
                                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.siteVisitDetails.customerAddress)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ color: "#64748b", textDecoration: "none", cursor: "pointer" }}
                                onMouseEnter={(e) => e.currentTarget.style.textDecoration = "underline"}
                                onMouseLeave={(e) => e.currentTarget.style.textDecoration = "none"}
                                onClick={(e) => e.stopPropagation()}
                              >
                                {order.siteVisitDetails.customerAddress}
                              </a>
                            </div>
                          )}
                        </div>
                      ) : (
                        <span style={{ fontSize: "12px", color: "#94a3b8", fontStyle: "italic" }}>
                          Not yet booked
                        </span>
                      )}
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
            right: assignPanelOrderId ? 0 : "-400px", 
            bottom: 0, 
            width: "380px", 
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
