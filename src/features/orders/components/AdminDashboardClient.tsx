"use client";

import React, { useState, useLayoutEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  ShoppingCart,
  CheckCircle2,
  DollarSign,
  MessageSquare,
  Factory,
  Wrench,
  LifeBuoy,
  XCircle,
  Plus,
  Eye,
  MoreHorizontal,
  AlertTriangle,
  MapPin,
  TrendingUp,
  AlertCircle,
  Calendar,
} from "lucide-react";
import { AddEnquiryModal, EnquiryFormData } from "@/features/enquiries/components/AddEnquiryModal";
import { createEnquiry } from "@/features/enquiries/actions/enquiryActions";
import { CreateServiceTicketModal } from "@/features/service-tickets/components/CreateServiceTicketModal";
import { CustomerMessageModal, CustomerMessageInfo } from "@/features/notifications/customer-message/CustomerMessageModal";
import { canShowAddServiceTicketForOrder } from "@/features/orders/orderListLogic";
import { BusinessOperationCaption } from "@/features/orders/components/BusinessOperationCaption";

/* ─── helpers ──────────────────────────────────────────────────── */
const STAGE_LABEL: Record<string, { label: string; dot: string }> = {
  "Site Visit Pending":    { label: "Site Visit", dot: "#818CF8" },
  "Site Visit Scheduled":  { label: "Scheduled",  dot: "#818CF8" },
  "Site Visit Completed":  { label: "Site Done",   dot: "#818CF8" },
  "Quotation In Progress": { label: "Quoting",     dot: "#F97316" },
  "Quotation Sent":        { label: "Quotation",   dot: "#F97316" },
  "Quotation Negotiation": { label: "Negotiating", dot: "#F97316" },
  "Quotation Approved":    { label: "Quote OK",    dot: "#F97316" },
  "Design In Progress":    { label: "Design",      dot: "#EC4899" },
  "Design Approved":       { label: "Design",      dot: "#EC4899" },
  "Production":            { label: "In Production", dot: "#3B82F6" },
  "Ready For Installation":{ label: "Ready to Install", dot: "#0EA5E9" },
  "Installation Scheduled":{ label: "Installation", dot: "#0EA5E9" },
  "Customer Pickup":       { label: "Pickup",      dot: "#D97706" },
  "Completed":             { label: "Closed",      dot: "#22C55E" },
  "Closed":                { label: "Closed",      dot: "#22C55E" },
};



const PRIORITY_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  High:   { bg: "#FEF2F2", text: "#DC2626", border: "#FECACA" },
  Medium: { bg: "#FFFBEB", text: "#D97706", border: "#FDE68A" },
  Low:    { bg: "#F0FDF4", text: "#16A34A", border: "#BBF7D0" },
};

const PIPELINE_STAGES = [
  "Enquiry",
  "Site Visit Pending",
  "Quotation Sent",
  "Design Approved",
  "Production",
  "Installation Scheduled",
  "Completed",
];

const PIPELINE_COLORS = [
  "#A855F7",
  "#818CF8",
  "#F97316",
  "#EC4899",
  "#3B82F6",
  "#0EA5E9",
  "#22C55E",
];

const PIPELINE_STAGE_GROUPS: Record<string, string[]> = {
  "Site Visit Pending": ["Site Visit Pending", "Site Visit Scheduled", "Site Visit Completed"],
  "Quotation Sent": ["Quotation In Progress", "Quotation Sent", "Quotation Negotiation", "Quotation Approved"],
  "Design Approved": ["Design In Progress", "Design Approved"],
  "Production": ["Production"],
  "Installation Scheduled": ["Ready For Installation", "Installation Scheduled", "Customer Pickup"],
  "Completed": ["Completed", "Closed"],
};

/** Orders locked for admin gatekeeping (see specs/admin-dashboard.md). */
function needsAdminApproval(stageStatus?: string | null) {
  return !!stageStatus && stageStatus !== "Normal" && stageStatus.startsWith("Pending Admin Approval");
}

function formatApprovalLabel(stageStatus: string) {
  return stageStatus.replace(/^Pending Admin Approval:\s*/i, "").trim() || stageStatus;
}

/* ─── Component ─────────────────────────────────────────────────── */
interface AdminDashboardClientProps {
  orders: any[];
  enquiries: any[];
  tickets?: any[];
  admins?: any[];
}

export function AdminDashboardClient({ 
  orders: rawOrders, 
  enquiries: rawEnquiries, 
  tickets: rawTickets,
  admins = []
}: AdminDashboardClientProps) {
  const router = useRouter();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isTicketModalOpen, setIsTicketModalOpen] = useState(false);
  const [enquiryMsgInfo, setEnquiryMsgInfo] = useState<CustomerMessageInfo | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [menuAnchorEl, setMenuAnchorEl] = useState<HTMLElement | null>(null);
  const [menuCoords, setMenuCoords] = useState<{
    top: number;
    left: number;
    openUp: boolean;
  } | null>(null);

  const closeMenu = useCallback(() => {
    setOpenMenuId(null);
    setMenuAnchorEl(null);
    setMenuCoords(null);
  }, []);

  useLayoutEffect(() => {
    if (!openMenuId || !menuAnchorEl) {
      setMenuCoords(null);
      return;
    }
    const place = () => {
      const r = menuAnchorEl.getBoundingClientRect();
      const openUp = r.bottom + 160 > window.innerHeight - 12;
      const minWidth = 140;
      const left = Math.max(
        8,
        Math.min(r.right - minWidth, window.innerWidth - minWidth - 8)
      );
      setMenuCoords({
        top: openUp ? r.top - 4 : r.bottom + 4,
        left,
        openUp,
      });
    };
    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [openMenuId, menuAnchorEl]);
  const [selectedPipelineStage, setSelectedPipelineStage] = useState<string | null>(null);
  const [selectedKpi, setSelectedKpi] = useState<string | null>(null);
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  /* Date Filtering */
  const orders = rawOrders.filter((o) => {
    if (!startDate && !endDate) return true;
    if (!o.dateCreated) return true;
    const itemDate = new Date(o.dateCreated).toISOString().split("T")[0];
    if (startDate && itemDate < startDate) return false;
    if (endDate && itemDate > endDate) return false;
    return true;
  });

  const enquiries = rawEnquiries.filter((e) => {
    if (!startDate && !endDate) return true;
    if (!e.dateCreated) return true;
    const itemDate = new Date(e.dateCreated).toISOString().split("T")[0];
    if (startDate && itemDate < startDate) return false;
    if (endDate && itemDate > endDate) return false;
    return true;
  });

  const tickets = (rawTickets || []).filter((t) => {
    if (!startDate && !endDate) return true;
    if (!t.created_at) return true;
    const itemDate = new Date(t.created_at).toISOString().split("T")[0];
    if (startDate && itemDate < startDate) return false;
    if (endDate && itemDate > endDate) return false;
    return true;
  });

  /* Stats calculations */
  const totalOrders = orders.length;
  const completedOrders = orders.filter((o) => o.stage === "Completed" || o.stage === "Closed").length;
  const activeOrders = orders.filter((o) => o.stage !== "Completed" && o.stage !== "Closed").length;
  const newEnquiries = enquiries.filter((e) => e.status !== "Converted").length;
  
  const pendingApprovals = orders.filter((o) => needsAdminApproval(o.stageStatus)).length;
  const needsAttentionOrders = orders.filter((o) =>
    o.health === "Needs Attention" &&
    o.stage !== "Completed" &&
    o.stage !== "Closed"
  ).length;
  const lostOrders = orders.filter((o) => o.health === "Lost").length;

  let revenue = 0;
  let outstandingAmount = 0;
  let collectedAmount = 0;

  orders.forEach((o) => {
    let orderRevenue = 0;
    let orderReceived = 0;

    const quotes = Array.isArray(o.quotations) ? o.quotations : (o.quotations ? [o.quotations] : []);
    const approvedQuote = quotes.find((q: any) => q.status === "Approved");
    if (approvedQuote) {
      orderRevenue = Number(approvedQuote.grand_total) || 0;
    }

    const payments = Array.isArray(o.payments) ? o.payments : (o.payments ? [o.payments] : []);
    payments.forEach((p: any) => {
      if (p.status === "received") {
        orderReceived += Number(p.calculated_amount ?? p.amount ?? 0);
      }
    });

    revenue += orderRevenue;
    collectedAmount += orderReceived;
    outstandingAmount += Math.max(0, orderRevenue - orderReceived);
  });

  /* Stat card config */
  const STATS = [
    {
      label: "Total Orders",
      value: totalOrders,
      sub: "All time",
      filterKey: "total",
      icon: ShoppingCart,
      iconBg: "var(--secondary-container)",
      iconColor: "var(--color-secondary)",
    },
    {
      label: "Completed",
      value: completedOrders,
      sub: "All time",
      filterKey: "completed",
      icon: CheckCircle2,
      iconBg: "#F0FDF4",
      iconColor: "#22C55E",
    },
    {
      label: "Active Orders",
      value: activeOrders,
      sub: "Currently in pipeline",
      filterKey: "active",
      icon: TrendingUp,
      iconBg: "#EFF6FF",
      iconColor: "#3B82F6",
    },
    {
      label: "New Enquiries",
      value: newEnquiries,
      sub: "Pending action",
      filterKey: "enquiries",
      icon: MessageSquare,
      iconBg: "var(--secondary-container)",
      iconColor: "var(--color-secondary)",
    },
    {
      label: "Pending Approvals",
      value: pendingApprovals,
      sub: "Requires admin review",
      filterKey: "approvals",
      icon: AlertTriangle,
      iconBg: "#FFFBEB",
      iconColor: "#D97706",
    },
    {
      label: "Needs Attention",
      value: needsAttentionOrders,
      sub: "Stalled — no stage progress",
      filterKey: "needsAttention",
      icon: AlertCircle,
      iconBg: "#FFFBEB",
      iconColor: "#B45309",
    },
    {
      label: "Revenue",
      value: `₹${revenue.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`,
      sub: "Total booked",
      filterKey: "revenue",
      icon: DollarSign,
      iconBg: "#EEF2FF",
      iconColor: "#4F46E5",
    },
    {
      label: "Collected",
      value: `₹${collectedAmount.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`,
      sub: "Payments received",
      filterKey: "collected",
      icon: CheckCircle2,
      iconBg: "#ECFDF5",
      iconColor: "#059669",
    },
    {
      label: "Outstanding",
      value: `₹${outstandingAmount.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`,
      sub: "Pending collection",
      filterKey: "outstanding",
      icon: AlertCircle,
      iconBg: "#FEF2F2",
      iconColor: "#DC2626",
    },
    {
      label: "Lost Orders",
      value: lostOrders,
      sub: "All time",
      filterKey: "lost",
      icon: XCircle,
      iconBg: "#FEF2F2",
      iconColor: "#DC2626",
    },
  ];

  /* Pipeline counts */
  const pipelineCounts = PIPELINE_STAGES.map((stage) => {
    if (stage === "Enquiry") {
      return {
        stage,
        count: enquiries.filter((e) => e.status !== "Converted").length,
        label: "Enquiry",
      };
    }
    const group = PIPELINE_STAGE_GROUPS[stage] || [stage];
    return {
      stage,
      count: orders.filter((o) => group.includes(o.stage)).length,
      label: STAGE_LABEL[stage]?.label || stage,
    };
  });

  /* Table filter logic based on selected KPI or pipeline stage */
  const getFilteredRows = () => {
    if (selectedPipelineStage === "Enquiry") {
      return { type: "enquiries" as const, data: enquiries.filter((e) => e.status !== "Converted") };
    }
    if (selectedPipelineStage) {
      const group = PIPELINE_STAGE_GROUPS[selectedPipelineStage] || [selectedPipelineStage];
      return { type: "orders" as const, data: orders.filter((o) => group.includes(o.stage)) };
    }
    if (selectedKpi === "total")      return { type: "orders" as const, data: orders };
    if (selectedKpi === "completed")  return { type: "orders" as const, data: orders.filter(o => o.stage === "Completed" || o.stage === "Closed") };
    if (selectedKpi === "active")     return { type: "orders" as const, data: orders.filter(o => o.stage !== "Completed" && o.stage !== "Closed") };
    if (selectedKpi === "enquiries")  return { type: "enquiries" as const, data: enquiries.filter(e => e.status !== "Converted") };
    if (selectedKpi === "approvals")  return { type: "orders" as const, data: orders.filter(o => needsAdminApproval(o.stageStatus)) };
    if (selectedKpi === "revenue")    return { type: "orders" as const, data: orders.filter(o => {
      const quotes = Array.isArray(o.quotations) ? o.quotations : (o.quotations ? [o.quotations] : []);
      return quotes.some((q: any) => q.status === "Approved");
    }) };
    if (selectedKpi === "collected") return { type: "orders" as const, data: orders.filter(o => {
      const payments = Array.isArray(o.payments) ? o.payments : (o.payments ? [o.payments] : []);
      return payments.some((p: any) => p.status === "received" && Number(p.calculated_amount ?? p.amount ?? 0) > 0);
    }) };
    if (selectedKpi === "outstanding") return { type: "orders" as const, data: orders.filter(o => {
      let orderRev = 0;
      let orderRec = 0;
      const quotes = Array.isArray(o.quotations) ? o.quotations : (o.quotations ? [o.quotations] : []);
      const approvedQuote = quotes.find((q: any) => q.status === "Approved");
      if (approvedQuote) orderRev = Number(approvedQuote.grand_total) || 0;
      const payments = Array.isArray(o.payments) ? o.payments : (o.payments ? [o.payments] : []);
      payments.forEach((p: any) => {
        if (p.status === "received") orderRec += Number(p.calculated_amount ?? p.amount ?? 0);
      });
      return (orderRev - orderRec) > 0;
    }) };
    if (selectedKpi === "lost")       return { type: "orders" as const, data: orders.filter(o => o.health === "Lost") };
    if (selectedKpi === "needsAttention") return { type: "orders" as const, data: orders.filter(o => o.health === "Needs Attention" && o.stage !== "Completed" && o.stage !== "Closed") };
    return { type: "orders" as const, data: orders.slice(0, 5) };
  };

  const filteredRows = getFilteredRows();
  const activeFilterLabel = selectedKpi
    ? STATS.find(s => s.filterKey === selectedKpi)?.label
    : selectedPipelineStage === "Enquiry"
    ? "Enquiries"
    : selectedPipelineStage
    ? STAGE_LABEL[selectedPipelineStage]?.label
    : null;

  /* Pending Tickets */
  const pendingTickets = (tickets || []).map((t: any) => ({
    id: t.ticket_id || t.id,
    title: t.description || "No description",
    customer: t.customer_name || t.customer_business_name || "Unknown",
    date: t.created_at ? new Date(t.created_at).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" }) : "",
    priority: t.priority || "High",
  }));

  return (
    <div className="p-3 sm:p-5 md:p-8 bg-slate-50 min-h-0 pb-6">

      {/* ── Header ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-5 md:mb-7">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 m-0">
            Dashboard
          </h1>
          <p className="text-xs sm:text-[13px] text-slate-500 mt-1 mb-0">
            Overview of your business performance
          </p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto min-w-0">
          {/* Date range — compact, clearly labeled */}
          <div
            className="flex items-center gap-1 sm:gap-1.5 bg-white px-2 py-1.5 rounded-lg border border-slate-200 min-w-0 flex-1 sm:flex-initial"
            title="Filter by date range"
          >
            <Calendar size={14} className="text-slate-400 shrink-0" aria-hidden />
            <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wide text-slate-400 shrink-0">
              From
            </span>
            <label className="sr-only" htmlFor="dash-start-date">Start date</label>
            <input
              id="dash-start-date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              aria-label="Start date"
              className="w-[6.75rem] sm:w-[9.5rem] max-w-full border-none outline-none text-[11px] sm:text-[13px] text-slate-600 bg-transparent"
            />
            <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wide text-slate-400 shrink-0">
              To
            </span>
            <label className="sr-only" htmlFor="dash-end-date">End date</label>
            <input
              id="dash-end-date"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              aria-label="End date"
              className="w-[6.75rem] sm:w-[9.5rem] max-w-full border-none outline-none text-[11px] sm:text-[13px] text-slate-600 bg-transparent"
            />
            {(startDate || endDate) && (
              <button
                type="button"
                onClick={() => { setStartDate(""); setEndDate(""); }}
                className="flex items-center justify-center bg-transparent border-none cursor-pointer text-slate-400 p-0.5 shrink-0"
                title="Clear dates"
              >
                <XCircle size={14} />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setIsTicketModalOpen(true)}
              className="inline-flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3.5 py-2 sm:py-2.5 rounded-lg border-none bg-[var(--color-primary)] text-[11px] sm:text-[13px] font-bold text-white cursor-pointer whitespace-nowrap"
            >
              <Plus size={14} /> Ticket
            </button>
            <button
              type="button"
              onClick={() => setIsAddModalOpen(true)}
              className="inline-flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3.5 py-2 sm:py-2.5 rounded-lg border-none bg-[var(--color-primary)] text-[11px] sm:text-[13px] font-bold text-white cursor-pointer whitespace-nowrap"
            >
              <Plus size={14} /> Enquiry
            </button>
          </div>
        </div>
      </div>

      {/* Mobile: compact filter chips instead of large KPI cards */}
      <div className="lg:hidden flex gap-2 overflow-x-auto pb-3 -mx-1 px-1 mb-1">
        {STATS.filter((s) => s.filterKey).map((stat) => {
          const isActive = selectedKpi === stat.filterKey;
          return (
            <button
              key={stat.filterKey}
              type="button"
              onClick={() => {
                setSelectedKpi(isActive ? null : (stat.filterKey as string));
                setSelectedPipelineStage(null);
              }}
              className="shrink-0 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold border"
              style={{
                background: isActive ? stat.iconBg : "white",
                borderColor: isActive ? stat.iconColor : "#E2E8F0",
                color: isActive ? stat.iconColor : "#64748B",
              }}
            >
              <span>{stat.label}</span>
              <span
                className="inline-flex min-w-[1.25rem] items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-extrabold"
                style={{
                  background: isActive ? stat.iconColor : "#F1F5F9",
                  color: isActive ? "white" : "#475569",
                }}
              >
                {stat.value}
              </span>
            </button>
          );
        })}
      </div>

      {/* Desktop/tablet: Stat Cards */}
      <div className="hidden lg:grid grid-cols-2 xl:grid-cols-5 gap-4 mb-7">
        {STATS.map((stat, i) => {
          const Icon = stat.icon;
          const isActive = stat.filterKey ? selectedKpi === stat.filterKey : false;
          return (
            <div
              key={i}
              onClick={() => {
                if (stat.filterKey) {
                  setSelectedKpi(isActive ? null : stat.filterKey);
                  setSelectedPipelineStage(null);
                }
              }}
              style={{
                background: isActive ? stat.iconBg : "white",
                border: isActive ? `2px solid ${stat.iconColor}` : "1px solid #E2E8F0",
                borderRadius: "12px",
                padding: isActive ? "19px" : "20px",
                cursor: stat.filterKey ? "pointer" : "default",
                transition: "all 0.15s",
                userSelect: "none",
              }}
              onMouseEnter={e => {
                if (!isActive && stat.filterKey) {
                  e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.08)";
                  e.currentTarget.style.transform = "translateY(-2px)";
                }
              }}
              onMouseLeave={e => {
                if (stat.filterKey) {
                  e.currentTarget.style.boxShadow = "none";
                  e.currentTarget.style.transform = "translateY(0)";
                }
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "12px" }}>
                <p style={{ margin: 0, fontSize: "11px", fontWeight: "700", color: isActive ? stat.iconColor : "#94A3B8", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  {stat.label}
                </p>
                <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: isActive ? "white" : stat.iconBg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Icon size={15} style={{ color: stat.iconColor }} />
                </div>
              </div>
              <div style={{ fontSize: "28px", fontWeight: "800", color: isActive ? stat.iconColor : "#0F172A", marginBottom: "6px", lineHeight: 1 }}>
                {stat.value}
              </div>
              <div style={{ fontSize: "11px", color: isActive ? stat.iconColor : "#64748B", opacity: isActive ? 0.8 : 1 }}>{stat.sub}</div>
            </div>
          );
        })}
      </div>

      {/* ── Bottom two columns: Recent Orders + Pending Tickets ── */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-4 md:gap-5 mb-6">

        {/* Recent Orders / Enquiries Table */}
        <div style={{ background: "white", border: "1px solid #E2E8F0", borderRadius: "12px", overflow: "hidden" }}>
          <div style={{ padding: "18px 24px", borderBottom: "1px solid #E2E8F0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <h2 style={{ margin: 0, fontSize: "14px", fontWeight: "700", color: "#0F172A" }}>
                {activeFilterLabel ? `${activeFilterLabel}` : "Recent Orders"}
              </h2>
              {activeFilterLabel && (
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: "700",
                    background: "var(--color-primary-container)",
                    color: "var(--color-primary)",
                    padding: "3px 10px",
                    borderRadius: "6px",
                    border: "1px solid rgba(30, 64, 175, 0.15)",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  {filteredRows.data.length} result{filteredRows.data.length !== 1 ? "s" : ""}
                  <button
                    onClick={() => { setSelectedKpi(null); setSelectedPipelineStage(null); }}
                    style={{
                      background: "none",
                      border: "none",
                      color: "inherit",
                      cursor: "pointer",
                      padding: "0 2px",
                      fontWeight: "900",
                      fontSize: "12px",
                      lineHeight: 1,
                      display: "flex",
                      alignItems: "center",
                    }}
                  >
                    ×
                  </button>
                </span>
              )}
            </div>
            <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
              <button
                onClick={() => {
                  if (selectedKpi === "approvals") {
                    setSelectedKpi(null);
                  } else {
                    setSelectedKpi("approvals");
                    setSelectedPipelineStage(null);
                  }
                }}
                style={{
                  fontSize: "12px",
                  fontWeight: "700",
                  color: selectedKpi === "approvals" ? "white" : "var(--color-primary)",
                  background: selectedKpi === "approvals" ? "var(--color-primary)" : "rgba(30, 64, 175, 0.1)",
                  padding: "6px 12px",
                  borderRadius: "6px",
                  border: "none",
                  cursor: "pointer",
                  transition: "all 0.2s"
                }}
              >
                Approvals Req. {pendingApprovals > 0 && `(${pendingApprovals})`}
              </button>
              <button
                onClick={() => router.push(filteredRows.type === "enquiries" ? "/admin/enquire" : "/admin/orders")}
                style={{ fontSize: "12px", fontWeight: "700", color: "var(--color-primary)", background: "none", border: "none", cursor: "pointer" }}
              >
                View All
              </button>
            </div>
          </div>
          <div
            className="custom-scrollbar"
            style={{ maxHeight: "360px", height: "360px", overflowY: "auto" }}
          >
            {filteredRows.type === "enquiries" ? (
              /* Enquiries view */
              filteredRows.data.length === 0 ? (
                <div style={{ padding: "40px", textAlign: "center", color: "#94A3B8", fontSize: "13px" }}>No enquiries found.</div>
              ) : (
                filteredRows.data.map((enq: any, i: number) => (
                  <div
                    key={enq.id}
                    style={{
                      display: "flex", alignItems: "center",
                      padding: "14px 24px",
                      borderBottom: i < filteredRows.data.length - 1 ? "1px solid #F1F5F9" : "none",
                      gap: "12px", cursor: "pointer", transition: "background 0.15s",
                    }}
                    onClick={() => router.push("/admin/enquire")}
                    onMouseEnter={e => (e.currentTarget.style.background = "#F8FAFC")}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        {(enq.enquire_id || enq.enquireId) && (
                          <span style={{ fontSize: "12px", color: "var(--color-primary)", fontWeight: "600" }}>
                            #{enq.enquire_id || enq.enquireId}
                          </span>
                        )}
                        <span style={{ fontSize: "13px", fontWeight: "700", color: "#0F172A" }}>
                          {enq.business_name || enq.businessName || enq.lead_name || enq.leadName || "No Name Provided"}
                        </span>
                        {(enq.business_name || enq.businessName) && (enq.lead_name || enq.leadName) && (
                          <span style={{ fontSize: "12px", color: "#64748B" }}>
                            ({enq.lead_name || enq.leadName})
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: "12px", color: "#64748B", marginTop: "4px" }}>
                        {enq.phone ? `${enq.phone} • ` : ""}{enq.source || "No Source"}
                      </div>
                    </div>
                    <span style={{
                      fontSize: "9px", fontWeight: "800", textTransform: "uppercase",
                      padding: "2px 8px", borderRadius: "4px",
                      background: "#FFFBEB", color: "#D97706", border: "1px solid #FDE68A",
                    }}>{enq.status}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); router.push("/admin/enquire"); }}
                      style={{ padding: "6px 10px", background: "var(--color-primary-container)", color: "var(--color-primary)", border: "none", borderRadius: "6px", fontSize: "11px", fontWeight: "700", cursor: "pointer" }}
                    >
                      View
                    </button>
                  </div>
                ))
              )
            ) : (
              /* Orders view */
              filteredRows.data.length === 0 ? (
                <div style={{ padding: "40px", textAlign: "center", color: "#94A3B8", fontSize: "13px" }}>No orders found.</div>
              ) : (
                filteredRows.data.map((order: any) => {
                  const stageInfo = STAGE_LABEL[order.stage] || { label: order.stage, dot: "#94A3B8" };
                  const awaitingApproval = needsAdminApproval(order.stageStatus);
                  return (
                    <div
                      key={order.id}
                      className="flex items-center gap-2 sm:gap-3 px-3 sm:px-6 py-3.5 border-b border-slate-100 last:border-b-0 cursor-pointer hover:bg-slate-50 transition-colors"
                      onClick={() => router.push(`/admin/orders/${order.id}`)}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <div className="min-w-0">
                            <span className="text-[13px] font-bold text-slate-900">{order.orderCode}</span>
                            <BusinessOperationCaption opId={order.business_operation} />
                          </div>
                          <span style={{
                            fontSize: "9px", fontWeight: "800", textTransform: "uppercase",
                            padding: "2px 6px", borderRadius: "4px",
                            background: order.health === "Active" ? "#F0FDF4" : "#FEF2F2",
                            color: order.health === "Active" ? "#16A34A" : "#DC2626",
                            border: `1px solid ${order.health === "Active" ? "#BBF7D0" : "#FECACA"}`,
                          }}>{order.health || "Active"}</span>
                          {awaitingApproval && (
                            <span style={{
                              fontSize: "9px", fontWeight: "800", textTransform: "uppercase",
                              padding: "2px 6px", borderRadius: "4px",
                              background: "#FFFBEB",
                              color: "#D97706",
                              border: "1px solid #FDE68A",
                            }}>
                              Needs: {formatApprovalLabel(order.stageStatus)}
                            </span>
                          )}
                        </div>
                        <p className="m-0 mt-1 text-xs text-slate-500 truncate">
                          {(order.businessName || order.customerName || "No Business")} • {(order.clientName || "No Client")}
                        </p>
                        <div className="sm:hidden mt-1.5 flex items-center gap-1.5">
                          <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: awaitingApproval ? "#D97706" : stageInfo.dot, flexShrink: 0 }} />
                          <span className="text-[11px] text-slate-600 font-semibold">{stageInfo.label}</span>
                        </div>
                      </div>
                      {order.assignedAdmins && order.assignedAdmins.length > 0 && (
                        <div className="hidden sm:flex items-center gap-1 shrink-0">
                          {order.assignedAdmins.map((adminId: string) => {
                            const adminObj = admins?.find(a => a.id === adminId);
                            const adminName = adminObj ? adminObj.name : "Admin";
                            const initials = adminName.substring(0, 2).toUpperCase();
                            return (
                              <div key={adminId} title={adminName} style={{
                                width: "20px", height: "20px", borderRadius: "50%", background: "#E2E8F0", color: "#475569",
                                display: "flex", alignItems: "center", justifyContent: "center", fontSize: "9px", fontWeight: "bold",
                                border: "1px solid #fff", boxShadow: "0 1px 2px rgba(0,0,0,0.05)"
                              }}>
                                {initials}
                              </div>
                            );
                          })}
                        </div>
                      )}
                      <div className="hidden sm:flex items-center gap-1.5 shrink-0">
                        <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: stageInfo.dot, flexShrink: 0 }} />
                        <span className="text-xs text-slate-600 font-semibold whitespace-nowrap">{stageInfo.label}</span>
                      </div>
                      <div className="relative shrink-0">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (openMenuId === order.id) {
                              closeMenu();
                            } else {
                              setMenuAnchorEl(e.currentTarget);
                              setOpenMenuId(order.id);
                            }
                          }}
                          style={{ padding: "4px", background: "none", border: "none", cursor: "pointer", color: "#94A3B8", borderRadius: "4px" }}
                        >
                          <MoreHorizontal size={16} />
                        </button>
                        {openMenuId === order.id &&
                          menuCoords &&
                          typeof document !== "undefined" &&
                          createPortal(
                            <>
                              <div
                                style={{ position: "fixed", inset: 0, zIndex: 99998 }}
                                onClick={closeMenu}
                              />
                              <div
                                style={{
                                  position: "fixed",
                                  top: menuCoords.top,
                                  left: menuCoords.left,
                                  transform: menuCoords.openUp ? "translateY(-100%)" : undefined,
                                  background: "white",
                                  border: "1px solid #E2E8F0",
                                  borderRadius: "8px",
                                  boxShadow: "0 10px 28px rgba(15, 23, 42, 0.18)",
                                  zIndex: 99999,
                                  minWidth: 140,
                                  overflow: "hidden",
                                  pointerEvents: "auto",
                                }}
                              >
                                <button
                                  onClick={() => {
                                    closeMenu();
                                    router.push(`/admin/orders/${order.id}`);
                                  }}
                                  style={{ width: "100%", padding: "9px 14px", display: "flex", alignItems: "center", gap: "8px", background: "none", border: "none", fontSize: "12px", fontWeight: "600", color: "#0F172A", cursor: "pointer", textAlign: "left" }}
                                  onMouseEnter={(e) => (e.currentTarget.style.background = "#F8FAFC")}
                                  onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                                >
                                  <Eye size={13} /> View Order
                                </button>
                                {canShowAddServiceTicketForOrder(order.stage) && (
                                  <button
                                    onClick={() => {
                                      closeMenu();
                                      setIsTicketModalOpen(true);
                                    }}
                                    style={{ width: "100%", padding: "9px 14px", display: "flex", alignItems: "center", gap: "8px", background: "none", border: "none", fontSize: "12px", fontWeight: "600", color: "#0F172A", cursor: "pointer", textAlign: "left" }}
                                    onMouseEnter={(e) => (e.currentTarget.style.background = "#F8FAFC")}
                                    onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                                  >
                                    <Wrench size={13} /> Add Service Ticket
                                  </button>
                                )}
                              </div>
                            </>,
                            document.body
                          )}
                      </div>
                    </div>
                  );
                })
              )
            )}
          </div>
        </div>

        {/* Pending Tickets */}
        <div style={{ background: "white", border: "1px solid #E2E8F0", borderRadius: "12px", overflow: "hidden" }}>
          <div style={{ padding: "18px 20px", borderBottom: "1px solid #E2E8F0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <h2 style={{ margin: 0, fontSize: "14px", fontWeight: "700", color: "#0F172A" }}>Pending Tickets</h2>
              <span style={{ fontSize: "10px", fontWeight: "800", background: "#EF4444", color: "white", padding: "2px 8px", borderRadius: "99px" }}>
                {pendingTickets.length} open
              </span>
            </div>
            <button
              onClick={() => router.push("/admin/service-tickets")}
              style={{ fontSize: "12px", fontWeight: "700", color: "var(--color-primary)", background: "none", border: "none", cursor: "pointer" }}
            >
              View All
            </button>
          </div>
          <div style={{ padding: "16px" }}>
            {pendingTickets.map((ticket) => {
              const pStyles = PRIORITY_STYLES[ticket.priority];
              return (
                <div
                  key={ticket.id}
                  style={{
                    background: "#FFFBEB",
                    border: "1px solid #FDE68A",
                    borderRadius: "10px",
                    padding: "14px",
                    marginBottom: "12px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "8px", marginBottom: "8px" }}>
                    <p style={{ margin: 0, fontSize: "13px", fontWeight: "700", color: "#0F172A", lineHeight: 1.4 }}>
                      {ticket.title}
                    </p>
                    <span
                      style={{
                        fontSize: "9px", fontWeight: "800", textTransform: "uppercase",
                        padding: "2px 7px", borderRadius: "99px",
                        background: pStyles.bg, color: pStyles.text, border: `1px solid ${pStyles.border}`,
                        flexShrink: 0,
                      }}
                    >
                      {ticket.priority}
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <AlertTriangle size={11} style={{ color: "#D97706" }} />
                    <span style={{ fontSize: "11px", color: "#64748B" }}>
                      {ticket.customer} • {ticket.date}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Order Pipeline ── */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 md:p-6">
        <h2 className="m-0 mb-4 text-sm font-bold text-slate-900">Order Pipeline</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-1.5 sm:gap-2">
          {pipelineCounts.map((item, i) => {
            const isSelected = selectedPipelineStage === item.stage;
            return (
              <div
                key={item.stage}
                onClick={() => {
                  setSelectedPipelineStage(isSelected ? null : item.stage);
                  setSelectedKpi(null);
                }}
                className="text-center cursor-pointer rounded-[10px] transition-all duration-150 min-w-0 px-1 py-2.5 sm:px-1.5 sm:py-3 lg:px-1 lg:py-2.5"
                style={{
                  background: isSelected ? "rgba(30, 64, 175, 0.05)" : "transparent",
                  border: isSelected ? "1.5px solid var(--color-primary)" : "1.5px solid transparent",
                  transform: isSelected ? "scale(1.02)" : "scale(1)",
                  boxShadow: isSelected ? "0 4px 10px rgba(30, 64, 175, 0.05)" : "none",
                }}
                onMouseEnter={e => {
                  if (!isSelected) {
                    e.currentTarget.style.background = "#F8FAFC";
                  }
                }}
                onMouseLeave={e => {
                  if (!isSelected) {
                    e.currentTarget.style.background = "transparent";
                  }
                }}
              >
                <div
                  className="font-extrabold mb-1 transition-colors text-[22px] sm:text-[26px] lg:text-[22px] xl:text-[26px]"
                  style={{ color: isSelected ? "var(--color-primary)" : "#0F172A" }}
                >
                  {item.count}
                </div>
                <div
                  className="w-full rounded-full mb-1.5 sm:mb-2 overflow-hidden transition-[height]"
                  style={{
                    height: isSelected ? "6px" : "4px",
                    background: PIPELINE_COLORS[i] + "30",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: item.count > 0 ? "100%" : "0%",
                      background: PIPELINE_COLORS[i],
                      borderRadius: "99px",
                      transition: "width 0.5s ease",
                    }}
                  />
                </div>
                <div
                  className="font-semibold leading-tight px-0.5 transition-colors text-[10px] sm:text-[11px] lg:text-[10px] xl:text-[11px]"
                  style={{
                    fontWeight: isSelected ? 800 : 600,
                    color: isSelected ? "var(--color-primary)" : "#64748B",
                  }}
                >
                  {item.label}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <AddEnquiryModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSubmit={async (data: EnquiryFormData) => {
          try {
            const newEnq = {
              lead_name: data.leadName,
              business_name: data.businessName,
              phone: data.phone,
              whatsapp: data.whatsappNumber,
              email: data.email,
              source: data.primaryMode === "whatsapp" ? "WhatsApp" : "Phone Call",
              notes: data.notes,
              primary_communication_mode: data.primaryMode === "whatsapp" ? "WHATSAPP" : "MAIL",
              location: data.location,
              status: "Pending"
            };
            const result = await createEnquiry(newEnq);
            setIsAddModalOpen(false);
            router.refresh();
            const row = result?.[0];
            if (row) {
              setEnquiryMsgInfo({
                businessName: row.business_name || row.lead_name || "Customer",
                phone: row.whatsapp || row.phone || "",
                email: row.email || "",
                enquiryNo: row.enquire_id || "",
              });
            }
          } catch (error) {
            console.error("Error adding enquiry:", error);
            alert("Failed to add enquiry.");
          }
        }}
      />

      {enquiryMsgInfo && (
        <CustomerMessageModal
          isOpen
          templateKey="enquiry_received"
          info={enquiryMsgInfo}
          onClose={() => setEnquiryMsgInfo(null)}
        />
      )}

      {/* ── Add Service Ticket Modal ── */}
      {isTicketModalOpen && (
        <CreateServiceTicketModal
          onClose={() => setIsTicketModalOpen(false)}
          onCreated={() => {
            setIsTicketModalOpen(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
