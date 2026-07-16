"use client";

import React, { useMemo } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from "recharts";

type ReportType =
  | "ORDERS_OVER_TIME"
  | "PIPELINE_FUNNEL"
  | "REVENUE_BY_CUSTOMER"
  | "TEAM_PERFORMANCE"
  | "ORDER_STAGE"
  | "TICKET_ANALYSIS"
  | "ENQUIRY_SOURCES";

interface ReportCardProps {
  title: string;
  description: string;
  type: ReportType;
  data: any[];
}

const COLORS = ["#3B82F6", "#8B5CF6", "#14B8A6", "#F97316", "#0F766E", "#1E40AF", "#EF4444"];

export function ReportCard({ title, description, type, data }: ReportCardProps) {
  const renderChart = () => {
    switch (type) {
      case "ORDERS_OVER_TIME":
        return (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
              <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "#64748B" }} dy={10} />
              <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "#64748B" }} />
              <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "#64748B" }} />
              <Tooltip
                contentStyle={{ borderRadius: "8px", border: "1px solid #E2E8F0", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}
              />
              <Area yAxisId="left" type="monotone" dataKey="count" name="Orders" stroke="#3B82F6" fill="#EFF6FF" strokeWidth={2} />
              <Area yAxisId="right" type="monotone" dataKey="revenue" name="Revenue ($)" stroke="#14B8A6" fill="#F0FDFA" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        );

      case "PIPELINE_FUNNEL":
      case "TEAM_PERFORMANCE":
      case "TICKET_ANALYSIS":
        return (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
              <XAxis dataKey={type === "PIPELINE_FUNNEL" ? "stage" : type === "TEAM_PERFORMANCE" ? "employee" : "priority"} axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "#64748B" }} dy={10} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "#64748B" }} />
              <Tooltip
                cursor={{ fill: "#F8FAFC" }}
                contentStyle={{ borderRadius: "8px", border: "1px solid #E2E8F0", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}
              />
              <Bar dataKey={type === "TEAM_PERFORMANCE" ? "ordersCompleted" : "count"} fill="#3B82F6" radius={[4, 4, 0, 0]}>
                {data.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        );

      case "REVENUE_BY_CUSTOMER":
        return (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data} layout="vertical" margin={{ top: 10, right: 10, left: 20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" />
              <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "#64748B" }} />
              <YAxis type="category" dataKey="customer" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "#64748B" }} width={100} />
              <Tooltip
                cursor={{ fill: "#F8FAFC" }}
                contentStyle={{ borderRadius: "8px", border: "1px solid #E2E8F0", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}
              />
              <Bar dataKey="revenue" fill="#14B8A6" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        );

      case "ORDER_STAGE":
      case "ENQUIRY_SOURCES":
        return (
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={2}
                dataKey="count"
                nameKey={type === "ORDER_STAGE" ? "stage" : "source"}
                labelLine={false}
                label={({ cx, cy, midAngle, innerRadius, outerRadius, value, index }) => {
                  const RADIAN = Math.PI / 180;
                  const safeMidAngle = midAngle || 0;
                  const radius = Number(innerRadius || 0) + (Number(outerRadius || 0) - Number(innerRadius || 0)) * 0.5;
                  const x = Number(cx || 0) + radius * Math.cos(-safeMidAngle * RADIAN);
                  const y = Number(cy || 0) + radius * Math.sin(-safeMidAngle * RADIAN);
                  return (
                    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight="bold">
                      {value}
                    </text>
                  );
                }}
              >
                {data.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ borderRadius: "8px", border: "1px solid #E2E8F0", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}
              />
            </PieChart>
          </ResponsiveContainer>
        );

      default:
        return <div>Invalid Report Type</div>;
    }
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-bold text-slate-900">{title}</CardTitle>
        <CardDescription className="text-sm text-slate-500">{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 min-h-[300px]">
        {data && data.length > 0 ? (
          renderChart()
        ) : (
          <div className="h-full w-full flex items-center justify-center text-slate-400 text-sm">
            No data available for this report.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
