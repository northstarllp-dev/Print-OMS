"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import {
  IndianRupee,
  Search,
  Wallet,
  AlertCircle,
  CheckCircle2,
  Clock,
  ArrowRight,
  BarChart2,
} from "lucide-react";
import type {
  CompanyCollectionsData,
  OrderPaymentSummary,
} from "@/features/payments/actions/paymentActions";

function formatINR(n: number) {
  return `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

const PAY_STATUS_META = {
  unpaid: {
    label: "Unpaid",
    className: "bg-red-50 text-red-700 border-red-200",
  },
  partial: {
    label: "Partial",
    className: "bg-amber-50 text-amber-800 border-amber-200",
  },
  fully_paid: {
    label: "Paid",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
} as const;

type BalanceFilter = "outstanding" | "paid" | "all";
type SortKey = "outstanding" | "last_paid" | "date";

interface PaymentsCollectionsClientProps {
  data: CompanyCollectionsData;
}

function orderHref(orderCode: string) {
  return `/admin/orders/${orderCode}?tab=payments`;
}

export function PaymentsCollectionsClient({ data }: PaymentsCollectionsClientProps) {
  const [balanceFilter, setBalanceFilter] = useState<BalanceFilter>(() =>
    data.kpis.ordersWithBalance > 0 ? "outstanding" : "all"
  );
  const [stageFilter, setStageFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("outstanding");
  const [showAllReceipts, setShowAllReceipts] = useState(false);

  const stages = useMemo(() => {
    const set = new Set(data.orders.map((o) => o.stage).filter(Boolean));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [data.orders]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = data.orders.filter((o) => {
      if (balanceFilter === "outstanding" && !(o.outstanding > 0)) return false;
      if (balanceFilter === "paid" && o.payStatus !== "fully_paid") return false;
      if (stageFilter !== "all" && o.stage !== stageFilter) return false;
      if (!q) return true;
      const haystack = `${o.orderCode} ${o.clientName} ${o.businessName}`.toLowerCase();
      return haystack.includes(q);
    });

    return [...list].sort((a, b) => {
      if (sortKey === "outstanding") {
        if (b.outstanding !== a.outstanding) return b.outstanding - a.outstanding;
        return (b.dateCreated || "").localeCompare(a.dateCreated || "");
      }
      if (sortKey === "last_paid") {
        return (b.lastPaidAt || "").localeCompare(a.lastPaidAt || "");
      }
      return (b.dateCreated || "").localeCompare(a.dateCreated || "");
    });
  }, [data.orders, balanceFilter, stageFilter, search, sortKey]);

  const { kpis, recentReceipts } = data;
  const RECEIPTS_PREVIEW = 5;
  const visibleReceipts = showAllReceipts
    ? recentReceipts
    : recentReceipts.slice(0, RECEIPTS_PREVIEW);
  const hasMoreReceipts = recentReceipts.length > RECEIPTS_PREVIEW;

  return (
    <div className="space-y-4 sm:space-y-6" style={{ padding: "16px 16px 28px" }}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <IndianRupee size={18} className="text-[var(--color-primary,#1E40AF)] shrink-0" />
            <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 m-0 truncate">
              Payments & Collections
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 m-0">
            Track outstanding balances and recent receipts. Record payments on the order Payment tab.
          </p>
        </div>
        <Link
          href="/admin/reports"
          className="inline-flex items-center gap-1.5 self-start text-xs font-semibold text-slate-600 hover:text-slate-900 border border-slate-200 bg-white rounded-lg px-3 py-2"
        >
          <BarChart2 size={14} />
          View trends
        </Link>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
        <Kpi
          label="Collected"
          value={formatINR(kpis.collected)}
          sub="all received payments"
          icon={Wallet}
          tone="emerald"
        />
        <Kpi
          label="Outstanding"
          value={formatINR(kpis.outstanding)}
          sub={`${kpis.ordersWithBalance} order${kpis.ordersWithBalance === 1 ? "" : "s"}`}
          icon={AlertCircle}
          tone="amber"
        />
        <Kpi
          label="Expected"
          value={formatINR(kpis.expected)}
          sub="logged as expected"
          icon={Clock}
          tone="slate"
        />
        <Kpi
          label="Fully paid"
          value={String(kpis.fullyPaidOrders)}
          sub="orders settled"
          icon={CheckCircle2}
          tone="blue"
        />
      </div>

      {/* Orders + receipts — side by side on laptop; filters only above orders table */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-5 lg:items-start">
        <div className="lg:col-span-8 flex flex-col gap-3 min-h-0">
          {/* Compact filters — not full-page width */}
          <div className="inline-flex flex-wrap items-center gap-1.5 sm:gap-2 bg-white border border-slate-200 rounded-lg px-2 py-1.5 sm:px-2.5 sm:py-2 w-full lg:w-fit lg:max-w-full">
            <div className="relative shrink-0 w-[9.5rem] sm:w-44">
              <Search
                size={12}
                className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
              />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search order, client…"
                className="w-full text-[11px] sm:text-xs font-medium border border-slate-200 rounded-md pl-7 pr-2 py-1 bg-white text-slate-700 outline-none focus:border-slate-400"
              />
            </div>

            <div className="flex shrink-0 items-center gap-1">
              {(
                [
                  ["outstanding", "Outstanding"],
                  ["paid", "Fully paid"],
                  ["all", "All"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={balanceFilter === value}
                  onClick={() => setBalanceFilter(value)}
                  className={`px-2 py-1 rounded-md text-[11px] sm:text-xs font-semibold border whitespace-nowrap cursor-pointer transition-colors ${
                    balanceFilter === value
                      ? "bg-slate-900 text-white border-slate-900"
                      : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <select
              value={stageFilter}
              onChange={(e) => setStageFilter(e.target.value)}
              className="shrink-0 text-[11px] sm:text-xs font-medium border border-slate-200 rounded-md px-2 py-1 bg-white text-slate-700"
            >
              <option value="all">All stages</option>
              {stages.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>

            <div className="flex shrink-0 items-center gap-1">
              <span className="text-[11px] sm:text-xs font-semibold text-slate-500 whitespace-nowrap">
                Sort:
              </span>
              <select
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value as SortKey)}
                className="shrink-0 text-[11px] sm:text-xs font-medium border border-slate-200 rounded-md px-2 py-1 bg-white text-slate-700"
              >
                <option value="outstanding">outstanding</option>
                <option value="last_paid">last paid</option>
                <option value="date">order date</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 px-0.5 shrink-0">
            <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 m-0">
              Orders
            </h2>
            <span className="text-[10px] font-semibold text-slate-400">
              {filtered.length} shown
            </span>
          </div>

          {/* Desktop table */}
          <div className="hidden md:flex flex-1 min-h-[22rem] flex-col bg-white border border-[var(--border)] rounded-[var(--radius-lg)] overflow-hidden">
            <div className="flex-1 min-h-0 overflow-auto">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 z-[1]">
                  <tr className="border-b border-slate-100 bg-slate-50 text-[10px] uppercase tracking-wider text-slate-400">
                    <th className="font-bold px-4 py-2.5 bg-slate-50">Order</th>
                    <th className="font-bold px-3 py-2.5 bg-slate-50">Stage</th>
                    <th className="font-bold px-3 py-2.5 text-right bg-slate-50">Quote</th>
                    <th className="font-bold px-3 py-2.5 text-right bg-slate-50">Received</th>
                    <th className="font-bold px-3 py-2.5 text-right bg-slate-50">Outstanding</th>
                    <th className="font-bold px-3 py-2.5 bg-slate-50">Status</th>
                    <th className="font-bold px-3 py-2.5 bg-slate-50">Last payment</th>
                    <th className="font-bold px-3 py-2.5 w-8 bg-slate-50" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row) => (
                    <OrderTableRow key={row.orderId} row={row} />
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td
                        colSpan={8}
                        className="px-4 py-10 text-center text-slate-400 font-semibold"
                      >
                        No orders match these filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden flex-1 min-h-[22rem] overflow-y-auto space-y-2.5 pr-0.5">
            {filtered.map((row) => (
              <OrderCard key={row.orderId} row={row} />
            ))}
            {filtered.length === 0 && (
              <div className="bg-slate-50 border border-slate-200 border-dashed rounded-[var(--radius-xl)] p-8 text-center text-slate-400 text-xs font-semibold">
                No orders match these filters.
              </div>
            )}
          </div>
        </div>

        {/* Recent receipts — top-aligned beside orders on laptop */}
        <div className="lg:col-span-4 flex flex-col gap-3 lg:sticky lg:top-4">
          <div className="flex items-center justify-between gap-2 shrink-0">
            <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 m-0">
              Recent receipts
            </h2>
            <span className="text-[10px] font-semibold text-slate-400">
              {Math.min(visibleReceipts.length, recentReceipts.length)}
              {hasMoreReceipts ? ` / ${recentReceipts.length}` : ""}
            </span>
          </div>

          <div className="space-y-2.5">
            {visibleReceipts.map((r) => (
              <Link
                key={r.paymentId}
                href={orderHref(r.orderCode)}
                className="block p-3.5 bg-white border border-[var(--border)] rounded-[var(--radius-xl)] hover:border-slate-300 transition-colors"
              >
                <div className="flex justify-between items-start gap-2">
                  <div className="min-w-0">
                    <p className="m-0 text-sm font-bold text-slate-800 truncate">
                      {r.paymentName}
                    </p>
                    <p className="m-0 mt-0.5 text-[10px] font-semibold text-slate-400 truncate">
                      {r.businessName || r.clientName} · {r.orderCode}
                    </p>
                  </div>
                  <span className="text-sm font-extrabold text-emerald-700 shrink-0">
                    {formatINR(r.amount)}
                  </span>
                </div>
                <p className="m-0 mt-2 text-[10px] font-medium text-slate-500">
                  {formatDate(r.paidAt)}
                </p>
              </Link>
            ))}

            {recentReceipts.length === 0 && (
              <div className="bg-slate-50 border border-slate-200 border-dashed rounded-[var(--radius-xl)] p-8 text-center text-slate-400 text-xs font-semibold">
                No receipts recorded yet.
              </div>
            )}

            {hasMoreReceipts && (
              <button
                type="button"
                onClick={() => setShowAllReceipts((v) => !v)}
                className="w-full py-2 text-xs font-bold text-slate-600 hover:text-slate-900 border border-slate-200 bg-white rounded-[var(--radius-lg)] cursor-pointer"
              >
                {showAllReceipts
                  ? "Show less"
                  : `View more (${recentReceipts.length - RECEIPTS_PREVIEW} more)`}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  sub,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  sub: string;
  icon: React.ElementType;
  tone: "emerald" | "amber" | "slate" | "blue";
}) {
  const tones = {
    emerald: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-800",
    slate: "bg-slate-100 text-slate-600",
    blue: "bg-blue-50 text-blue-700",
  };
  return (
    <div className="bg-white border border-[var(--border)] rounded-[var(--radius-lg)] p-3 sm:p-4">
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
          {label}
        </span>
        <span className={`p-1.5 rounded-lg ${tones[tone]}`}>
          <Icon size={14} />
        </span>
      </div>
      <p className="m-0 text-base sm:text-lg font-extrabold text-slate-900 tabular-nums">
        {value}
      </p>
      <p className="m-0 mt-0.5 text-[10px] font-medium text-slate-400">{sub}</p>
    </div>
  );
}

function OrderTableRow({ row }: { row: OrderPaymentSummary }) {
  const meta = PAY_STATUS_META[row.payStatus];
  return (
    <tr className="border-b border-slate-50 hover:bg-slate-50/60">
      <td className="px-4 py-3">
        <Link
          href={orderHref(row.orderCode)}
          className="font-bold text-slate-800 hover:text-[var(--color-primary,#1E40AF)]"
        >
          {row.orderCode}
        </Link>
        <div className="text-[10px] font-semibold text-slate-400 mt-0.5 truncate max-w-[12rem]">
          {row.businessName || row.clientName}
        </div>
      </td>
      <td className="px-3 py-3 text-slate-600 font-medium whitespace-nowrap">{row.stage}</td>
      <td className="px-3 py-3 text-right tabular-nums font-semibold text-slate-700">
        {row.quoteTotal > 0 ? formatINR(row.quoteTotal) : "—"}
      </td>
      <td className="px-3 py-3 text-right tabular-nums font-semibold text-emerald-700">
        {formatINR(row.receivedTotal)}
      </td>
      <td className="px-3 py-3 text-right tabular-nums font-extrabold text-slate-900">
        {formatINR(row.outstanding)}
      </td>
      <td className="px-3 py-3">
        <span className={`prt-badge border text-[9px] uppercase ${meta.className}`}>
          {meta.label}
        </span>
      </td>
      <td className="px-3 py-3 text-slate-500">
        <div className="font-medium truncate max-w-[8rem]">{row.lastPaymentName || "—"}</div>
        <div className="text-[10px]">{formatDate(row.lastPaidAt)}</div>
      </td>
      <td className="px-3 py-3">
        <Link
          href={orderHref(row.orderCode)}
          className="inline-flex text-slate-400 hover:text-slate-700"
          aria-label={`Open payments for ${row.orderCode}`}
        >
          <ArrowRight size={14} />
        </Link>
      </td>
    </tr>
  );
}

function OrderCard({ row }: { row: OrderPaymentSummary }) {
  const meta = PAY_STATUS_META[row.payStatus];
  return (
    <Link
      href={orderHref(row.orderCode)}
      className="block p-3.5 bg-white border border-[var(--border)] rounded-[var(--radius-xl)] space-y-2.5"
    >
      <div className="flex justify-between items-start gap-2">
        <div className="min-w-0">
          <p className="m-0 text-sm font-bold text-slate-800">{row.orderCode}</p>
          <p className="m-0 mt-0.5 text-[10px] font-semibold text-slate-400 truncate">
            {row.businessName || row.clientName} · {row.stage}
          </p>
        </div>
        <span className={`prt-badge border text-[9px] uppercase shrink-0 ${meta.className}`}>
          {meta.label}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-50 text-[10px]">
        <div>
          <div className="font-bold uppercase text-slate-400 tracking-wide">Quote</div>
          <div className="font-semibold text-slate-700 tabular-nums mt-0.5">
            {row.quoteTotal > 0 ? formatINR(row.quoteTotal) : "—"}
          </div>
        </div>
        <div>
          <div className="font-bold uppercase text-slate-400 tracking-wide">Received</div>
          <div className="font-semibold text-emerald-700 tabular-nums mt-0.5">
            {formatINR(row.receivedTotal)}
          </div>
        </div>
        <div>
          <div className="font-bold uppercase text-slate-400 tracking-wide">Due</div>
          <div className="font-extrabold text-slate-900 tabular-nums mt-0.5">
            {formatINR(row.outstanding)}
          </div>
        </div>
      </div>
    </Link>
  );
}
