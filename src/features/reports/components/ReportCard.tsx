"use client";

import React from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, Line, ComposedChart,
  Legend, LabelList,
} from "recharts";
import { Download } from "lucide-react";

export type ReportType =
  | "PIPELINE_BOTTLENECK"
  | "ORDER_AGING"
  | "CASH_POSITION"
  | "SOURCE_CONVERSION"
  | "TEAM_WORKLOAD"
  | "COLLECTION_TREND"
  | "CONVERSION_FUNNEL"
  | "TOP_CUSTOMERS"
  | "CUSTOMERS_TO_CHASE"
  | "OPEN_TICKETS"
  | "CONVERSION_BY_MONTH";

interface ReportCardProps {
  title: string;
  description: string;
  type: ReportType;
  data: any[];
  className?: string;
}

export const C = {
  revenue: "#1E40AF",
  orders: "#3B82F6",
  customers: "#0EA5E9",
  completion: "#10B981",
  warning: "#F97316",
  danger: "#DC2626",
  team: "#1D4ED8",
  tickets: "#F97316",
  sources: "#2563EB",
  neutral: "#94a3b8",
  revenueTint: "#dbeafe",
  revenueMuted: "#93c5fd",
  teamMuted: "#bfdbfe",
};

export const PALETTE = [
  C.revenue, C.orders, C.warning, C.completion,
  C.customers, C.team, C.tickets, C.sources, C.danger, C.neutral,
];

const AGING_COLORS = [C.completion, C.orders, C.warning, "#EA580C", C.danger];

const axisStyle = { fontSize: 11, fill: "#94a3b8" };
const gridProps = { strokeDasharray: "3 3", stroke: "#f1f5f9" };

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
            {typeof p.value === "number" && (p.name || "").toLowerCase().includes("rate")
              ? `${p.value}%`
              : typeof p.value === "number" && p.value >= 1000
                ? `₹${p.value.toLocaleString("en-IN")}`
                : p.value}
          </strong>
        </p>
      ))}
    </div>
  );
};

function exportToCSV(data: any[], filename: string) {
  if (!data?.length) return;
  const headers = Object.keys(data[0]).join(",");
  const rows = data.map((row) => Object.values(row).join(",")).join("\n");
  const blob = new Blob([`${headers}\n${rows}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

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
      case "PIPELINE_BOTTLENECK":
        return (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data} layout="vertical" margin={{ top: 5, right: 56, left: 10, bottom: 5 }}>
              <CartesianGrid {...gridProps} horizontal={false} />
              <XAxis type="number" axisLine={false} tickLine={false} tick={axisStyle} allowDecimals={false} />
              <YAxis type="category" dataKey="stage" axisLine={false} tickLine={false} tick={{ ...axisStyle, fontWeight: 600 }} width={100} />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const row = payload[0].payload;
                  return (
                    <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #e2e8f0", padding: "10px 14px", fontSize: 12 }}>
                      <p style={{ fontWeight: 700, marginBottom: 4 }}>{row.fullStage || row.stage}</p>
                      <p style={{ margin: 0 }}>{row.count} orders · avg {row.avgAgeDays} days open</p>
                    </div>
                  );
                }}
              />
              <Bar dataKey="count" name="Orders" radius={[0, 6, 6, 0]}>
                {data.map((d: any, i: number) => (
                  <Cell key={i} fill={d.avgAgeDays >= 14 ? C.danger : d.avgAgeDays >= 7 ? C.warning : C.revenue} />
                ))}
                <LabelList
                  dataKey="avgAgeDays"
                  position="right"
                  formatter={(v: any) => `${v}d`}
                  style={{ fontSize: 11, fontWeight: 700, fill: "#64748b" }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        );

      case "ORDER_AGING":
        return (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid {...gridProps} vertical={false} />
              <XAxis dataKey="bucket" axisLine={false} tickLine={false} tick={axisStyle} dy={8} />
              <YAxis axisLine={false} tickLine={false} tick={axisStyle} allowDecimals={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="count" name="Active orders" radius={[6, 6, 0, 0]}>
                {data.map((_, i) => <Cell key={i} fill={AGING_COLORS[i % AGING_COLORS.length]} />)}
                <LabelList dataKey="count" position="top" style={{ fontSize: 11, fontWeight: 700, fill: "#475569" }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        );

      case "CASH_POSITION":
        return (
          <div style={{ display: "flex", alignItems: "center", gap: 8, height: 240 }}>
            <ResponsiveContainer width="55%" height="100%">
              <PieChart>
                <Pie data={data} cx="50%" cy="50%" innerRadius={55} outerRadius={90}
                  paddingAngle={3} dataKey="amount" nameKey="label" startAngle={90} endAngle={-270}>
                  {data.map((d: any, i: number) => (
                    <Cell key={i} fill={d.label === "Outstanding" ? C.warning : C.completion} stroke="none" />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v: any) => [`₹${Number(v).toLocaleString("en-IN")}`, ""]}
                />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>
              {data.map((d: any, i: number) => (
                <div key={i}>
                  <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>{d.label}</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: d.label === "Outstanding" ? C.warning : C.completion }}>
                    ₹{Number(d.amount).toLocaleString("en-IN")}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );

      case "SOURCE_CONVERSION":
        return (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data} layout="vertical" margin={{ top: 5, right: 40, left: 10, bottom: 5 }}>
              <CartesianGrid {...gridProps} horizontal={false} />
              <XAxis type="number" domain={[0, 100]} axisLine={false} tickLine={false} tick={axisStyle} tickFormatter={(v) => `${v}%`} />
              <YAxis type="category" dataKey="source" axisLine={false} tickLine={false} tick={{ ...axisStyle, fontWeight: 600, fontSize: 10 }} width={110} />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const row = payload[0].payload;
                  return (
                    <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #e2e8f0", padding: "10px 14px", fontSize: 12 }}>
                      <p style={{ fontWeight: 700 }}>{row.source}</p>
                      <p style={{ margin: 0 }}>{row.converted}/{row.enquiries} converted · {row.rate}%</p>
                    </div>
                  );
                }}
              />
              <Bar dataKey="rate" name="Conversion %" fill={C.revenue} radius={[0, 6, 6, 0]}>
                <LabelList dataKey="rate" position="right" formatter={(v: any) => `${v}%`} style={{ fontSize: 11, fontWeight: 700, fill: "#475569" }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        );

      case "TEAM_WORKLOAD":
        return (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 30 }}>
              <CartesianGrid {...gridProps} vertical={false} />
              <XAxis dataKey="employee" axisLine={false} tickLine={false} tick={{ ...axisStyle, fontWeight: 600 }} angle={-30} textAnchor="end" interval={0} dy={10} />
              <YAxis axisLine={false} tickLine={false} tick={axisStyle} allowDecimals={false} />
              <Tooltip content={<CustomTooltip />} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
              <Bar dataKey="open" name="Open / in progress" fill={C.warning} radius={[4, 4, 0, 0]} />
              <Bar dataKey="done" name="Completed" fill={C.completion} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        );

      case "COLLECTION_TREND":
        return (
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="coll_grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={C.completion} stopOpacity={0.35} />
                  <stop offset="95%" stopColor={C.completion} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid {...gridProps} vertical={false} />
              <XAxis dataKey="month" axisLine={false} tickLine={false} tick={axisStyle} dy={8} />
              <YAxis axisLine={false} tickLine={false} tick={axisStyle} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="collected" name="Cash collected" stroke={C.completion} fill="url(#coll_grad)" strokeWidth={2.5} />
            </AreaChart>
          </ResponsiveContainer>
        );

      case "CONVERSION_FUNNEL": {
        const funnelColors = [C.neutral, C.orders, C.warning, C.completion];
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

      case "TOP_CUSTOMERS":
        return (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data} layout="vertical" margin={{ top: 5, right: 50, left: 10, bottom: 5 }}>
              <CartesianGrid {...gridProps} horizontal={false} />
              <XAxis type="number" axisLine={false} tickLine={false} tick={axisStyle} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
              <YAxis type="category" dataKey="customer" axisLine={false} tickLine={false} tick={{ ...axisStyle, fontWeight: 600 }} width={90} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="revenue" name="Revenue (₹)" fill={C.revenue} radius={[0, 6, 6, 0]}>
                <LabelList dataKey="revenue" position="right" formatter={(v: any) => typeof v === "number" ? `₹${(v / 1000).toFixed(0)}k` : v} style={{ fontSize: 11, fontWeight: 700, fill: "#475569" }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        );

      case "CUSTOMERS_TO_CHASE":
        return (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data} layout="vertical" margin={{ top: 5, right: 50, left: 10, bottom: 5 }}>
              <CartesianGrid {...gridProps} horizontal={false} />
              <XAxis type="number" axisLine={false} tickLine={false} tick={axisStyle} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
              <YAxis type="category" dataKey="customer" axisLine={false} tickLine={false} tick={{ ...axisStyle, fontWeight: 600 }} width={90} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="outstanding" name="Outstanding (₹)" fill={C.warning} radius={[0, 6, 6, 0]}>
                <LabelList dataKey="outstanding" position="right" formatter={(v: any) => typeof v === "number" ? `₹${(v / 1000).toFixed(0)}k` : v} style={{ fontSize: 11, fontWeight: 700, fill: "#475569" }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        );

      case "OPEN_TICKETS": {
        const ticketColors = [C.danger, C.warning, C.tickets, C.neutral, C.completion];
        return (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid {...gridProps} vertical={false} />
              <XAxis dataKey="priority" axisLine={false} tickLine={false} tick={axisStyle} dy={8} />
              <YAxis axisLine={false} tickLine={false} tick={axisStyle} allowDecimals={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="count" name="Open tickets" radius={[6, 6, 0, 0]}>
                {data.map((_, i) => <Cell key={i} fill={ticketColors[i % ticketColors.length]} />)}
                <LabelList dataKey="count" position="top" style={{ fontSize: 11, fontWeight: 700, fill: "#475569" }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        );
      }

      case "CONVERSION_BY_MONTH":
        return (
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid {...gridProps} vertical={false} />
              <XAxis dataKey="month" axisLine={false} tickLine={false} tick={axisStyle} dy={8} />
              <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={axisStyle} allowDecimals={false} />
              <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={axisStyle} tickFormatter={(v) => `${v}%`} />
              <Tooltip content={<CustomTooltip />} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
              <Bar yAxisId="left" dataKey="enquiries" name="Enquiries" fill={C.revenueMuted} radius={[4, 4, 0, 0]} />
              <Bar yAxisId="left" dataKey="orders" name="Orders" fill={C.revenue} radius={[4, 4, 0, 0]} />
              <Line yAxisId="right" type="monotone" dataKey="rate" name="Conv. %" stroke={C.warning} strokeWidth={2.5} dot={{ r: 3 }} />
            </ComposedChart>
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
      <div style={{ height: 3, background: `linear-gradient(90deg, ${C.revenue} 0%, ${C.orders} 55%, ${C.warning} 100%)` }} />
      <div style={{ padding: "18px 20px 12px", borderBottom: "1px solid #f8fafc", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", lineHeight: 1.3 }}>{title}</div>
          <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>{description}</div>
        </div>
        <button
          onClick={() => exportToCSV(data, csvFilename)}
          title="Export CSV"
          style={{ display: "flex", alignItems: "center", gap: 4, padding: "5px 10px", background: C.revenueTint, border: "1px solid #bfdbfe", borderRadius: 8, cursor: "pointer", fontSize: 11, fontWeight: 600, color: C.revenue, flexShrink: 0 }}
        >
          <Download size={12} />
          CSV
        </button>
      </div>
      <div style={{ flex: 1, padding: "16px 16px 12px", minHeight: 200 }}>
        {renderChart()}
      </div>
    </div>
  );
}
