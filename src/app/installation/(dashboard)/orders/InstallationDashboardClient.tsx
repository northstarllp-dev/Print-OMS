"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, ClipboardList, CheckCircle, ArrowRight, MapPin } from "lucide-react";
import Link from "next/link";
import { parseOrderStage } from "@/features/orders/workspace/shared/stageGrants";
import {
  countQueueViews,
  partitionQueueOrdersByView,
} from "@/features/orders/workspace/shared/staffQueueStages";
import { QueueViewToggle } from "@/features/orders/components/QueueViewToggle";
import type { QueueView, WorkflowType } from "@/features/orders/workspace/shared/staffQueueStages";

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
  workflow_type?: WorkflowType | null;
  scheduledDate?: string | null;
  scheduledTime?: string | null;
  siteAddress?: string | null;
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
    "Customer Pickup": { bg: "bg-amber-50/70", text: "text-amber-700", border: "border-amber-200" },
    "Completed": { bg: "bg-emerald-50/70", text: "text-emerald-700", border: "border-emerald-200" },
    "Closed": { bg: "bg-slate-50/70", text: "text-slate-600", border: "border-slate-200" },
  };
  return styles[stage] || { bg: "bg-slate-50/70", text: "text-slate-600", border: "border-slate-200" };
};

function formatInstallVisit(order: OrderItem) {
  if (!order.scheduledDate) return null;
  const dateLabel = new Date(order.scheduledDate + "T00:00:00").toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  return {
    dateLabel,
    timeLabel: order.scheduledTime || null,
    address: order.siteAddress || null,
  };
}

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

  const filteredOrders = queueScopedOrders.filter((order) => {
    const matchesSearch =
      (order.clientName || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (order.businessName || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.orderCode.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;
    if (stageFilter !== "ALL") return order.stage === stageFilter;
    return true;
  });

  return (
    <div className="p-3 sm:p-4 md:p-6 lg:p-8 bg-slate-50/50 min-h-screen">
      <div className="mb-6 md:mb-8">
        <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-slate-900 tracking-tight mb-2">
          Installation Queue
        </h1>
        <p className="text-sm text-slate-500 font-medium">
          Monitor and update active on-site installation orders.
        </p>
        <div className="mt-4 overflow-x-auto -mx-1 px-1">
          <QueueViewToggle
            value={queueView}
            onChange={setQueueView}
            incomingCount={queueViewCounts.incoming}
            currentCount={queueViewCounts.current}
            completedCount={queueViewCounts.completed}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:gap-6 mb-6 md:mb-8">
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 md:p-6 shadow-sm">
          <div className="flex justify-between items-start mb-3 md:mb-4">
            <span className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-wider">
              Current
            </span>
            <div className="w-7 h-7 md:w-8 md:h-8 bg-indigo-50 rounded-lg flex items-center justify-center">
              <ClipboardList size={14} className="text-indigo-600" />
            </div>
          </div>
          <div className="text-2xl md:text-3xl font-black text-slate-800 mb-1">{activeJobs}</div>
          <p className="text-[11px] md:text-xs text-slate-500 font-semibold">In installation</p>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 md:p-6 shadow-sm">
          <div className="flex justify-between items-start mb-3 md:mb-4">
            <span className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-wider">
              Completed
            </span>
            <div className="w-7 h-7 md:w-8 md:h-8 bg-emerald-50 rounded-lg flex items-center justify-center">
              <CheckCircle size={14} className="text-emerald-600" />
            </div>
          </div>
          <div className="text-2xl md:text-3xl font-black text-slate-800 mb-1">{completedJobs}</div>
          <p className="text-[11px] md:text-xs text-slate-500 font-semibold">Past this phase</p>
        </div>
      </div>

      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-4 md:p-5 border-b border-slate-200/80 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          <div className="w-full md:flex-1 md:max-w-md relative">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search project, customer, or code..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-50 text-slate-800 text-sm pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:border-green-500 focus:bg-white transition-all"
            />
          </div>

          <select
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value)}
            className="w-full md:w-auto bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 cursor-pointer focus:outline-none focus:ring-2 focus:ring-green-500/10"
          >
            <option value="ALL">All Stages</option>
            <option value="Ready For Installation">Ready For Installation</option>
            <option value="Installation Scheduled">Installation Scheduled</option>
            <option value="Completed">Completed</option>
            <option value="Closed">Closed</option>
          </select>
        </div>

        {/* Mobile cards */}
        <div className="lg:hidden divide-y divide-slate-100">
          {filteredOrders.length > 0 ? (
            filteredOrders.map((order) => {
              const badgeStyle = getStageBadgeStyle(order.stage);
              const visit = formatInstallVisit(order);
              return (
                <button
                  key={order.id}
                  type="button"
                  onClick={() => router.push(resolveOrderHref(order))}
                  className="w-full text-left p-4 hover:bg-slate-50/80 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="min-w-0">
                      <div className="text-sm font-black text-slate-900 truncate">{order.orderCode}</div>
                      <div className="text-sm font-bold text-slate-800 mt-0.5 truncate">
                        {order.businessName || order.clientName}
                      </div>
                      {order.businessName && order.clientName && (
                        <div className="text-xs text-slate-500 font-medium truncate">{order.clientName}</div>
                      )}
                    </div>
                    <span
                      className={`shrink-0 inline-flex items-center px-2.5 py-1 text-[10px] font-bold rounded-full border ${badgeStyle.bg} ${badgeStyle.text} ${badgeStyle.border}`}
                    >
                      {order.stage}
                    </span>
                  </div>

                  {visit ? (
                    <div className="mt-2 rounded-xl bg-slate-50 border border-slate-100 px-3 py-2">
                      <div className="text-xs font-bold text-indigo-600">
                        {visit.dateLabel}
                        {visit.timeLabel ? ` · ${visit.timeLabel}` : ""}
                      </div>
                      {visit.address && (
                        <div className="flex items-center gap-1.5 mt-1 text-[11px] text-slate-500 font-medium min-w-0">
                          <MapPin size={12} className="shrink-0" />
                          <span className="truncate" title={visit.address}>{visit.address}</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="mt-2 text-xs text-slate-400 italic">Not scheduled</div>
                  )}

                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-[11px] text-slate-400 font-medium">
                      Started{" "}
                      {new Date(order.dateCreated).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-green-600 uppercase tracking-wider">
                      View Job <ArrowRight size={12} />
                    </span>
                  </div>
                </button>
              );
            })
          ) : (
            <div className="py-12 text-center text-sm font-semibold text-slate-400">
              No installation orders found.
            </div>
          )}
        </div>

        {/* Desktop table */}
        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-50/70 border-b border-slate-200/80">
                <th className="text-left py-4 px-6 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Order ID</th>
                <th className="text-left py-4 px-6 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Client Name</th>
                <th className="text-left py-4 px-6 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Business Name</th>
                <th className="text-left py-4 px-6 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Current Stage</th>
                <th className="text-left py-4 px-6 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Date Initiated</th>
                <th className="text-left py-4 px-6 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Installation Visit</th>
                <th className="text-right py-4 px-6 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.length > 0 ? (
                filteredOrders.map((order) => {
                  const badgeStyle = getStageBadgeStyle(order.stage);
                  const visit = formatInstallVisit(order);
                  return (
                    <tr
                      key={order.id}
                      className="border-b border-slate-100 hover:bg-slate-50/30 transition-all duration-150 cursor-pointer"
                      onClick={() => router.push(resolveOrderHref(order))}
                    >
                      <td className="py-4 px-6 text-sm font-bold text-slate-800">{order.orderCode}</td>
                      <td className="py-4 px-6 text-sm font-extrabold text-slate-900">{order.clientName}</td>
                      <td className="py-4 px-6 text-sm font-medium text-slate-600">{order.businessName}</td>
                      <td className="py-4 px-6">
                        <span
                          className={`inline-flex items-center px-3 py-1 text-xs font-bold rounded-full border ${badgeStyle.bg} ${badgeStyle.text} ${badgeStyle.border}`}
                        >
                          {order.stage}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-sm text-slate-500 font-medium">
                        {new Date(order.dateCreated).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>
                      <td className="py-4 px-6">
                        {visit ? (
                          <div>
                            <div className="text-sm text-indigo-600 font-bold">
                              {visit.dateLabel}
                              {visit.timeLabel && (
                                <span className="text-slate-500 font-medium ml-1">@ {visit.timeLabel}</span>
                              )}
                            </div>
                            {visit.address && (
                              <div className="text-xs text-slate-400 font-medium mt-0.5 max-w-[180px] truncate" title={visit.address}>
                                📍 {visit.address}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 italic">Not scheduled</span>
                        )}
                      </td>
                      <td className="py-4 px-6 text-right">
                        <Link
                          href={resolveOrderHref(order)}
                          onClick={(e) => e.stopPropagation()}
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
