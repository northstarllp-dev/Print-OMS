"use client";

import React, { useState } from "react";
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
  FileText,
  Plus,
  Eye,
  MoreHorizontal,
  AlertTriangle,
  MapPin,
  TrendingUp,
  AlertCircle,
} from "lucide-react";
import { AddEnquiryModal, EnquiryFormData } from "@/features/enquiries/components/AddEnquiryModal";
import { createEnquiry } from "@/features/enquiries/actions/enquiryActions";

/* ─── helpers ──────────────────────────────────────────────────── */
const STAGE_LABEL: Record<string, { label: string; dot: string }> = {
  "Site Visit Pending":    { label: "Site Visit", dot: "#818CF8" },
  "Site Visit Scheduled":  { label: "Scheduled",  dot: "#818CF8" },
  "Site Visit Completed":  { label: "Site Done",   dot: "#818CF8" },
  "Quotation In Progress": { label: "Quoting",     dot: "#F97316" },
  "Quotation Sent":        { label: "Quote Sent",  dot: "#F97316" },
  "Quotation Negotiation": { label: "Negotiating", dot: "#F97316" },
  "Quotation Approved":    { label: "Quote OK",    dot: "#F97316" },
  "Design In Progress":    { label: "Design",      dot: "#EC4899" },
  "Design Approved":       { label: "Design OK",   dot: "#EC4899" },
  "Production":            { label: "In Production", dot: "#3B82F6" },
  "Ready For Installation":{ label: "Ready",       dot: "#3B82F6" },
  "Installation Scheduled":{ label: "Installation", dot: "#0EA5E9" },
  "Completed":             { label: "Completed",   dot: "#22C55E" },
  "Closed":                { label: "Closed",      dot: "#22C55E" },
};



const PRIORITY_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  High:   { bg: "#FEF2F2", text: "#DC2626", border: "#FECACA" },
  Medium: { bg: "#FFFBEB", text: "#D97706", border: "#FDE68A" },
  Low:    { bg: "#F0FDF4", text: "#16A34A", border: "#BBF7D0" },
};

const PIPELINE_STAGES = [
  "Site Visit Pending",
  "Quotation Sent",
  "Design Approved",
  "Production",
  "Installation Scheduled",
  "Completed",
];

const PIPELINE_COLORS = [
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
  "Production": ["Production", "Ready For Installation"],
  "Installation Scheduled": ["Installation Scheduled"],
  "Completed": ["Completed", "Closed"],
};

/* ─── Component ─────────────────────────────────────────────────── */
interface AdminDashboardClientProps {
  orders: any[];
  enquiries: any[];
}

export function AdminDashboardClient({ orders, enquiries }: AdminDashboardClientProps) {
  const router = useRouter();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [selectedPipelineStage, setSelectedPipelineStage] = useState<string | null>(null);
  const [selectedKpi, setSelectedKpi] = useState<string | null>(null);

  /* Stats calculations */
  const totalOrders = orders.length;
  const completedOrders = orders.filter((o) => o.stage === "Completed" || o.stage === "Closed").length;
  const activeOrders = orders.filter((o) => o.stage !== "Completed" && o.stage !== "Closed").length;
  const newEnquiries = enquiries.filter((e) => e.status === "Pending" || e.status === "New").length;
  
  const pendingApprovals = orders.filter((o) => o.stageStatus && o.stageStatus !== "Normal").length;
  const siteVisitsPending = orders.filter((o) => o.stage === "Site Visit Pending").length;
  const ordersOnHold = orders.filter((o) => o.health === "On Hold").length;
  const lostOrders = orders.filter((o) => o.health === "Lost").length;

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
      label: "Site Visits Pending",
      value: siteVisitsPending,
      sub: "Site visit pending stage",
      filterKey: "sitevisit",
      icon: MapPin,
      iconBg: "#EEF2FF",
      iconColor: "#4F46E5",
    },
    {
      label: "Orders On Hold",
      value: ordersOnHold,
      sub: "Currently paused",
      filterKey: "onhold",
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
    const group = PIPELINE_STAGE_GROUPS[stage] || [stage];
    return {
      stage,
      count: orders.filter((o) => group.includes(o.stage)).length,
      label: STAGE_LABEL[stage]?.label || stage,
    };
  });

  /* Table filter logic based on selected KPI or pipeline stage */
  const getFilteredRows = () => {
    if (selectedPipelineStage) {
      const group = PIPELINE_STAGE_GROUPS[selectedPipelineStage] || [selectedPipelineStage];
      return { type: "orders" as const, data: orders.filter((o) => group.includes(o.stage)) };
    }
    if (selectedKpi === "total")      return { type: "orders" as const, data: orders };
    if (selectedKpi === "completed")  return { type: "orders" as const, data: orders.filter(o => o.stage === "Completed" || o.stage === "Closed") };
    if (selectedKpi === "active")     return { type: "orders" as const, data: orders.filter(o => o.stage !== "Completed" && o.stage !== "Closed") };
    if (selectedKpi === "enquiries")  return { type: "enquiries" as const, data: enquiries.filter(e => e.status === "Pending" || e.status === "New") };
    if (selectedKpi === "approvals")  return { type: "orders" as const, data: orders.filter(o => o.stageStatus && o.stageStatus !== "Normal") };
    if (selectedKpi === "sitevisit")  return { type: "orders" as const, data: orders.filter(o => o.stage === "Site Visit Pending") };
    if (selectedKpi === "onhold")     return { type: "orders" as const, data: orders.filter(o => o.health === "On Hold") };
    if (selectedKpi === "lost")       return { type: "orders" as const, data: orders.filter(o => o.health === "Lost") };
    return { type: "orders" as const, data: orders.slice(0, 5) };
  };

  const filteredRows = getFilteredRows();
  const activeFilterLabel = selectedKpi
    ? STATS.find(s => s.filterKey === selectedKpi)?.label
    : selectedPipelineStage
    ? STAGE_LABEL[selectedPipelineStage]?.label
    : null;

  /* Pending Tickets — mock data */
  const pendingTickets = [
    { id: "TKT-001", title: "LED light not working in main signage", customer: "Sneha Reddy", date: "26 Feb 2024", priority: "High" as const },
  ];

  return (
    <div style={{ padding: "32px", background: "#F8FAFC", minHeight: "100vh" }}>

      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "28px" }}>
        <div>
          <h1 style={{ fontSize: "24px", fontWeight: "800", color: "#0F172A", margin: 0 }}>
            Dashboard
          </h1>
          <p style={{ fontSize: "13px", color: "#64748B", margin: "4px 0 0" }}>
            Overview of your business performance
          </p>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <button
            style={{
              display: "flex", alignItems: "center", gap: "6px",
              padding: "9px 16px", borderRadius: "8px",
              border: "1px solid var(--color-secondary)", background: "white",
              fontSize: "13px", fontWeight: "600", color: "var(--color-secondary)",
              cursor: "pointer", transition: "all 0.15s",
            }}
            onMouseEnter={e => e.currentTarget.style.background = "var(--secondary-container)"}
            onMouseLeave={e => e.currentTarget.style.background = "white"}
          >
            <FileText size={14} /> Generate Report
          </button>
          <button
            onClick={() => setIsAddModalOpen(true)}
            style={{
              display: "flex", alignItems: "center", gap: "6px",
              padding: "9px 16px", borderRadius: "8px",
              border: "none", background: "var(--color-primary)",
              fontSize: "13px", fontWeight: "700", color: "white",
              cursor: "pointer", transition: "all 0.15s",
            }}
            onMouseEnter={e => e.currentTarget.style.background = "var(--color-primary-container)"}
            onMouseLeave={e => e.currentTarget.style.background = "var(--color-primary)"}
          >
            <Plus size={14} /> Add Enquiry
          </button>
        </div>
      </div>

      {/* ── Stat Cards (2 rows of 4) ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px", marginBottom: "28px" }}>
        {STATS.map((stat, i) => {
          const Icon = stat.icon;
          const isActive = selectedKpi === stat.filterKey;
          return (
            <div
              key={i}
              onClick={() => {
                setSelectedKpi(isActive ? null : stat.filterKey);
                setSelectedPipelineStage(null);
              }}
              style={{
                background: isActive ? stat.iconBg : "white",
                border: isActive ? `2px solid ${stat.iconColor}` : "1px solid #E2E8F0",
                borderRadius: "12px",
                padding: isActive ? "19px" : "20px",
                cursor: "pointer",
                transition: "all 0.15s",
                userSelect: "none",
              }}
              onMouseEnter={e => {
                if (!isActive) {
                  e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.08)";
                  e.currentTarget.style.transform = "translateY(-2px)";
                }
              }}
              onMouseLeave={e => {
                e.currentTarget.style.boxShadow = "none";
                e.currentTarget.style.transform = "translateY(0)";
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
      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: "20px", marginBottom: "24px" }}>

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
            <button
              onClick={() => router.push(filteredRows.type === "enquiries" ? "/admin/enquiries" : "/admin/orders")}
              style={{ fontSize: "12px", fontWeight: "700", color: "var(--color-primary)", background: "none", border: "none", cursor: "pointer" }}
            >
              View All
            </button>
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
                    onClick={() => router.push("/admin/enquiries")}
                    onMouseEnter={e => (e.currentTarget.style.background = "#F8FAFC")}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: "13px", fontWeight: "700", color: "#0F172A" }}>{enq.business_name || enq.businessName || enq.lead_name || enq.leadName}</div>
                      <div style={{ fontSize: "12px", color: "#64748B", marginTop: "2px" }}>{enq.phone} • {enq.source}</div>
                    </div>
                    <span style={{
                      fontSize: "9px", fontWeight: "800", textTransform: "uppercase",
                      padding: "2px 8px", borderRadius: "4px",
                      background: "#FFFBEB", color: "#D97706", border: "1px solid #FDE68A",
                    }}>{enq.status}</span>
                    <span style={{ fontSize: "11px", color: "#94A3B8" }}>{enq.enquire_id || enq.enquireId}</span>
                  </div>
                ))
              )
            ) : (
              /* Orders view */
              filteredRows.data.length === 0 ? (
                <div style={{ padding: "40px", textAlign: "center", color: "#94A3B8", fontSize: "13px" }}>No orders found.</div>
              ) : (
                filteredRows.data.map((order: any, i: number) => {
                  const stageInfo = STAGE_LABEL[order.stage] || { label: order.stage, dot: "#94A3B8" };
                  return (
                    <div
                      key={order.id}
                      style={{
                        display: "flex", alignItems: "center",
                        padding: "14px 24px",
                        borderBottom: i < filteredRows.data.length - 1 ? "1px solid #F1F5F9" : "none",
                        gap: "12px", cursor: "pointer", transition: "background 0.15s",
                      }}
                      onClick={() => router.push(`/admin/orders/${order.orderId || order.id}`)}
                      onMouseEnter={e => (e.currentTarget.style.background = "#F8FAFC")}
                      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span style={{ fontSize: "13px", fontWeight: "700", color: "#0F172A" }}>{order.orderCode}</span>
                          <span style={{
                            fontSize: "9px", fontWeight: "800", textTransform: "uppercase",
                            padding: "2px 6px", borderRadius: "4px",
                            background: order.health === "Active" ? "#F0FDF4" : "#FEF2F2",
                            color: order.health === "Active" ? "#16A34A" : "#DC2626",
                            border: `1px solid ${order.health === "Active" ? "#BBF7D0" : "#FECACA"}`,
                          }}>{order.health || "Active"}</span>
                        </div>
                        <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#64748B", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {order.customerName || order.projectName}
                        </p>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                        <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: stageInfo.dot, flexShrink: 0 }} />
                        <span style={{ fontSize: "12px", color: "#475569", fontWeight: "600", whiteSpace: "nowrap" }}>{stageInfo.label}</span>
                      </div>
                      <div style={{ position: "relative" }}>
                        <button
                          onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === order.id ? null : order.id); }}
                          style={{ padding: "4px", background: "none", border: "none", cursor: "pointer", color: "#94A3B8", borderRadius: "4px" }}
                        >
                          <MoreHorizontal size={16} />
                        </button>
                        {openMenuId === order.id && (
                          <>
                            <div style={{ position: "fixed", inset: 0, zIndex: 49 }} onClick={() => setOpenMenuId(null)} />
                            <div style={{ position: "absolute", right: 0, top: "calc(100% + 4px)", background: "white", border: "1px solid #E2E8F0", borderRadius: "8px", boxShadow: "0 4px 12px rgba(0,0,0,0.08)", zIndex: 50, minWidth: 140, overflow: "hidden" }}>
                              <button
                                onClick={() => { setOpenMenuId(null); router.push(`/admin/orders/${order.orderId || order.id}`); }}
                                style={{ width: "100%", padding: "9px 14px", display: "flex", alignItems: "center", gap: "8px", background: "none", border: "none", fontSize: "12px", fontWeight: "600", color: "#0F172A", cursor: "pointer", textAlign: "left" }}
                                onMouseEnter={e => e.currentTarget.style.background = "#F8FAFC"}
                                onMouseLeave={e => e.currentTarget.style.background = "none"}
                              >
                                <Eye size={13} /> View Order
                              </button>
                            </div>
                          </>
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
            <h2 style={{ margin: 0, fontSize: "14px", fontWeight: "700", color: "#0F172A" }}>Pending Tickets</h2>
            <span style={{ fontSize: "10px", fontWeight: "800", background: "#EF4444", color: "white", padding: "2px 8px", borderRadius: "99px" }}>
              {pendingTickets.length} open
            </span>
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
      <div style={{ background: "white", border: "1px solid #E2E8F0", borderRadius: "12px", padding: "20px 24px" }}>
        <h2 style={{ margin: "0 0 20px", fontSize: "14px", fontWeight: "700", color: "#0F172A" }}>Order Pipeline</h2>
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${PIPELINE_STAGES.length}, 1fr)`, gap: "8px" }}>
          {pipelineCounts.map((item, i) => {
            const isSelected = selectedPipelineStage === item.stage;
            return (
              <div
                key={item.stage}
                onClick={() => setSelectedPipelineStage(isSelected ? null : item.stage)}
                style={{
                  textAlign: "center",
                  padding: "12px 8px",
                  cursor: "pointer",
                  borderRadius: "10px",
                  background: isSelected ? "rgba(30, 64, 175, 0.05)" : "transparent",
                  border: isSelected ? "1.5px solid var(--color-primary)" : "1.5px solid transparent",
                  transition: "all 0.18s cubic-bezier(0.4, 0, 0.2, 1)",
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
                <div style={{ fontSize: "28px", fontWeight: "800", color: isSelected ? "var(--color-primary)" : "#0F172A", marginBottom: "4px", transition: "color 0.15s" }}>
                  {item.count}
                </div>
                <div
                  style={{
                    width: "100%",
                    height: isSelected ? "6px" : "4px",
                    borderRadius: "99px",
                    background: PIPELINE_COLORS[i] + "30",
                    marginBottom: "8px",
                    overflow: "hidden",
                    transition: "height 0.15s",
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
                <div style={{ fontSize: "11px", fontWeight: isSelected ? "800" : "600", color: isSelected ? "var(--color-primary)" : "#64748B", transition: "color 0.15s" }}>
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
            await createEnquiry(newEnq);
            setIsAddModalOpen(false);
            router.refresh();
          } catch (error) {
            console.error("Error adding enquiry:", error);
            alert("Failed to add enquiry.");
          }
        }}
      />
    </div>
  );
}
