"use client";

import React, { useState } from "react";
import { ReportCard } from "./ReportCard";
import { ReportChatBox } from "./ReportChatBox";
import { BarChart2, MessageSquare, Download, Filter, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

interface ReportsPageClientProps {
  reportData: any;
  initialFrom?: string;
  initialTo?: string;
}

export function ReportsPageClient({ reportData, initialFrom, initialTo }: ReportsPageClientProps) {
  const [activeTab, setActiveTab] = useState("templates");
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleDateChange = (type: "from" | "to", value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(type, value);
    else params.delete(type);
    router.push(`?${params.toString()}`);
  };

  return (
    <div className="p-4 md:p-8 bg-slate-50 min-h-screen">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <BarChart2 className="text-blue-600" />
            Reports & Analytics
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Automated insights and AI-powered custom reports.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg p-1 px-2 shadow-sm">
            <Filter size={14} className="text-slate-400" />
            <input
              type="date"
              value={initialFrom || ""}
              onChange={(e) => handleDateChange("from", e.target.value)}
              className="text-sm outline-none bg-transparent text-slate-600"
            />
            <span className="text-slate-400 text-sm">to</span>
            <input
              type="date"
              value={initialTo || ""}
              onChange={(e) => handleDateChange("to", e.target.value)}
              className="text-sm outline-none bg-transparent text-slate-600"
            />
            {(initialFrom || initialTo) && (
              <button
                onClick={() => {
                  const params = new URLSearchParams(searchParams.toString());
                  params.delete("from");
                  params.delete("to");
                  router.push(`?${params.toString()}`);
                }}
                className="flex items-center justify-center text-slate-400 hover:text-slate-600 p-1 rounded-md transition-colors"
                title="Clear Dates"
              >
                <X size={14} />
              </button>
            )}
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-medium rounded-lg transition-colors shadow-sm">
            <Download size={16} />
            Export Data
          </button>
        </div>
      </div>

      <div className="w-full">
        <div className="flex bg-slate-200/50 p-1 rounded-xl w-fit mb-6 border border-slate-200">
          <button
            onClick={() => setActiveTab("templates")}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
              activeTab === "templates" 
                ? "bg-white text-blue-600 shadow-sm" 
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
            }`}
          >
            <BarChart2 size={16} />
            Template Reports
          </button>
          <button
            onClick={() => setActiveTab("chat")}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
              activeTab === "chat" 
                ? "bg-white text-blue-600 shadow-sm" 
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
            }`}
          >
            <MessageSquare size={16} />
            Report Chat Builder
          </button>
        </div>

        {activeTab === "templates" && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            <div className="xl:col-span-2">
              <ReportCard
                type="ORDERS_OVER_TIME"
                title="Orders Over Time"
                description="Monthly order volume and total revenue."
                data={reportData.ordersByMonth}
              />
            </div>
            <div>
              <ReportCard
                type="PIPELINE_FUNNEL"
                title="Pipeline Funnel"
                description="Enquiries to completed orders conversion."
                data={reportData.conversionFunnel}
              />
            </div>
            <div>
              <ReportCard
                type="ORDER_STAGE"
                title="Order Stage Breakdown"
                description="Distribution of orders by their current stage."
                data={reportData.ordersByStage}
              />
            </div>
            <div className="xl:col-span-2">
              <ReportCard
                type="REVENUE_BY_CUSTOMER"
                title="Top 10 Customers"
                description="Highest revenue generating customers."
                data={reportData.revenueByCustomer}
              />
            </div>
            <div className="xl:col-span-2">
              <ReportCard
                type="TEAM_PERFORMANCE"
                title="Team Performance"
                description="Number of completed orders per employee."
                data={reportData.teamPerformance}
              />
            </div>
            <div>
              <ReportCard
                type="ENQUIRY_SOURCES"
                title="Enquiry Sources"
                description="Where leads are coming from."
                data={reportData.enquirySourceBreakdown}
              />
            </div>
            <div className="xl:col-span-3">
              <ReportCard
                type="TICKET_ANALYSIS"
                title="Ticket Analysis"
                description="Service tickets grouped by priority."
                data={reportData.ticketsByPriority}
              />
            </div>
            </div>
          </div>
        )}

        {activeTab === "chat" && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 h-[700px]">
            <ReportChatBox reportData={reportData} />
          </div>
        )}
      </div>
    </div>
  );
}
