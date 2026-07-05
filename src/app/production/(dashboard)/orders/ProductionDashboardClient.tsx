"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, ClipboardList, AlertTriangle, CheckCircle, ArrowRight, Clock } from "lucide-react";
import Link from "next/link";

interface OrderItem {
  id: string;
  projectName: string;
  customerId: string;
  customerName: string;
  stage: string;
  dateCreated: string;
  orderId: string;
  orderCode: string;
}

interface ProductionDashboardClientProps {
  initialOrders: OrderItem[];
  /** Base path for order detail links. Defaults to floor portal `/production/orders`. */
  orderDetailBasePath?: string;
  /** Optional entryStage query param (e.g. staff queue lock). */
  entryStage?: string;
}

const getStageBadgeStyle = (stage: string) => {
  const styles: Record<string, { bg: string; text: string; border: string }> = {
    "Design Approved": { bg: "bg-purple-50/70", text: "text-purple-700", border: "border-purple-200" },
    "Production": { bg: "bg-blue-50/70", text: "text-blue-700", border: "border-blue-200" },
    "Ready For Installation": { bg: "bg-indigo-50/70", text: "text-indigo-700", border: "border-indigo-200" },
    "Installation Scheduled": { bg: "bg-cyan-50/70", text: "text-cyan-700", border: "border-cyan-200" },
    "Completed": { bg: "bg-emerald-50/70", text: "text-emerald-700", border: "border-emerald-200" },
    "Closed": { bg: "bg-slate-50/70", text: "text-slate-600", border: "border-slate-200" },
  };
  return styles[stage] || { bg: "bg-slate-50/70", text: "text-slate-600", border: "border-slate-200" };
};

export function ProductionDashboardClient({
  initialOrders,
  orderDetailBasePath = "/production/orders",
  entryStage,
}: ProductionDashboardClientProps) {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [stageFilter, setStageFilter] = useState("ALL");

  const resolveOrderHref = (order: OrderItem) => {
    const id = order.orderId || order.id;
    const base = `${orderDetailBasePath}/${id}`;
    return entryStage ? `${base}?entryStage=${entryStage}` : base;
  };

  // Calculations
  const activeJobs = initialOrders.filter(o => o.stage === "Design Approved" || o.stage === "Production" || o.stage === "Ready For Installation").length;
  const completedJobs = initialOrders.filter(o => o.stage === "Completed" || o.stage === "Closed").length;

  const filteredOrders = initialOrders.filter(order => {
    const matchesSearch = 
      order.projectName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.orderCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.customerName.toLowerCase().includes(searchTerm.toLowerCase());
      
    if (!matchesSearch) return false;

    if (stageFilter !== "ALL") {
      return order.stage === stageFilter;
    }

    return true;
  });

  return (
    <div className="p-8 bg-slate-50/50 min-h-screen">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-black text-slate-900 tracking-tight mb-2">
          Fabrication Queue
        </h1>
        <p className="text-sm text-slate-500 font-medium">
          Monitor and update active workshop signage orders post-design approval.
        </p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* Active Jobs Card */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all duration-200">
          <div className="flex justify-between items-start mb-4">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Active Fabrication
            </span>
            <div className="w-8 height-8 bg-blue-50 rounded-lg flex items-center justify-center">
              <ClipboardList size={16} className="text-blue-600" />
            </div>
          </div>
          <div className="text-3xl font-black text-slate-800 mb-1">{activeJobs}</div>
          <p className="text-xs text-slate-500 font-semibold">Orders in production or ready for installation</p>
        </div>

        {/* Completed Jobs Card */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all duration-200">
          <div className="flex justify-between items-start mb-4">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Total Completed
            </span>
            <div className="w-8 height-8 bg-emerald-50 rounded-lg flex items-center justify-center">
              <CheckCircle size={16} className="text-emerald-600" />
            </div>
          </div>
          <div className="text-3xl font-black text-slate-800 mb-1">{completedJobs}</div>
          <p className="text-xs text-slate-500 font-semibold">Fabrication jobs successfully completed</p>
        </div>
      </div>

      {/* Table Container */}
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">
        {/* Search & Filter Bar */}
        <div className="p-5 border-b border-slate-200/80 flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="w-full md:w-96 relative">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by project, customer, or code..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full bg-slate-50 text-slate-800 text-sm pl-10 pr-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
            />
          </div>
          
          <div className="flex gap-2 self-stretch md:self-auto">
            <select
              value={stageFilter}
              onChange={e => setStageFilter(e.target.value)}
              className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500/10"
            >
              <option value="ALL">All Stages</option>
              <option value="Design Approved">Design Approved</option>
              <option value="Production">Production</option>
              <option value="Ready For Installation">Ready For Installation</option>
              <option value="Installation Scheduled">Installation Scheduled</option>
              <option value="Completed">Completed</option>
              <option value="Closed">Closed</option>
            </select>
          </div>
        </div>

        {/* Table list */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-50/70 border-b border-slate-200/80">
                <th className="text-left py-4 px-6 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Order ID</th>
                <th className="text-left py-4 px-6 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Project Name</th>
                <th className="text-left py-4 px-6 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Customer</th>
                <th className="text-left py-4 px-6 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Current Stage</th>
                <th className="text-left py-4 px-6 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Date Initiated</th>
                <th className="text-left py-4 px-6 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Deadline Date</th>
                <th className="text-right py-4 px-6 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.length > 0 ? (
                filteredOrders.map(order => {
                  const badgeStyle = getStageBadgeStyle(order.stage);
                  return (
                    <tr 
                      key={order.id} 
                      className="border-b border-slate-100 hover:bg-slate-50/30 transition-all duration-150 cursor-pointer"
                      onClick={() => router.push(resolveOrderHref(order))}
                    >
                      {/* Code */}
                      <td className="py-4 px-6 text-sm font-bold text-slate-800">
                        {order.orderCode}
                      </td>

                      {/* Project Name */}
                      <td className="py-4 px-6 text-sm font-extrabold text-slate-900">
                        {order.projectName}
                      </td>

                      {/* Customer */}
                      <td className="py-4 px-6 text-sm font-medium text-slate-600">
                        {order.customerName}
                      </td>

                      {/* Current Stage */}
                      <td className="py-4 px-6">
                        <span className={`inline-flex items-center px-3 py-1 text-xs font-bold rounded-full border ${badgeStyle.bg} ${badgeStyle.text} ${badgeStyle.border}`}>
                          {order.stage}
                        </span>
                      </td>



                      {/* Date Created */}
                      <td className="py-4 px-6 text-sm text-slate-500 font-medium">
                        {new Date(order.dateCreated).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric"
                        })}
                      </td>

                      {/* Deadline Date Placeholder */}
                      <td className="py-4 px-6 text-sm text-rose-500 font-bold">
                        24 Oct 2026
                      </td>

                      {/* Action */}
                      <td className="py-4 px-6 text-right">
                        <Link
                          href={resolveOrderHref(order)}
                          onClick={e => e.stopPropagation()}
                          className="inline-flex items-center gap-1.5 text-xs font-extrabold text-blue-600 hover:text-blue-700 transition-colors uppercase tracking-wider"
                        >
                          Fabricate <ArrowRight size={12} />
                        </Link>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-sm font-semibold text-slate-400">
                    No production-ready fabrication orders found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
