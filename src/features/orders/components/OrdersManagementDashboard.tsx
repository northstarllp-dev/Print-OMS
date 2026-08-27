"use client";

import React, { useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
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
  AlertTriangle,
  CheckCircle,
  Calendar,
  ChevronLeft,
  RefreshCw,
  MoreHorizontal,
  Wrench,
  CirclePlay,
  Pause,
  Ban,
} from "lucide-react";
import { assignTeamToOrder, updateOrderHealthAction } from "@/features/orders/actions/orderActions";
import { HoldFollowUpModal } from "@/features/calendar/components/HoldFollowUpModal";
import { loadClientConfig } from "@/config/loadClientConfig";
import { parseOrderStage } from "@/features/orders/workspace/shared/stageGrants";
import {
  countQueueViews,
  countMyOrdersTabs,
  partitionQueueOrdersByView,
  partitionMyOrdersByTab,
  queueHasIncomingTab,
  PIPELINE_QUEUE_STAGES,
  type MyOrdersTab,
  type MyOrdersTabCounts,
} from "@/features/orders/workspace/shared/staffQueueStages";
import { QueueViewToggle } from "./QueueViewToggle";
import { MyOrdersStageTabs } from "./MyOrdersStageTabs";
import { BusinessOperationCaption } from "./BusinessOperationCaption";
import type { QueueView } from "@/features/orders/workspace/shared/staffQueueStages";
import type { OrderStage } from "@/features/orders/workspace/shared/types";
import { CreateServiceTicketModal } from "@/features/service-tickets/components/CreateServiceTicketModal";
import type { OrderHealth } from "@/features/orders/lib/orderHealth";
import {
  buildServiceTicketPreset,
  canChangeOrderHealth,
  canShowAddServiceTicketForOrder,
  computeOrderKpis,
  countActiveOrderFilters,
  filterOrders,
  formatOnHoldHoverText,
  healthMenuActions as healthMenuActionLabels,
  needsAdminApproval,
  paginateOrders,
  resolveOrderDetailHref,
} from "@/features/orders/orderListLogic";
import { resolveSiteVisitMapLink } from "@/features/orders/actions/siteVisitMapper";
import { isSkippedSiteVisit } from "@/features/orders/workspace/modules/site-visit/siteVisitUiLogic";
import { ListPagination, LIST_PAGE_SIZE } from "@/components/ui/ListPagination";

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
    "Customer Pickup":        { bg: "#fef3c7", text: "#d97706", label: "Customer Pickup" },
    "Completed":              { bg: "#dcfce7", text: "#22c55e", label: "Completed" },
    "Closed":                 { bg: "#dcfce7", text: "#22c55e", label: "Closed" },
  };
  return colors[status] || { bg: "#f1f5f9", text: "#64748b", label: status };
};

const getHealthBadgeColor = (health: string) => {
  const colors: Record<string, string> = {
    "Active": "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
    "Needs Attention": "bg-amber-500/10 text-amber-700 border-amber-500/20",
    "On Hold": "bg-slate-500/10 text-slate-600 border-slate-500/20",
    "Lost": "bg-rose-500/10 text-rose-600 border-rose-500/20",
  };
  return colors[health] || "bg-slate-100 text-slate-600 border-slate-200";
};

function OrderHealthBadge({
  order,
  className,
}: {
  order: {
    health?: string | null;
    hold_note?: string | null;
    reach_out_at?: string | null;
  };
  className: string;
}) {
  const health = order.health || "Active";
  const holdTip = formatOnHoldHoverText(order);
  return (
    <span
      className={`group/health relative inline-block ${className} ${holdTip ? "cursor-help" : ""}`}
      title={holdTip || undefined}
    >
      {health}
      {holdTip ? (
        <span
          role="tooltip"
          className="pointer-events-none absolute left-1/2 top-full z-40 mt-1.5 w-max max-w-[220px] -translate-x-1/2 rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-left text-[10px] font-semibold leading-snug text-white opacity-0 shadow-lg transition-opacity group-hover/health:opacity-100"
        >
          {holdTip}
        </span>
      ) : null}
    </span>
  );
}

/** Quick health transitions available from the row ⋯ menu (admin). */
function healthMenuActions(health: string): Array<{
  health: OrderHealth;
  label: string;
  icon: typeof CirclePlay;
  className: string;
}> {
  const colors: Record<OrderHealth, string> = {
    Active: "text-emerald-600 hover:bg-emerald-50",
    "Needs Attention": "text-amber-700 hover:bg-amber-50",
    "On Hold": "text-slate-600 hover:bg-slate-50",
    Lost: "text-rose-600 hover:bg-rose-50",
  };
  const icons: Record<OrderHealth, typeof CirclePlay> = {
    Active: CirclePlay,
    "Needs Attention": AlertTriangle,
    "On Hold": Pause,
    Lost: Ban,
  };
  return healthMenuActionLabels(health).map((a) => ({
    ...a,
    icon: icons[a.health],
    className: colors[a.health],
  }));
}

const ORDER_MENU_HOST_ID = "printec-order-actions-menu-host";

function getOrderMenuHost(): HTMLElement | null {
  if (typeof document === "undefined") return null;
  let host = document.getElementById(ORDER_MENU_HOST_ID);
  if (!host) {
    host = document.createElement("div");
    host.id = ORDER_MENU_HOST_ID;
    document.body.appendChild(host);
  }
  return host;
}

/** Fixed menu in a singleton body host one menu only, never clipped by table overflow. */
function PortaledDropdown({
  open,
  anchorEl,
  onClose,
  children,
  minWidth = 170,
}: {
  open: boolean;
  anchorEl: HTMLElement | null;
  onClose: () => void;
  children: React.ReactNode;
  minWidth?: number;
}) {
  const [coords, setCoords] = useState<{
    top?: number;
    bottom?: number;
    left: number;
  } | null>(null);
  const host = getOrderMenuHost();

  useLayoutEffect(() => {
    if (!open || !anchorEl) {
      setCoords(null);
      return;
    }
    // Drop stale menus left behind by HMR / older portal mounts.
    document.querySelectorAll("[data-order-actions-menu='true']").forEach((n) => n.remove());
    const place = () => {
      const r = anchorEl.getBoundingClientRect();
      const spaceBelow = window.innerHeight - r.bottom;
      const openUp = spaceBelow < 220;
      const left = Math.max(
        8,
        Math.min(r.right - minWidth, window.innerWidth - minWidth - 8)
      );
      setCoords(
        openUp
          ? { bottom: window.innerHeight - r.top + 6, left }
          : { top: r.bottom + 6, left }
      );
    };
    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open, anchorEl, minWidth]);

  if (!open || !coords || !host) return null;

  return createPortal(
    <>
      <div
        aria-hidden
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 99998,
          background: "transparent",
        }}
      />
      <div
        role="menu"
        style={{
          position: "fixed",
          top: coords.top,
          bottom: coords.bottom,
          left: coords.left,
          minWidth,
          zIndex: 99999,
          background: "#fff",
          border: "1px solid #e2e8f0",
          borderRadius: 8,
          boxShadow: "0 10px 28px rgba(15, 23, 42, 0.18)",
          overflow: "hidden",
          pointerEvents: "auto",
        }}
      >
        {children}
      </div>
    </>,
    host
  );
}

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
  mode,
  allowedStages,
  initialTab,
  initialStage,
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
  /** Unified My Orders mode: stage tabs instead of Incoming/Current/Completed. */
  mode?: "my_orders";
  /** Stages shown as My Orders tabs (must be editable pipeline stages). */
  allowedStages?: OrderStage[];
  /** Initial My Orders tab (incoming | stage | completed). */
  initialTab?: MyOrdersTab;
  /** @deprecated Use initialTab */
  initialStage?: OrderStage;
}) {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [orders, setOrders] = useState(initialOrders);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [stageFilter, setStageFilter] = useState("ALL");
  const [healthFilter, setHealthFilter] = useState("ALL");
  const [adminAssignedFilter, setAdminAssignedFilter] = useState<"ALL" | "MINE">("ALL");
  const [selectedKpi, setSelectedKpi] = useState<string | null>(null);
  const clientConfig = loadClientConfig();
  const isMyOrders = mode === "my_orders";
  const myOrdersStages = allowedStages ?? [];
  const parsedEntryStage = isMyOrders ? undefined : parseOrderStage(entryStage);
  const [queueView, setQueueView] = useState<QueueView>("current");
  const pipelineInitial =
    initialStage &&
    (PIPELINE_QUEUE_STAGES as readonly OrderStage[]).includes(initialStage)
      ? (initialStage as MyOrdersTab)
      : undefined;
  const resolvedInitialTab: MyOrdersTab | undefined =
    initialTab ?? pipelineInitial ?? (myOrdersStages.length > 0 ? "all" : undefined);
  const [myOrdersTab, setMyOrdersTab] = useState<MyOrdersTab | undefined>(resolvedInitialTab);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [menuAnchorEl, setMenuAnchorEl] = useState<HTMLElement | null>(null);
  const closeOrderMenu = useCallback(() => {
    setOpenMenuId(null);
    setMenuAnchorEl(null);
  }, []);
  const toggleOrderMenu = useCallback((orderId: string, el: HTMLElement) => {
    setOpenMenuId((prev) => {
      if (prev === orderId) {
        setMenuAnchorEl(null);
        return null;
      }
      setMenuAnchorEl(el);
      return orderId;
    });
  }, []);
  const [holdModalOrderId, setHoldModalOrderId] = useState<string | null>(null);
  const [ticketPreset, setTicketPreset] = useState<{
    phone?: string;
    customerId?: string;
    orderId?: string;
    orderLabel?: string;
  } | null>(null);
  
  // Custom Date Range Filter
  const [dateFilterType, setDateFilterType] = useState<"all" | "range">("range");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [page, setPage] = useState(1);

  // Debounce search 220 ms
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchTerm.trim().toLowerCase()), 220);
    return () => clearTimeout(t);
  }, [searchTerm]);

  useEffect(() => {
    setOrders(initialOrders);
  }, [initialOrders]);

  useEffect(() => {
    if (!isMyOrders) return;
    if (initialTab) {
      setMyOrdersTab(initialTab);
      return;
    }
    if (
      initialStage &&
      (PIPELINE_QUEUE_STAGES as readonly OrderStage[]).includes(initialStage)
    ) {
      setMyOrdersTab(initialStage as MyOrdersTab);
    }
  }, [isMyOrders, initialTab, initialStage, myOrdersStages]);

  const handleMyOrdersTabChange = useCallback(
    (tab: MyOrdersTab) => {
      setMyOrdersTab(tab);
      router.replace(`/staff/my-orders?stage=${tab}`, { scroll: false });
    },
    [router]
  );

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    router.refresh();
    setTimeout(() => setIsRefreshing(false), 600);
  }, [router]);
  
  const currentUserRole = userRole;

  const resolveOrderHref = useCallback(
    (order: { orderId?: string; id: string }) =>
      resolveOrderDetailHref({
        orderId: order.orderId,
        id: order.id,
        userRole: currentUserRole,
        orderDetailBasePath,
        // My Orders: omit entryStage so Gate C does not lock other stages.
        entryStage: isMyOrders ? null : entryStage,
      }),
    [orderDetailBasePath, entryStage, currentUserRole, isMyOrders]
  );

  const openServiceTicketForOrder = useCallback(
    (order: {
      id: string;
      orderId?: string;
      orderCode?: string;
      customerId?: string;
      clientName?: string;
      businessName?: string;
    }) => {
      const customer = initialCustomers.find((c) => c.id === order.customerId);
      closeOrderMenu();
      setTicketPreset(
        buildServiceTicketPreset({
          order,
          customerPhone: customer?.phone || "",
        })
      );
    },
    [initialCustomers, closeOrderMenu]
  );

  const applyOrderHealth = useCallback(
    async (
      orderId: string,
      health: OrderHealth,
      hold?: { note: string; reachOutAt: string } | null
    ) => {
      closeOrderMenu();
      if (health === "On Hold" && !hold) {
        setHoldModalOrderId(orderId);
        return;
      }
      let lostReason: string | undefined;
      if (health === "Lost") {
        const entered = window.prompt("Reason for marking this order as Lost:");
        if (entered === null) return;
        lostReason = entered.trim();
        if (!lostReason) {
          alert("A reason is required when marking an order as Lost.");
          return;
        }
      }
      const prev = orders.find((o) => o.id === orderId);
      setOrders((list) =>
        list.map((o) =>
          o.id === orderId
            ? {
                ...o,
                health,
                lost_reason: health === "Lost" ? lostReason : null,
                hold_note: health === "On Hold" ? hold?.note ?? null : null,
                reach_out_at: health === "On Hold" ? hold?.reachOutAt ?? null : null,
              }
            : o
        )
      );
      try {
        await updateOrderHealthAction(
          orderId,
          health,
          lostReason,
          undefined,
          health === "On Hold" ? hold : null
        );
      } catch (err: any) {
        if (prev) {
          setOrders((list) =>
            list.map((o) =>
              o.id === orderId
                ? {
                    ...o,
                    health: prev.health,
                    lost_reason: prev.lost_reason,
                    hold_note: prev.hold_note,
                    reach_out_at: prev.reach_out_at,
                  }
                : o
            )
          );
        }
        alert(err?.message || "Failed to update order health.");
      }
    },
    [orders, closeOrderMenu]
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

  const myOrdersTabCounts: MyOrdersTabCounts = useMemo(() => {
    if (!isMyOrders) return { all: 0, incoming: 0, completed: 0 };
    return countMyOrdersTabs(orders, myOrdersStages);
  }, [isMyOrders, orders, myOrdersStages]);

  const queueScopedOrders = useMemo(() => {
    if (isMyOrders && myOrdersTab) {
      return partitionMyOrdersByTab(orders, myOrdersTab, myOrdersStages);
    }
    if (!parsedEntryStage) return orders;
    return partitionQueueOrdersByView(orders, parsedEntryStage, queueView);
  }, [orders, parsedEntryStage, queueView, isMyOrders, myOrdersTab, myOrdersStages]);
  
  // State for right assignment panel
  const [assignPanelOrderId, setAssignPanelOrderId] = useState<string | null>(null);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  
  // State for options dropdown
  const [optionsOrderId, setOptionsOrderId] = useState<string | null>(null);
  
  const assignEmployeesToOrderLocal = async (orderId: string, assigned: string[]) => {
    // Optimistic UI update
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, assignedEmployees: assigned } : o));
    // Server mutation write to order_assignments table
    try {
      await assignTeamToOrder(orderId, assigned);
    } catch (err) {
      console.error(err);
      alert("Failed to assign employees.");
    }
  };

  /** Shared toolbar filters (search / dates / stage / health / assignment) used by KPIs + list */
  const toolbarFilteredOrders = useMemo(
    () =>
      filterOrders(queueScopedOrders, {
        search: debouncedSearch,
        stageFilter,
        healthFilter,
        dateFilterType,
        startDate,
        endDate,
        userRole: currentUserRole,
        employeeId: currentEmployeeId,
        employeeName,
        adminAssignedFilter,
        currentUserId,
        customers,
      }),
    [
      queueScopedOrders,
      debouncedSearch,
      stageFilter,
      healthFilter,
      dateFilterType,
      startDate,
      endDate,
      currentUserRole,
      currentEmployeeId,
      employeeName,
      adminAssignedFilter,
      currentUserId,
      customers,
    ]
  );

  // KPI counts reflect the same toolbar filters as the list (admin only)
  const kpis = computeOrderKpis(toolbarFilteredOrders);
  const totalOrders = kpis.total;
  const activeOrders = kpis.active;
  const unassignedOrders = kpis.unassigned;
  const pendingApprovals = kpis.approvals;
  const completedOrders = kpis.completed;
  const onHoldOrders = kpis.onHold;
  const lostOrders = kpis.lost;

  const stats = currentUserRole === "Employee" ? [] : [
    {
      label: "TOTAL / ACTIVE",
      value: `${totalOrders}/${activeOrders}`,
      change: "All orders / working pipeline",
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
      label: "ON HOLD",
      value: onHoldOrders.toString(),
      change: "Paused follow up later",
      filterKey: "onHold",
      icon: Pause,
      color: "#64748b",
    },
    {
      label: "LOST",
      value: lostOrders.toString(),
      change: "Cancelled / not proceeding",
      filterKey: "lost",
      icon: Ban,
      color: "#e11d48",
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

  const filteredOrders = useMemo(
    () =>
      filterOrders(toolbarFilteredOrders, {
        selectedKpi,
        dateFilterType: "all",
      }),
    [toolbarFilteredOrders, selectedKpi]
  );

  useEffect(() => {
    setPage(1);
  }, [
    debouncedSearch,
    stageFilter,
    healthFilter,
    adminAssignedFilter,
    selectedKpi,
    startDate,
    endDate,
    dateFilterType,
    queueView,
    myOrdersTab,
  ]);

  const pagedOrders = useMemo(
    () => paginateOrders(filteredOrders, page, LIST_PAGE_SIZE),
    [filteredOrders, page]
  );
  const pageOrders = pagedOrders.items;

  const resetFilters = () => {
    setDateFilterType("range");
    setStartDate("");
    setEndDate("");
    setStageFilter("ALL");
    setHealthFilter("ALL");
    setAdminAssignedFilter("ALL");
    setSearchTerm("");
    setSelectedKpi(null);
    setPage(1);
  };

  const activeFilterCount = countActiveOrderFilters({
    stageFilter: isMyOrders ? "ALL" : stageFilter,
    healthFilter,
    startDate,
    endDate,
    adminAssignedFilter,
    enableAdminAssignment: clientConfig.features.enableAdminAssignment,
    selectedKpi,
  });

  const showAdminAssignFilter =
    currentUserRole === "Admin" && clientConfig.features.enableAdminAssignment;

  return (
    <div 
      className={`p-3 sm:p-4 md:p-8 bg-slate-50 min-h-0 pb-6 transition-all duration-300 ${assignPanelOrderId ? "lg:pr-[412px]" : ""}`}
    >
      {/* Header Section */}
      <div className="mb-5 md:mb-8">
        <div className="flex items-start justify-between gap-3 mb-4 md:mb-6">
          <div className="min-w-0 flex-1">
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
            className="inline-flex items-center justify-center gap-1.5 sm:gap-2 shrink-0 mt-0.5 px-2.5 sm:px-3.5 py-2 sm:py-2.5 text-[11px] sm:text-[13px] font-semibold text-slate-900 bg-white border border-slate-200 rounded-[10px] disabled:opacity-70 disabled:cursor-wait"
          >
            <RefreshCw size={15} className={isRefreshing ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>

        {isMyOrders && myOrdersTab && myOrdersStages.length > 0 && (
          <div className="mb-4 md:mb-5 -mx-1 px-1 overflow-x-auto">
            <MyOrdersStageTabs
              stages={myOrdersStages}
              value={myOrdersTab}
              onChange={handleMyOrdersTabChange}
              counts={myOrdersTabCounts}
            />
          </div>
        )}

        {parsedEntryStage && !isMyOrders && (
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

        {/* Mobile: compact filter chips admin KPIs only (hide staff Assigned/My Completed) */}
        {currentUserRole !== "Employee" && (
          <div className="lg:hidden flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
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
        )}

        {/* Desktop/tablet: Stats Cards (admin only) */}
        {currentUserRole !== "Employee" && (
        <div className="hidden lg:grid grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6 gap-4">
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
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* Table Section */}
        <div className="w-full lg:flex-1 bg-white rounded-xl border border-slate-200 overflow-visible min-w-0">
          {/* Search & Filter Bar */}
        <div className="p-3 sm:p-4 border-b border-slate-200">
          {/* Mobile: Airbnb-style search + Filters chip + icon reset */}
          <div className="lg:hidden flex items-center gap-2">
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

          {/* Mobile filter sheet portaled so layout footer z-index can't cover it */}
          {mobileFiltersOpen &&
            createPortal(
            <div className="lg:hidden fixed inset-0 z-[200]">
              <button
                type="button"
                aria-label="Close filters"
                className="absolute inset-0 bg-slate-900/40"
                onClick={() => setMobileFiltersOpen(false)}
              />
              <div className="absolute inset-x-0 bottom-0 flex max-h-[85vh] max-h-[85dvh] flex-col overscroll-contain rounded-t-2xl bg-white shadow-xl">
                <div className="flex shrink-0 items-center justify-between px-4 py-3 border-b border-slate-100 rounded-t-2xl">
                  <h3 className="text-sm font-extrabold text-slate-900">Filters</h3>
                  <button
                    type="button"
                    onClick={() => setMobileFiltersOpen(false)}
                    className="w-8 h-8 inline-flex items-center justify-center rounded-full bg-slate-100 text-slate-500"
                  >
                    <X size={16} />
                  </button>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 space-y-4">
                  {!isMyOrders && (
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
                  )}
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Health</label>
                    <select
                      value={healthFilter}
                      onChange={(e) => setHealthFilter(e.target.value)}
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-medium text-slate-700"
                    >
                      <option value="ALL">All Health States</option>
                      <option value="Active">Active</option>
                      <option value="Needs Attention">Needs Attention</option>
                      <option value="On Hold">On Hold</option>
                      <option value="Lost">Lost</option>
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
                <div className="flex shrink-0 gap-2 px-4 py-3 border-t border-slate-100 bg-white pb-[max(0.75rem,env(safe-area-inset-bottom))]">
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
            </div>,
            document.body
          )}

          {/* Desktop / tablet: inline filters */}
          <div className="hidden lg:flex flex-row flex-wrap gap-3 items-center">
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

            {!isMyOrders && (
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
            )}

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
              <option value="Needs Attention">Needs Attention</option>
              <option value="On Hold">On Hold</option>
              <option value="Lost">Lost</option>
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
        <div className="lg:hidden p-3 space-y-2.5 min-h-[200px] bg-slate-50/80">
          {filteredOrders.length === 0 ? (
            <div className="py-12 px-4 text-center text-sm text-slate-500 font-medium bg-white rounded-xl border border-slate-200">
              No orders found matching your search.
            </div>
          ) : (
            pageOrders.map((order) => {
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
              const siteMap = resolveSiteVisitMapLink(sv);
              const installMapLink = inst?.gmapLink || inst?.gmap_link || null;
              const mapHref = isInstallQueue
                ? installMapLink || siteMap?.href || null
                : siteMap?.href || null;
              const mapLabel = siteMap?.label || (mapHref ? "Open map location" : null);
              const siteVisitSkipped = !isInstallQueue && isSkippedSiteVisit(sv);
              const title = order.businessName || order.clientName || "Order";

              return (
                <div
                  key={order.id}
                  className="w-full text-left rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden"
                >
                  <div className="flex">
                    <div
                      className="w-1 shrink-0 self-stretch"
                      style={{ background: statusColor.text }}
                      aria-hidden
                    />
                    <div className="flex-1 min-w-0 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => router.push(resolveOrderHref(order))}
                          className="min-w-0 text-left flex-1 active:opacity-80"
                        >
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
                          <BusinessOperationCaption
                            opId={order.business_operation}
                          />
                          <div className="text-[13px] font-semibold text-slate-800 truncate mt-1">
                            {title}
                          </div>
                          {order.businessName && order.clientName ? (
                            <div className="text-[11px] text-slate-500 truncate">{order.clientName}</div>
                          ) : null}
                        </button>
                        {currentUserRole === "Admin" && (
                          <div className="relative shrink-0">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleOrderMenu(order.id, e.currentTarget);
                              }}
                              className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                              aria-label="Order actions"
                              aria-expanded={openMenuId === order.id}
                            >
                              <MoreHorizontal size={18} />
                            </button>
                          </div>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => router.push(resolveOrderHref(order))}
                        className="w-full text-left mt-2"
                      >
                        <div className="flex items-center justify-between gap-2 min-w-0">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-500 min-w-0">
                            <span className="font-medium">{dateStr}</span>
                            <OrderHealthBadge
                              order={order}
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${getHealthBadgeColor(order.health || "Active")}`}
                            />
                          </div>
                        </div>

                        {(visitDate && visitTime) ? (
                          <div className="mt-2 rounded-lg bg-slate-50 border border-slate-100 px-2.5 py-1.5">
                            <div className="text-[11px] font-bold text-slate-800">{visitDate} • {visitTime}</div>
                            {siteVisitSkipped ? (
                              <div className="text-[10px] font-semibold text-amber-700 mt-0.5">
                                Site visit skipped
                              </div>
                            ) : null}
                            {mapHref && mapLabel ? (
                              <a
                                href={mapHref}
                                target="_blank"
                                rel="noopener noreferrer"
                                title={mapLabel}
                                className="block text-[10px] text-slate-500 mt-0.5 truncate underline-offset-2 hover:underline"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {mapLabel}
                              </a>
                            ) : null}
                          </div>
                        ) : null}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Desktop table */}
        <div className="hidden lg:block overflow-x-auto min-h-[300px]">
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
                <th style={{ padding: "14px 20px", textAlign: "center", fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  ACTIONS
                </th>
              </tr>
            </thead>
            <tbody>
              {pageOrders.map((order, idx) => {
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
                      <div>{order.orderCode || order.id}</div>
                      <BusinessOperationCaption
                        opId={order.business_operation}
                      />
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
                        const siteMap = resolveSiteVisitMapLink(sv);
                        const installMapLink = inst?.gmapLink || inst?.gmap_link || null;
                        const mapHref = isInstallQueue
                          ? installMapLink || siteMap?.href || null
                          : siteMap?.href || null;
                        const mapLabel = siteMap?.label || (mapHref ? "Open map location" : null);
                        const siteVisitSkipped = !isInstallQueue && isSkippedSiteVisit(sv);

                        if (visitDate && visitTime) {
                          return (
                            <div style={{ textAlign: "left" }}>
                              <div style={{ fontSize: "12px", fontWeight: "600", color: "#0f172a" }}>
                                {visitDate} • {visitTime}
                              </div>
                              {siteVisitSkipped && (
                                <div
                                  style={{
                                    fontSize: "10px",
                                    fontWeight: 700,
                                    color: "#b45309",
                                    marginTop: "2px",
                                  }}
                                >
                                  Site visit skipped
                                </div>
                              )}
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
                      <OrderHealthBadge
                        order={order}
                        className={`px-3 py-1 rounded-full text-xs font-bold border whitespace-nowrap ${getHealthBadgeColor(order.health || "Active")}`}
                      />
                    </td>
                    <td style={{ padding: "16px 20px", textAlign: "center" }}>
                      <div className="relative inline-flex items-center gap-1.5">
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
                        {currentUserRole === "Admin" && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleOrderMenu(order.id, e.currentTarget);
                            }}
                            className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                            aria-label="More actions"
                            aria-expanded={openMenuId === order.id}
                          >
                            <MoreHorizontal size={16} />
                          </button>
                        )}
                      </div>
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
        <ListPagination
          page={pagedOrders.page}
          totalPages={pagedOrders.totalPages}
          total={pagedOrders.total}
          pageSize={pagedOrders.pageSize}
          onPageChange={setPage}
          itemLabel="orders"
        />
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
      

      {ticketPreset && (
        <CreateServiceTicketModal
          preset={ticketPreset}
          onClose={() => setTicketPreset(null)}
          onCreated={() => {
            setTicketPreset(null);
            router.refresh();
          }}
        />
      )}

      <HoldFollowUpModal
        isOpen={!!holdModalOrderId}
        entityLabel="order"
        onClose={() => setHoldModalOrderId(null)}
        onSubmit={(payload) => {
          if (!holdModalOrderId) return;
          const id = holdModalOrderId;
          setHoldModalOrderId(null);
          void applyOrderHealth(id, "On Hold", payload);
        }}
      />

      {(() => {
        const menuOrder = openMenuId
          ? orders.find((o) => o.id === openMenuId) ?? null
          : null;
        if (!menuOrder || !menuAnchorEl) return null;

        const healthActions =
          currentUserRole === "Admin" && canChangeOrderHealth(menuOrder.stage)
            ? healthMenuActions(menuOrder.health || "Active")
            : [];
        const showServiceTicket =
          currentUserRole === "Admin" &&
          canShowAddServiceTicketForOrder(menuOrder.stage);

        // Desktop already has a View Order button; mobile card row is tappable.
        // ⋯ menu is only for admin health / service-ticket actions.
        if (healthActions.length === 0 && !showServiceTicket) {
          return null;
        }

        return (
          <PortaledDropdown
            open
            anchorEl={menuAnchorEl}
            onClose={closeOrderMenu}
          >
            {healthActions.map((action) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.health}
                  type="button"
                  onClick={() => {
                    closeOrderMenu();
                    applyOrderHealth(menuOrder.id, action.health);
                  }}
                  className={`w-full px-3.5 py-2.5 flex items-center gap-2 text-left text-xs font-semibold ${action.className}`}
                >
                  <Icon size={13} /> {action.label}
                </button>
              );
            })}
            {showServiceTicket && (
              <button
                type="button"
                onClick={() => {
                  closeOrderMenu();
                  openServiceTicketForOrder(menuOrder);
                }}
                className="w-full px-3.5 py-2.5 flex items-center gap-2 text-left text-xs font-semibold text-slate-800 hover:bg-slate-50 border-t border-slate-100"
              >
                <Wrench size={13} /> Add Service Ticket
              </button>
            )}
          </PortaledDropdown>
        );
      })()}
    </div>
  );
}
