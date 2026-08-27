"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import {
  Search,
  FileText,
  ArrowRight,
  Filter,
} from "lucide-react";
import type { InvoiceListItem } from "@/features/invoices/actions/invoiceActions";

function formatINR(n: number) {
  return `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

function formatDate(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

const STATUS_META: Record<string, { label: string; className: string }> = {
  Draft: { label: "Draft", className: "bg-slate-100 text-slate-700 border-slate-200" },
  Sent: { label: "Sent", className: "bg-blue-50 text-blue-700 border-blue-200" },
  Paid: { label: "Paid", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  Void: { label: "Void", className: "bg-red-50 text-red-700 border-red-200" },
};

interface InvoiceListClientProps {
  invoices: InvoiceListItem[];
  basePath: "/admin/invoices" | "/staff/invoices";
  orderBasePath: "/admin/orders" | "/staff/orders";
}

export function InvoiceListClient({
  invoices,
  basePath,
  orderBasePath,
}: InvoiceListClientProps) {
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return invoices.filter((inv) => {
      if (statusFilter !== "all" && inv.status !== statusFilter) return false;
      if (!q) return true;
      const haystack =
        `${inv.invoiceId} ${inv.orderCode} ${inv.businessName} ${inv.clientName} ${inv.customerName || ""}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [invoices, statusFilter, search]);

  const counts = useMemo(() => {
    const c = { all: invoices.length, Draft: 0, Sent: 0, Paid: 0, Void: 0 };
    for (const inv of invoices) {
      if (inv.status in c) (c as any)[inv.status]++;
    }
    return c;
  }, [invoices]);

  return (
    <div className="p-3 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-4 sm:space-y-6 pb-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 sm:gap-4">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
            Invoices
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Tax invoices created from approved quotations. Edit, send, and download PDFs.
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <FileText className="w-4 h-4" />
          <span>{counts.all} total</span>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search invoice #, order, customer…"
            className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30"
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="w-4 h-4 text-slate-400 shrink-0" />
          {(["all", "Draft", "Sent", "Paid", "Void"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-bold border transition-colors ${
                statusFilter === s
                  ? "bg-slate-900 text-white border-slate-900"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
              }`}
            >
              {s === "all" ? `All (${counts.all})` : `${s} (${(counts as any)[s] || 0})`}
            </button>
          ))}
        </div>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-12 text-center text-slate-400 text-sm">
            No invoices found. They appear here when a quotation is approved.
          </div>
        ) : (
          filtered.map((inv) => {
            const meta = STATUS_META[inv.status] || STATUS_META.Draft;
            return (
              <Link
                key={inv.id}
                href={`${basePath}/${inv.id}`}
                className="block rounded-2xl border border-slate-200 bg-white p-4 shadow-xs"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-mono text-sm font-bold text-slate-800 truncate">
                      {inv.invoiceId}
                    </div>
                    <div className="mt-1 text-sm font-semibold text-slate-800 truncate">
                      {inv.businessName || inv.customerName || ""}
                    </div>
                    {inv.clientName ? (
                      <div className="text-xs text-slate-500 truncate">{inv.clientName}</div>
                    ) : null}
                  </div>
                  <span
                    className={`shrink-0 inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold uppercase border ${meta.className}`}
                  >
                    {meta.label}
                  </span>
                </div>
                <div className="mt-3 flex items-center justify-between gap-2 text-xs text-slate-600">
                  <span>{formatDate(inv.invoiceDate)}</span>
                  <span className="font-mono font-bold text-slate-900">
                    {formatINR(inv.grandTotal)}
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <span className="font-mono text-[11px] text-[var(--color-primary)]">
                    {inv.orderCode}
                  </span>
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-700">
                    Open <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </Link>
            );
          })
        )}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/80 text-left text-[11px] uppercase tracking-wider text-slate-500">
                <th className="px-4 py-3 font-bold">Invoice</th>
                <th className="px-4 py-3 font-bold">Customer</th>
                <th className="px-4 py-3 font-bold">Order</th>
                <th className="px-4 py-3 font-bold">Date</th>
                <th className="px-4 py-3 font-bold">Status</th>
                <th className="px-4 py-3 font-bold text-right">Amount</th>
                <th className="px-4 py-3 font-bold" />
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-16 text-center text-slate-400">
                    No invoices found. They appear here when a quotation is approved.
                  </td>
                </tr>
              ) : (
                filtered.map((inv) => {
                  const meta = STATUS_META[inv.status] || STATUS_META.Draft;
                  return (
                    <tr
                      key={inv.id}
                      className="border-b border-slate-50 hover:bg-slate-50/60"
                    >
                      <td className="px-4 py-3 font-mono font-bold text-slate-800">
                        {inv.invoiceId}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-800">
                          {inv.businessName || inv.customerName || ""}
                        </div>
                        {inv.clientName && (
                          <div className="text-xs text-slate-500">{inv.clientName}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`${orderBasePath}/${inv.orderCode}`}
                          className="font-mono text-xs text-[var(--color-primary)] hover:underline"
                        >
                          {inv.orderCode}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {formatDate(inv.invoiceDate)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold uppercase border ${meta.className}`}
                        >
                          {meta.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-slate-900">
                        {formatINR(inv.grandTotal)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`${basePath}/${inv.id}`}
                          className="inline-flex items-center gap-1 text-xs font-bold text-slate-700 hover:text-[var(--color-primary)]"
                        >
                          Open <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
