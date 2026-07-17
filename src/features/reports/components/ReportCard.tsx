"use client";

import React from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, LineChart, Line, ComposedChart,
  Legend, RadialBarChart, RadialBar, LabelList, ReferenceLine,
} from "recharts";
import { Download } from "lucide-react";

export type ReportType =
  | "ORDERS_OVER_TIME"
  | "PIPELINE_FUNNEL"
  | "REVENUE_BY_CUSTOMER"
  | "TEAM_PERFORMANCE"
  | "ORDER_STAGE"
  | "TICKET_ANALYSIS"
  | "ENQUIRY_SOURCES"
  | "ORDER_HEALTH"
  | "REVENUE_TREND"
  | "WEEKLY_COMPLETIONS"
  | "CONVERSION_BY_MONTH"
  | "CUSTOMER_RETENTION"
  | "TICKET_STATUS";

interface ReportCardProps {
  title: string;
  description: string;
  type: ReportType;
  data: any[];
  className?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// SINGLE SOURCE OF TRUTH — color system used everywhere in Reports
// ─────────────────────────────────────────────────────────────────────────────
export const C = {
  // Primary semantic colors
  revenue:    "#6366f1",  // indigo    — revenue, primary metric
  orders:     "#0ea5e9",  // sky        — order counts
  customers:  "#14b8a6",  // teal       — customers, retention
  completion: "#22c55e",  // green      — completed / success
  warning:    "#f59e0b",  // amber      — on-hold, conversion ref line
  danger:     "#ef4444",  // red        — lost, danger
  team:       "#8b5cf6",  // violet     — team / employees
  tickets:    "#f97316",  // orange     — service tickets
  sources:    "#ec4899",  // pink       — marketing / sources
  neutral:    "#94a3b8",  // slate      — neutral / enquiries

  // Tints (10% opacity fills for backgrounds)
  revenueTint:   "#eef2ff",
  ordersTint:    "#e0f2fe",
  customersTint: "#ccfbf1",
  teamTint:      "#ede9fe",

  // Light bars / ghost bars
  revenueMuted: "#c7d2fe",  // light indigo — muted/historical bars
  teamMuted:    "#ddd6fe",  // light violet
};

// Ordered palette used for multi-segment charts (pie, funnel, stage)
export const PALETTE = [
  C.revenue, C.customers, C.warning, C.danger,
  C.team, C.orders, C.completion, C.tickets, C.sources, C.neutral,
];

// Semantic colors for order health
const HEALTH_COLORS: Record<string, string> = {
  Active:    C.completion,
  "On Hold": C.warning,
  Lost:      C.danger,
  Cancelled: C.neutral,
  Completed: C.revenue,
};

// ─────────────────────────────────────────────────────────────────────────────
// Shared axis / grid / tooltip styles
// ─────────────────────────────────────────────────────────────────────────────
const axisStyle = { fontSize: 11, fill: "#94a3b8" };
const gridProps  = { strokeDasharray: "3 3", stroke: "#f1f5f9" };

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "#fff", borderRadius: 10, border: "1px solid #e2e8f0",
      boxShadow: "0 10px 25px -5px rgba(0,0,0,0.12)", padding: "10px 14px", fontSize: 12,
    }}>
      {label && <p style={{ fontWeight: 700, color: "#1e293b", marginBottom: 4 }}>{label}</p>}
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color || C.revenue, margin: "2px 0" }}>
          {p.name}:{" "}
          <strong>
            {typeof p.value === "number" && p.value > 1000
              ? `₹${p.value.toLocaleString("en-IN")}`
              : p.value}
          </strong>
        </p>
      ))}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// CSV export
// ─────────────────────────────────────────────────────────────────────────────
function exportToCSV(data: any[], filename: string) {
  if (!data?.length) return;
  const headers = Object.keys(data[0]).join(",");
  const rows = data.map(row => Object.values(row).join(",")).join("\n");
  const blob = new Blob([`${headers}\n${rows}`], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = `${filename}.csv`; a.click();
  URL.revokeObjectURL(url);
}

// ─────────────────────────────────────────────────────────────────────────────
// ReportCard
// ─────────────────────────────────────────────────────────────────────────────
export function ReportCard({ title, description, type, data, className = "" }: ReportCardProps) {
  const isEmpty = !data || data.length === 0;

  const renderChart = () => {
    if (isEmpty) {
      return (
        <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8 }}>
          <div style={{ width: 44, height: 44, borderRadius: "50%", background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>📊</div>
          <span style={{ fontSize: 13, color: "#94a3b8" }}>No data for this period</span>
        </div>
      );
    }

    switch (type) {

      // ── Revenue Trend — indigo bars + sky line ────────────────────────────
      case "REVENUE_TREND":
        return (
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="rt_rev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={C.revenue} stopOpacity={0.85} />
                  <stop offset="95%" stopColor={C.revenue} stopOpacity={0.5} />
                </linearGradient>
              </defs>
              <CartesianGrid {...gridProps} vertical={false} />
              <XAxis dataKey="month" axisLine={false} tickLine={false} tick={axisStyle} dy={8} />
              <YAxis axisLine={false} tickLine={false} tick={axisStyle} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
              <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={axisStyle} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="revenue" name="Revenue (₹)" fill={`url(#rt_rev)`} radius={[6, 6, 0, 0]} />
              <Line dataKey="orders" name="Orders" stroke={C.orders} strokeWidth={2.5} dot={{ r: 3, fill: C.orders }} type="monotone" yAxisId="right" />
            </ComposedChart>
          </ResponsiveContainer>
        );

      // ── Orders Over Time — indigo (count) + teal (revenue) area ──────────
      case "ORDERS_OVER_TIME":
        return (
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="oot_ord" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={C.revenue} stopOpacity={0.28} />
                  <stop offset="95%" stopColor={C.revenue} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="oot_rev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={C.customers} stopOpacity={0.28} />
                  <stop offset="95%" stopColor={C.customers} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid {...gridProps} vertical={false} />
              <XAxis dataKey="month" axisLine={false} tickLine={false} tick={axisStyle} dy={8} />
              <YAxis yAxisId="left"  axisLine={false} tickLine={false} tick={axisStyle} />
              <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={axisStyle} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
              <Tooltip content={<CustomTooltip />} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
              <Area yAxisId="left"  type="monotone" dataKey="count"   name="Orders"      stroke={C.revenue}   fill="url(#oot_ord)" strokeWidth={2.5} dot={{ r: 3, fill: C.revenue }} />
              <Area yAxisId="right" type="monotone" dataKey="revenue" name="Revenue (₹)" stroke={C.customers} fill="url(#oot_rev)" strokeWidth={2.5} dot={{ r: 3, fill: C.customers }} />
            </AreaChart>
          </ResponsiveContainer>
        );

      // ── Pipeline Funnel — stepped palette (indigo → teal → amber → green) ─
      case "PIPELINE_FUNNEL": {
        const funnelColors = [C.revenue, C.orders, C.warning, C.completion];
        return (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data} layout="vertical" margin={{ top: 5, right: 40, left: 10, bottom: 5 }}>
              <CartesianGrid {...gridProps} horizontal={false} />
              <XAxis type="number" axisLine={false} tickLine={false} tick={axisStyle} />
              <YAxis type="category" dataKey="stage" axisLine={false} tickLine={false} tick={{ ...axisStyle, fontWeight: 600 }} width={85} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="count" name="Count" radius={[0, 6, 6, 0]}>
                {data.map((_, i) => <Cell key={i} fill={funnelColors[i % funnelColors.length]} />)}
                <LabelList dataKey="count" position="right" style={{ fontSize: 12, fontWeight: 700, fill: "#1e293b" }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        );
      }

      // ── Donut charts (Order Stage / Enquiry Sources / Ticket Status) ───────
      case "ORDER_STAGE":
      case "ENQUIRY_SOURCES":
      case "TICKET_STATUS": {
        const nameKey = type === "ORDER_STAGE" ? "stage" : type === "ENQUIRY_SOURCES" ? "source" : "status";
        const total   = data.reduce((s, d) => s + d.count, 0);
        return (
          <div style={{ display: "flex", alignItems: "center", gap: 8, height: 240 }}>
            <ResponsiveContainer width="55%" height="100%">
              <PieChart>
                <Pie data={data} cx="50%" cy="50%" innerRadius={55} outerRadius={90}
                  paddingAngle={3} dataKey="count" nameKey={nameKey} startAngle={90} endAngle={-270}>
                  {data.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} stroke="none" />)}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 7 }}>
              {data.map((d, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: PALETTE[i % PALETTE.length], flexShrink: 0 }} />
                  <span style={{ fontSize: 11, color: "#64748b", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d[nameKey]}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#1e293b" }}>{total > 0 ? Math.round((d.count / total) * 100) : 0}%</span>
                </div>
              ))}
            </div>
          </div>
        );
      }

      // ── Order Health — semantic HEALTH_COLORS radial bar ──────────────────
      case "ORDER_HEALTH": {
        const total    = data.reduce((s: number, d: any) => s + d.count, 0);
        const enriched = data.map((d: any, i: number) => ({
          ...d,
          fill: HEALTH_COLORS[d.health] || PALETTE[i % PALETTE.length],
          pct:  total > 0 ? Math.round((d.count / total) * 100) : 0,
        }));
        return (
          <div style={{ display: "flex", alignItems: "center", gap: 8, height: 240 }}>
            <ResponsiveContainer width="50%" height="100%">
              <RadialBarChart cx="50%" cy="50%" innerRadius={28} outerRadius={100} data={enriched} startAngle={90} endAngle={-270} barSize={10}>
                <RadialBar dataKey="count" background={{ fill: "#f8fafc" }} cornerRadius={6}>
                  {enriched.map((d: any, i: number) => <Cell key={i} fill={d.fill} />)}
                </RadialBar>
                <Tooltip content={<CustomTooltip />} formatter={(v: any, _n: any, p: any) => [v, p.payload.health]} />
              </RadialBarChart>
            </ResponsiveContainer>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>
              {enriched.map((d: any, i: number) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: d.fill, flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "#334155" }}>{d.health}</div>
                    <div style={{ width: "100%", height: 3, background: "#f1f5f9", borderRadius: 2, marginTop: 2 }}>
                      <div style={{ width: `${d.pct}%`, height: "100%", background: d.fill, borderRadius: 2 }} />
                    </div>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#1e293b", minWidth: 28, textAlign: "right" }}>{d.count}</span>
                </div>
              ))}
            </div>
          </div>
        );
      }

      // ── Revenue by Customer — indigo→teal horizontal gradient bar ─────────
      case "REVENUE_BY_CUSTOMER":
        return (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data} layout="vertical" margin={{ top: 5, right: 50, left: 10, bottom: 5 }}>
              <defs>
                <linearGradient id="rbc_grad" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%"   stopColor={C.revenue} />
                  <stop offset="100%" stopColor={C.customers} />
                </linearGradient>
              </defs>
              <CartesianGrid {...gridProps} horizontal={false} />
              <XAxis type="number" axisLine={false} tickLine={false} tick={axisStyle} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
              <YAxis type="category" dataKey="customer" axisLine={false} tickLine={false} tick={{ ...axisStyle, fontWeight: 600 }} width={90} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="revenue" name="Revenue (₹)" fill="url(#rbc_grad)" radius={[0, 6, 6, 0]}>
                <LabelList dataKey="revenue" position="right" formatter={(v: any) => typeof v === "number" ? `₹${(v / 1000).toFixed(0)}k` : v} style={{ fontSize: 11, fontWeight: 700, fill: "#475569" }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        );

      // ── Team Performance — violet ghost + solid grouped bar ───────────────
      case "TEAM_PERFORMANCE":
        return (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 30 }}>
              <CartesianGrid {...gridProps} vertical={false} />
              <XAxis dataKey="employee" axisLine={false} tickLine={false} tick={{ ...axisStyle, fontWeight: 600 }} angle={-30} textAnchor="end" interval={0} dy={10} />
              <YAxis axisLine={false} tickLine={false} tick={axisStyle} />
              <Tooltip content={<CustomTooltip />} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
              <Bar dataKey="ordersAssigned" name="Assigned"  fill={C.teamMuted} radius={[4, 4, 0, 0]} />
              <Bar dataKey="ordersCompleted" name="Completed" fill={C.team}      radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        );

      // ── Ticket Analysis — orange palette bars ─────────────────────────────
      case "TICKET_ANALYSIS": {
        const ticketColors = [C.danger, C.warning, C.tickets, C.neutral, C.completion];
        return (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid {...gridProps} vertical={false} />
              <XAxis dataKey="priority" axisLine={false} tickLine={false} tick={axisStyle} dy={8} />
              <YAxis axisLine={false} tickLine={false} tick={axisStyle} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="count" name="Tickets" radius={[6, 6, 0, 0]}>
                {data.map((_, i) => <Cell key={i} fill={ticketColors[i % ticketColors.length]} />)}
                <LabelList dataKey="count" position="top" style={{ fontSize: 11, fontWeight: 700, fill: "#475569" }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        );
      }

      // ── Conversion by Month — sky/indigo/teal line trio ───────────────────
      case "CONVERSION_BY_MONTH":
        return (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid {...gridProps} vertical={false} />
              <XAxis dataKey="month" axisLine={false} tickLine={false} tick={axisStyle} dy={8} />
              <YAxis axisLine={false} tickLine={false} tick={axisStyle} />
              <Tooltip content={<CustomTooltip />} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
              <ReferenceLine y={50} stroke={C.warning} strokeDasharray="4 4" label={{ value: "50%", position: "right", fontSize: 10, fill: C.warning }} />
              <Line type="monotone" dataKey="enquiries" name="Enquiries"        stroke={C.neutral}   strokeWidth={2}   dot={{ r: 3 }} />
              <Line type="monotone" dataKey="orders"    name="Orders"           stroke={C.revenue}   strokeWidth={2.5} dot={{ r: 4, fill: C.revenue }}   activeDot={{ r: 6 }} />
              <Line type="monotone" dataKey="rate"      name="Conv. Rate (%)"   stroke={C.customers} strokeWidth={2.5} dot={{ r: 3 }} strokeDasharray="6 2" />
            </LineChart>
          </ResponsiveContainer>
        );

      // ── Customer Retention — indigo (new) + teal (returning) stacked area ─
      case "CUSTOMER_RETENTION":
        return (
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="cr_new" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={C.revenue}   stopOpacity={0.45} />
                  <stop offset="95%" stopColor={C.revenue}   stopOpacity={0.03} />
                </linearGradient>
                <linearGradient id="cr_ret" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={C.customers} stopOpacity={0.45} />
                  <stop offset="95%" stopColor={C.customers} stopOpacity={0.03} />
                </linearGradient>
              </defs>
              <CartesianGrid {...gridProps} vertical={false} />
              <XAxis dataKey="month" axisLine={false} tickLine={false} tick={axisStyle} dy={8} />
              <YAxis axisLine={false} tickLine={false} tick={axisStyle} />
              <Tooltip content={<CustomTooltip />} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
              <Area type="monotone" dataKey="new"       name="New Customers" stackId="1" stroke={C.revenue}   fill="url(#cr_new)" strokeWidth={2} />
              <Area type="monotone" dataKey="returning" name="Returning"     stackId="1" stroke={C.customers} fill="url(#cr_ret)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        );

      // ── Weekly Completions — muted indigo → solid indigo sparkline ────────
      case "WEEKLY_COMPLETIONS":
        return (
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid {...gridProps} vertical={false} />
              <XAxis dataKey="week" axisLine={false} tickLine={false} tick={{ ...axisStyle, fontSize: 10 }} dy={6} />
              <YAxis axisLine={false} tickLine={false} tick={axisStyle} allowDecimals={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="completed" name="Completed" radius={[4, 4, 0, 0]}>
                {data.map((_, i) => (
                  <Cell key={i} fill={i >= data.length - 2 ? C.revenue : C.revenueMuted} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        );

      default:
        return <div style={{ color: "#94a3b8", fontSize: 13, padding: 20 }}>Chart type not supported.</div>;
    }
  };

  const csvFilename = title.toLowerCase().replace(/\s+/g, "_");

  return (
    <div
      className={`bg-white rounded-2xl border border-slate-100 flex flex-col overflow-hidden ${className}`}
      style={{ boxShadow: "0 1px 3px 0 rgb(0 0 0 / 0.06), 0 1px 2px -1px rgb(0 0 0 / 0.06)" }}
    >
      {/* Card Header */}
      <div style={{ padding: "18px 20px 12px", borderBottom: "1px solid #f8fafc", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", lineHeight: 1.3 }}>{title}</div>
          <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>{description}</div>
        </div>
        <button
          onClick={() => exportToCSV(data, csvFilename)}
          title="Export CSV"
          style={{ display: "flex", alignItems: "center", gap: 4, padding: "5px 10px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, cursor: "pointer", fontSize: 11, fontWeight: 600, color: "#64748b", flexShrink: 0, transition: "all 0.15s" }}
          onMouseEnter={e => { e.currentTarget.style.background = "#f1f5f9"; e.currentTarget.style.color = "#334155"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "#f8fafc"; e.currentTarget.style.color = "#64748b"; }}
        >
          <Download size={12} />
          CSV
        </button>
      </div>
      {/* Chart body */}
      <div style={{ flex: 1, padding: "16px 16px 12px", minHeight: 200 }}>
        {renderChart()}
      </div>
    </div>
  );
}
