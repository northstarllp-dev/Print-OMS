"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, ClipboardList, CheckCircle, ArrowRight } from "lucide-react";
import Link from "next/link";
import { parseOrderStage } from "@/features/orders/workspace/shared/stageGrants";
import {
  countQueueViews,
  partitionQueueOrdersByView,
} from "@/features/orders/workspace/shared/staffQueueStages";
import { QueueViewToggle } from "@/features/orders/components/QueueViewToggle";
import type { QueueView } from "@/features/orders/workspace/shared/staffQueueStages";

interface OrderItem {
  id: string;
  clientName: string;
  businessName: string;
  customerId: string;
  customerName: string;
  stage: string;
  dateCreated: string;
  orderId: string;
  orderCode: string;
}

interface InstallationDashboardClientProps {
  initialOrders: OrderItem[];
  /** Base path for order detail links. Defaults to floor portal `/installation/orders`. */
  orderDetailBasePath?: string;
  /** Optional entryStage query param (e.g. staff queue lock). */
  entryStage?: string;
}

const getStageBadgeStyle = (stage: string) => {
  const styles: Record<string, { bg: string; text: string; border: string }> = {
    "Ready For Installation": { bg: "bg-indigo-50/70", text: "text-indigo-700", border: "border-indigo-200" },
    "Installation Scheduled": { bg: "bg-cyan-50/70", text: "text-cyan-700", border: "border-cyan-200" },
    "Completed": { bg: "bg-emerald-50/70", text: "text-emerald-700", border: "border-emerald-200" },
    "Closed": { bg: "bg-slate-50/70", text: "text-slate-600", border: "border-slate-200" },
  };
  return styles[stage] || { bg: "bg-slate-50/70", text: "text-slate-600", border: "border-slate-200" };
};

export function InstallationDashboardClient({
  initialOrders,
  orderDetailBasePath = "/installation/orders",
  entryStage = "installation",
}: InstallationDashboardClientProps) {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [stageFilter, setStageFilter] = useState("ALL");
  const [queueView, setQueueView] = useState<QueueView>("current");
  const parsedEntryStage = parseOrderStage(entryStage) ?? "installation";

  const queueViewCounts = useMemo(
    () => countQueueViews(initialOrders, parsedEntryStage),
    [initialOrders, parsedEntryStage]
  );

  const queueScopedOrders = useMemo(
    () => partitionQueueOrdersByView(initialOrders, parsedEntryStage, queueView),
    [initialOrders, parsedEntryStage, queueView]
  );

  const resolveOrderHref = (order: OrderItem) => {
    const id = order.orderId || order.id;
    const base = `${orderDetailBasePath}/${id}`;
    return entryStage ? `${base}?entryStage=${entryStage}` : base;
  };

  const activeJobs = countQueueViews(initialOrders, parsedEntryStage).current;
  const completedJobs = countQueueViews(initialOrders, parsedEntryStage).completed;

  const filteredOrders = queueScopedOrders.filter(order => {
    const matchesSearch = 
      (order.clientName || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (order.businessName || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.orderCode.toLowerCase().includes(searchTerm.toLowerCase());
      
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
          Installation Queue
        </h1>
        <p className="text-sm text-slate-500 font-medium">
          Monitor and update active on-site installation orders.
        </p>
        <div className="mt-4">
          <QueueViewToggle
            value={queueView}
            onChange={setQueueView}
            incomingCount={queueViewCounts.incoming}
            currentCount={queueViewCounts.current}
            completedCount={queueViewCounts.completed}
          />
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* Active Jobs Card */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all duration-200">
          <div className="flex justify-between items-start mb-4">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Current
            </span>
            <div className="w-8 height-8 bg-indigo-50 rounded-lg flex items-center justify-center">
              <ClipboardList size={16} className="text-indigo-600" />
            </div>
          </div>
          <div className="text-3xl font-black text-slate-800 mb-1">{activeJobs}</div>
          <p className="text-xs text-slate-500 font-semibold">Orders currently in installation</p>
        </div>

        {/* Completed Jobs Card */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all duration-200">
          <div className="flex justify-between items-start mb-4">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Completed
            </span>
            <div className="w-8 height-8 bg-emerald-50 rounded-lg flex items-center justify-center">
              <CheckCircle size={16} className="text-emerald-600" />
            </div>
          </div>
          <div className="text-3xl font-black text-slate-800 mb-1">{completedJobs}</div>
          <p className="text-xs text-slate-500 font-semibold">Orders past the installation phase</p>
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
              className="w-full bg-slate-50 text-slate-800 text-sm pl-10 pr-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-green-500 focus:bg-white transition-all"
            />
          </div>
          
          <div className="flex gap-2 self-stretch md:self-auto">
            <select
              value={stageFilter}
              onChange={e => setStageFilter(e.target.value)}
              className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 cursor-pointer focus:outline-none focus:ring-2 focus:ring-green-500/10"
            >
              <option value="ALL">All Stages</option>
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
                <th className="text-left py-4 px-6 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Client Name</th>
                <th className="text-left py-4 px-6 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Business Name</th>
                <th className="text-left py-4 px-6 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Current Stage</th>
                <th className="text-left py-4 px-6 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Date Initiated</th>
                <th className="text-left py-4 px-6 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Installation Date</th>
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

                      {/* Client Name */}
                      <td className="py-4 px-6 text-sm font-extrabold text-slate-900">
                        {order.clientName}
                      </td>

                      {/* Business Name */}
                      <td className="py-4 px-6 text-sm font-medium text-slate-600">
                        {order.businessName}
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

                      {/* Installation Date Placeholder */}
                      <td className="py-4 px-6 text-sm text-indigo-500 font-bold">
                        28 Oct 2026
                      </td>

                      {/* Action */}
                      <td className="py-4 px-6 text-right">
                        <Link
                          href={resolveOrderHref(order)}
                          onClick={e => e.stopPropagation()}
                          className="inline-flex items-center gap-1.5 text-xs font-extrabold text-green-600 hover:text-green-700 transition-colors uppercase tracking-wider"
                        >
                          View Job <ArrowRight size={12} />
                        </Link>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-sm font-semibold text-slate-400">
                    No installation orders found.
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
