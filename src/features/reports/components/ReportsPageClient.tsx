"use client";

import React, { useState } from "react";
import { ReportCard, C } from "./ReportCard";
import { ReportChatBox } from "./ReportChatBox";
import {
  BarChart2, MessageSquare, TrendingUp, TrendingDown, Package,
  Target, AlertCircle, Activity, Filter, X,
  LayoutDashboard, Layers, Clock, Wallet,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

interface ReportsPageClientProps {
  reportData: any;
  initialFrom?: string;
  initialTo?: string;
}

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

function formatINR(n: number): string {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(1)}Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(0)}k`;
  return `₹${n}`;
}

export function ReportsPageClient({ reportData, initialFrom, initialTo }: ReportsPageClientProps) {
  const [activeTab, setActiveTab] = useState<"overview" | "money" | "chat">("overview");
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
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: `linear-gradient(135deg, ${C.revenue}, ${C.orders})`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <BarChart2 size={20} color="#fff" />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#0f172a" }}>Decision Reports</h1>
              <p style={{ margin: 0, fontSize: 13, color: "#64748b", marginTop: 2 }}>
                Actionable views what to chase, unblock, and invest in
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
          {PRESETS.map((p) => (
            <button key={p.days} onClick={() => applyPreset(p.days)} style={{
              padding: "6px 12px", borderRadius: 8, border: "1px solid #e2e8f0",
              background: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 600, color: "#475569",
            }}>
              {p.label}
            </button>
          ))}
          <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: "6px 12px" }}>
            <Filter size={13} color="#94a3b8" />
            <span style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase" }}>From</span>
            <input type="date" value={initialFrom || ""} onChange={(e) => handleDateChange("from", e.target.value)}
              style={{ fontSize: 12, border: "none", outline: "none", background: "transparent", color: "#475569", cursor: "pointer" }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase" }}>To</span>
            <input type="date" value={initialTo || ""} onChange={(e) => handleDateChange("to", e.target.value)}
              style={{ fontSize: 12, border: "none", outline: "none", background: "transparent", color: "#475569", cursor: "pointer" }} />
            {(initialFrom || initialTo) && (
              <button onClick={clearDates} style={{ display: "flex", background: "none", border: "none", cursor: "pointer", padding: 0, color: "#94a3b8" }}>
                <X size={14} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Decision KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
        <KpiCard label="Outstanding" value={formatINR(k.outstanding || 0)} sub="to collect" icon={Wallet} color={C.warning} />
        <KpiCard label="Stuck Orders" value={String(k.stuckOrders || 0)} sub="open 7+ days" icon={Clock} color={C.danger} />
        <KpiCard label="Avg Age" value={`${k.avgAgeDays || 0}d`} sub="active pipeline" icon={Activity} color={C.team} />
        <KpiCard label="Conversion" value={`${k.conversionRate || 0}%`} sub="enquiry → order" icon={Target} color={C.completion} />
        <KpiCard label="Active Orders" value={String(k.activeOrders || 0)} sub="in flight" icon={Package} color={C.orders} />
        <KpiCard label="Urgent Tickets" value={String(k.highPriorityTickets || 0)} sub={`${k.openTickets || 0} open total`} icon={AlertCircle} color={C.danger} />
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 4, background: "#f1f5f9", borderRadius: 14, padding: 4, width: "fit-content" }}>
        <Tab label="Act Now" icon={LayoutDashboard} active={activeTab === "overview"} onClick={() => setActiveTab("overview")} />
        <Tab label="Money & Growth" icon={Layers} active={activeTab === "money"} onClick={() => setActiveTab("money")} />
        <Tab label="AI Builder" icon={MessageSquare} active={activeTab === "chat"} onClick={() => setActiveTab("chat")} />
      </div>

      {activeTab === "overview" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16, animation: "fadeSlideIn 0.3s ease" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 16 }}>
            <ReportCard
              type="PIPELINE_BOTTLENECK"
              title="Pipeline Bottlenecks"
              description="Where active work is stuck label shows average days open (red = 14d+)"
              data={reportData.pipelineBottleneck}
            />
            <ReportCard
              type="ORDER_AGING"
              title="Order Aging Risk"
              description="Chase 8–14 day and 15+ day jobs before they slip"
              data={reportData.orderAging}
            />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
            <ReportCard
              type="CASH_POSITION"
              title="Cash Position"
              description="Collected vs still owed on approved quotes"
              data={reportData.cashPosition}
            />
            <ReportCard
              type="CUSTOMERS_TO_CHASE"
              title="Customers to Chase"
              description="Largest outstanding balances call these first"
              data={reportData.customersToChase}
            />
            <ReportCard
              type="OPEN_TICKETS"
              title="Open Tickets by Priority"
              description="Unresolved service work by urgency"
              data={reportData.openTicketsByPriority}
            />
          </div>
          <ReportCard
            type="TEAM_WORKLOAD"
            title="Team Workload"
            description="Open vs completed load rebalance overloaded staff"
            data={reportData.teamWorkload}
          />
        </div>
      )}

      {activeTab === "money" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16, animation: "fadeSlideIn 0.3s ease" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 16 }}>
            <ReportCard
              type="COLLECTION_TREND"
              title="Cash Collection Trend"
              description="Actual money received month by month"
              data={reportData.collectionTrend}
            />
            <ReportCard
              type="CONVERSION_FUNNEL"
              title="Pipeline Funnel"
              description="Where leads drop off before completion"
              data={reportData.conversionFunnel}
            />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <ReportCard
              type="SOURCE_CONVERSION"
              title="Lead Source Conversion"
              description="Invest in sources with the highest convert %"
              data={reportData.sourceConversion}
            />
            <ReportCard
              type="TOP_CUSTOMERS"
              title="Top Customers by Revenue"
              description="Highest value accounts to protect"
              data={reportData.topCustomersByRevenue}
            />
          </div>
          <ReportCard
            type="CONVERSION_BY_MONTH"
            title="Monthly Conversion"
            description="Enquiries vs orders is win-rate improving?"
            data={reportData.conversionByMonth}
          />
        </div>
      )}

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
        @media (max-width: 900px) {
          div[style*="grid-template-columns"] { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
