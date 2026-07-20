"use client";

import React, { useState } from "react";
import { ReportCard, C } from "./ReportCard";
import { ReportChatBox } from "./ReportChatBox";
import {
  BarChart2, MessageSquare, TrendingUp, TrendingDown, Package,
  IndianRupee, Target, AlertCircle, Activity, Filter, X,
  LayoutDashboard, Layers,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

interface ReportsPageClientProps {
  reportData: any;
  initialFrom?: string;
  initialTo?: string;
}

// ── KPI Card component ────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, icon: Icon, trend, trendLabel, color }: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  trend?: number;
  trendLabel?: string;
  color: string;
}) {
  const isPositive = (trend ?? 0) >= 0;
  return (
    <div style={{
      background: "#fff",
      border: "1px solid #f1f5f9",
      borderRadius: 16,
      padding: "18px 20px",
      display: "flex",
      flexDirection: "column",
      gap: 10,
      boxShadow: "0 1px 3px 0 rgb(0 0 0 / 0.05)",
      flex: 1,
      minWidth: 0,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: "#64748b", letterSpacing: "0.02em" }}>{label}</span>
        <div style={{ width: 32, height: 32, borderRadius: 10, background: `${color}18`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Icon size={15} color={color} />
        </div>
      </div>
      <div style={{ fontSize: 26, fontWeight: 800, color: "#0f172a", lineHeight: 1 }}>{value}</div>
      {(trend !== undefined || sub) && (
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {trend !== undefined && (
            <span style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 11, fontWeight: 700, color: isPositive ? "#16a34a" : "#dc2626", background: isPositive ? "#dcfce7" : "#fee2e2", borderRadius: 6, padding: "2px 6px" }}>
              {isPositive ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
              {Math.abs(trend)}%
            </span>
          )}
          {trendLabel && <span style={{ fontSize: 11, color: "#94a3b8" }}>{trendLabel}</span>}
          {sub && !trendLabel && <span style={{ fontSize: 11, color: "#94a3b8" }}>{sub}</span>}
        </div>
      )}
    </div>
  );
}

// ── Quick preset buttons ────────────────────────────────────────────────────
const PRESETS = [
  { label: "7 days", days: 7 },
  { label: "30 days", days: 30 },
  { label: "90 days", days: 90 },
  { label: "12 months", days: 365 },
];

function getPresetDates(days: number) {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - days);
  return {
    from: from.toISOString().split("T")[0],
    to: to.toISOString().split("T")[0],
  };
}

// ── Tab button ─────────────────────────────────────────────────────────────
function Tab({ label, icon: Icon, active, onClick }: { label: string; icon: React.ElementType; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 7,
        padding: "9px 18px",
        borderRadius: 10,
        border: "none",
        cursor: "pointer",
        fontSize: 13,
        fontWeight: active ? 700 : 500,
        color: active ? C.revenue : "#64748b",
        background: active ? "#fff" : "transparent",
        boxShadow: active ? "0 1px 4px rgba(30,64,175,0.12), 0 0 0 1px rgba(30,64,175,0.08)" : "none",
        transition: "all 0.2s",
      }}
    >
      <Icon size={15} />
      {label}
    </button>
  );
}

// ── Format helpers ─────────────────────────────────────────────────────────
function formatINR(n: number): string {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(1)}Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(0)}k`;
  return `₹${n}`;
}

export function ReportsPageClient({ reportData, initialFrom, initialTo }: ReportsPageClientProps) {
  const [activeTab, setActiveTab] = useState<"overview" | "deep" | "chat">("overview");
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleDateChange = (type: "from" | "to", value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(type, value);
    else params.delete(type);
    router.push(`?${params.toString()}`);
  };

  const applyPreset = (days: number) => {
    const { from, to } = getPresetDates(days);
    const params = new URLSearchParams();
    params.set("from", from);
    params.set("to", to);
    router.push(`?${params.toString()}`);
  };

  const clearDates = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("from");
    params.delete("to");
    router.push(`?${params.toString()}`);
  };

  const k = reportData?.kpis || {};

  return (
    <div style={{ padding: "28px 32px", background: "#f8fafc", minHeight: "100%", display: "flex", flexDirection: "column", gap: 24 }}>

      {/* ── Page Header ──────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: `linear-gradient(135deg, ${C.revenue}, ${C.orders})`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <BarChart2 size={20} color="#fff" />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#0f172a" }}>Reports & Analytics</h1>
              <p style={{ margin: 0, fontSize: 13, color: "#64748b", marginTop: 2 }}>Real-time insights across your entire business pipeline</p>
            </div>
          </div>
        </div>

        {/* Date filter panel */}
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
          {/* Preset chips */}
          {PRESETS.map(p => (
            <button key={p.days} onClick={() => applyPreset(p.days)} style={{
              padding: "6px 12px", borderRadius: 8, border: "1px solid #e2e8f0",
              background: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 600, color: "#475569",
              transition: "all 0.15s",
            }}
            onMouseEnter={e => { e.currentTarget.style.background = "#f1f5f9"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "#fff"; }}>
              {p.label}
            </button>
          ))}
          {/* Date range inputs */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: "6px 12px" }}>
            <Filter size={13} color="#94a3b8" />
            <input type="date" value={initialFrom || ""} onChange={e => handleDateChange("from", e.target.value)}
              style={{ fontSize: 12, border: "none", outline: "none", background: "transparent", color: "#475569", cursor: "pointer" }} />
            <span style={{ fontSize: 12, color: "#94a3b8" }}>→</span>
            <input type="date" value={initialTo || ""} onChange={e => handleDateChange("to", e.target.value)}
              style={{ fontSize: 12, border: "none", outline: "none", background: "transparent", color: "#475569", cursor: "pointer" }} />
            {(initialFrom || initialTo) && (
              <button onClick={clearDates} style={{ display: "flex", background: "none", border: "none", cursor: "pointer", padding: 0, color: "#94a3b8" }}>
                <X size={14} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── KPI Strip ────────────────────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
        <KpiCard label="Total Revenue"   value={formatINR(k.totalRevenue  || 0)} icon={IndianRupee} trend={k.revenueGrowth} trendLabel="vs last month" color={C.revenue}    />
        <KpiCard label="Total Orders"     value={String(k.totalOrders   || 0)} sub="all time"       icon={Package}     color={C.orders}     />
        <KpiCard label="Avg. Order Value" value={formatINR(k.avgOrderValue || 0)} sub="per order"   icon={TrendingUp}  color={C.customers}  />
        <KpiCard label="Conversion Rate"  value={`${k.conversionRate || 0}%`}   sub="enquiry → order" icon={Target}   color={C.warning}    />
        <KpiCard label="Active Orders"    value={String(k.activeOrders  || 0)} sub="in pipeline"   icon={Activity}    color={C.team}       />
        <KpiCard label="Open Tickets"     value={String(k.openTickets   || 0)} sub="need attention" icon={AlertCircle} color={C.danger}     />
      </div>

      {/* ── Tab Bar ──────────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", gap: 4, background: "#f1f5f9", borderRadius: 14, padding: 4, width: "fit-content" }}>
        <Tab label="Overview" icon={LayoutDashboard} active={activeTab === "overview"} onClick={() => setActiveTab("overview")} />
        <Tab label="Deep Dive" icon={Layers} active={activeTab === "deep"} onClick={() => setActiveTab("deep")} />
        <Tab label="AI Builder" icon={MessageSquare} active={activeTab === "chat"} onClick={() => setActiveTab("chat")} />
      </div>

      {/* ── OVERVIEW TAB ─────────────────────────────────────────────────────── */}
      {activeTab === "overview" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16, animation: "fadeSlideIn 0.3s ease" }}>
          {/* Row 1: Revenue Trend (wide) + Order Health */}
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16 }}>
            <ReportCard
              type="REVENUE_TREND"
              title="Revenue & Order Trend"
              description="Monthly revenue (bars) overlaid with order count (line)"
              data={reportData.revenueTrend}
            />
            <ReportCard
              type="ORDER_HEALTH"
              title="Order Health"
              description="Active, on-hold, lost & completed breakdown"
              data={reportData.orderHealthBreakdown}
            />
          </div>

          {/* Row 2: Orders Over Time + Pipeline Funnel */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <ReportCard
              type="CUSTOMER_RETENTION"
              title="Customer Retention"
              description="New vs returning customers per month"
              data={reportData.customerRetention}
            />
            <ReportCard
              type="PIPELINE_FUNNEL"
              title="Pipeline Funnel"
              description="Enquiries → Orders → Installation → Completed"
              data={reportData.conversionFunnel}
            />
          </div>

          {/* Row 3: Conversion by Month + Weekly Completions */}
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16 }}>
            <ReportCard
              type="CONVERSION_BY_MONTH"
              title="Monthly Conversion Trend"
              description="Enquiries vs orders placed with conversion rate %"
              data={reportData.conversionByMonth}
            />
            <ReportCard
              type="WEEKLY_COMPLETIONS"
              title="Weekly Completions"
              description="Orders completed per week (last 12 weeks)"
              data={reportData.weeklyCompletions}
            />
          </div>
        </div>
      )}

      {/* ── DEEP DIVE TAB ────────────────────────────────────────────────────── */}
      {activeTab === "deep" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16, animation: "fadeSlideIn 0.3s ease" }}>
          {/* Row 1: Orders over time */}
          <ReportCard
            type="ORDERS_OVER_TIME"
            title="Orders Over Time"
            description="Monthly order volume and estimated revenue (dual-axis area chart)"
            data={reportData.ordersByMonth}
          />

          {/* Row 2: Top Customers + Order Stage */}
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16 }}>
            <ReportCard
              type="REVENUE_BY_CUSTOMER"
              title="Top 10 Customers by Revenue"
              description="Highest revenue generating customers"
              data={reportData.revenueByCustomer}
            />
            <ReportCard
              type="ORDER_STAGE"
              title="Order Stage Breakdown"
              description="Distribution of orders by their current pipeline stage"
              data={reportData.ordersByStage}
            />
          </div>

          {/* Row 3: Team Performance */}
          <ReportCard
            type="TEAM_PERFORMANCE"
            title="Team Performance"
            description="Assigned vs completed orders per team member"
            data={reportData.teamPerformance}
          />

          {/* Row 4: Enquiry Sources + Ticket Priority + Ticket Status */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
            <ReportCard
              type="ENQUIRY_SOURCES"
              title="Enquiry Sources"
              description="Where your leads are coming from"
              data={reportData.enquirySourceBreakdown}
            />
            <ReportCard
              type="TICKET_ANALYSIS"
              title="Tickets by Priority"
              description="Support ticket distribution by priority level"
              data={reportData.ticketsByPriority}
            />
            <ReportCard
              type="TICKET_STATUS"
              title="Ticket Status Mix"
              description="Open, in-progress, and resolved ticket breakdown"
              data={reportData.ticketStatusBreakdown}
            />
          </div>
        </div>
      )}

      {/* ── AI BUILDER TAB ───────────────────────────────────────────────────── */}
      {activeTab === "chat" && (
        <div style={{ height: 700, animation: "fadeSlideIn 0.3s ease" }}>
          <ReportChatBox reportData={reportData} />
        </div>
      )}

      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
