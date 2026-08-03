"use client";

import React, { useMemo, useState, useTransition } from "react";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowLeftRight,
  Boxes,
  Check,
  Pencil,
  Printer,
  Plus,
  ScanBarcode,
  X,
} from "lucide-react";
import type {
  InventoryStockRow,
  StockMovementRecord,
  StockTxnType,
  WarehouseKind,
  WarehouseRecord,
} from "@/features/inventory/types";
import {
  IN_TXN_TYPES,
  OUT_TXN_TYPES,
  TXN_TYPE_LABELS,
  WAREHOUSE_KIND_LABELS,
} from "@/features/inventory/types";
import {
  createWarehouseAction,
  recordStockMovementAction,
  setWarehouseActiveAction,
  transferStockAction,
  updateProductMinStockAction,
} from "@/features/inventory/actions/inventoryActions";

// ── Code 39 barcode (SVG) ────────────────────────────────────────────────────

const CODE39: Record<string, string> = {
  "0": "101001101101", "1": "110100101011", "2": "101100101011", "3": "110110010101",
  "4": "101001101011", "5": "110100110101", "6": "101100110101", "7": "101001011011",
  "8": "110100101101", "9": "101100101101", A: "110101001011", B: "101101001011",
  C: "110110100101", D: "101011001011", E: "110101100101", F: "101101100101",
  G: "101010011011", H: "110101001101", I: "101101001101", J: "101011001101",
  K: "110101010011", L: "101101010011", M: "110110101001", N: "101011010011",
  O: "110101101001", P: "101101101001", Q: "101010110011", R: "110101011001",
  S: "101101011001", T: "101011011001", U: "110010101011", V: "100110101011",
  W: "110011010101", X: "100101101011", Y: "110010110101", Z: "100110110101",
  "-": "100101011011", ".": "110010101101", " ": "100110101101", "$": "100100100101",
  "/": "100100101001", "+": "100101001001", "%": "101001001001", "*": "100101101101",
};

function code39Svg(value: string): string {
  const sanitized = `*${value.toUpperCase().replace(/[^0-9A-Z\-. $/+%]/g, "-")}*`;
  let bars = "";
  let x = 0;
  for (const ch of sanitized) {
    const pattern = CODE39[ch] ?? CODE39["-"];
    for (let i = 0; i < pattern.length; i++) {
      if (pattern[i] === "1") {
        bars += `<rect x="${x}" y="0" width="1" height="48" fill="#000"/>`;
      }
      x += 1;
    }
    x += 1; // inter-character gap
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${x * 2}" height="48" viewBox="0 0 ${x} 48" preserveAspectRatio="none">${bars}</svg>`;
}

function printLabel(row: InventoryStockRow) {
  const code = row.barcode || row.product_code;
  const w = window.open("", "_blank", "width=420,height=280");
  if (!w) return;
  w.document.write(`<!DOCTYPE html><html><head><title>Label — ${row.product_code}</title>
    <style>
      body { font-family: ui-monospace, monospace; padding: 16px; text-align: center; }
      .name { font-size: 14px; font-weight: 700; margin-bottom: 4px; }
      .code { font-size: 12px; letter-spacing: 2px; margin-top: 4px; }
      svg { width: 100%; max-width: 320px; height: 56px; }
    </style></head><body>
    <div class="name">${row.name}</div>
    ${code39Svg(code)}
    <div class="code">${code}</div>
    <script>window.onload = () => { window.print(); };</script>
  </body></html>`);
  w.document.close();
}

// ── Component ────────────────────────────────────────────────────────────────

type MovementMode = "receive" | "issue" | "transfer";

interface InventoryDashboardProps {
  stock: InventoryStockRow[];
  ledger: StockMovementRecord[];
  warehouses: WarehouseRecord[];
  isAdmin: boolean;
}

function stockStatus(row: InventoryStockRow): "out" | "low" | "ok" {
  if (row.total_quantity <= 0) return "out";
  if (row.min_stock != null && row.total_quantity <= row.min_stock) return "low";
  return "ok";
}

export function InventoryDashboard({
  stock,
  ledger,
  warehouses,
  isAdmin,
}: InventoryDashboardProps) {
  const [tab, setTab] = useState<"stock" | "ledger" | "warehouses">("stock");
  const [search, setSearch] = useState("");
  const [lowOnly, setLowOnly] = useState(false);
  const [kindFilter, setKindFilter] = useState<"All" | "Final" | "Regular">("All");
  const [movement, setMovement] = useState<{
    mode: MovementMode;
    row: InventoryStockRow | null;
  } | null>(null);

  const tracked = useMemo(
    () => stock.filter((r) => r.track_inventory && r.is_active),
    [stock]
  );

  const filtered = useMemo(() => {
    const text = search.trim().toLowerCase();
    return tracked.filter((row) => {
      if (lowOnly && stockStatus(row) === "ok") return false;
      if (kindFilter === "Final" && !row.final_prdt) return false;
      if (kindFilter === "Regular" && row.final_prdt) return false;
      if (!text) return true;
      return [
        row.name,
        row.product_code,
        row.barcode ?? "",
        row.supplier_name ?? "",
        row.category ?? "",
        row.brand ?? "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(text);
    });
  }, [tracked, search, lowOnly, kindFilter]);

  const lowCount = tracked.filter((r) => stockStatus(r) !== "ok").length;

  return (
    <div className="p-4 md:p-8 space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="m-0 text-2xl font-extrabold text-slate-900">Inventory &amp; Warehouse</h1>
          <p className="m-0 mt-1 text-sm text-slate-500">
            Stock levels, movement ledger, and warehouses — products are the material master.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setMovement({ mode: "receive", row: null })}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white"
          >
            <ArrowDownToLine size={15} /> Receive
          </button>
          <button
            type="button"
            onClick={() => setMovement({ mode: "issue", row: null })}
            className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-3 py-2 text-sm font-semibold text-white"
          >
            <ArrowUpFromLine size={15} /> Issue
          </button>
          <button
            type="button"
            onClick={() => setMovement({ mode: "transfer", row: null })}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white"
          >
            <ArrowLeftRight size={15} /> Transfer
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: "Tracked SKUs", value: tracked.length },
          { label: "Low / Out of Stock", value: lowCount },
          { label: "Warehouses", value: warehouses.filter((w) => w.is_active).length },
          { label: "Movements (recent)", value: ledger.length },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{s.label}</div>
            <div className="mt-1 text-2xl font-extrabold text-slate-900">{s.value}</div>
          </div>
        ))}
      </div>

      <div className="flex gap-2 border-b border-slate-200">
        {[
          { id: "stock", label: "Stock" },
          { id: "ledger", label: "Stock Ledger" },
          { id: "warehouses", label: "Warehouses" },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id as typeof tab)}
            className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px ${
              tab === t.id
                ? "border-slate-900 text-slate-900"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "stock" ? (
        <>
          <div className="rounded-xl border border-slate-200 bg-white p-3 flex flex-wrap items-center gap-2">
            <div className="relative min-w-[240px] flex-1">
              <ScanBarcode size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, SKU, barcode, supplier, category, brand..."
                className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm"
              />
            </div>
            <select
              value={kindFilter}
              onChange={(e) => setKindFilter(e.target.value as typeof kindFilter)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            >
              <option value="All">All products</option>
              <option value="Regular">Regular</option>
              <option value="Final">Final products</option>
            </select>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700">
              <input
                type="checkbox"
                checked={lowOnly}
                onChange={(e) => setLowOnly(e.target.checked)}
              />
              Low stock only
            </label>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full min-w-[980px]">
              <thead className="bg-slate-50">
                <tr>
                  {["Product", "Category / Brand", "Supplier", "Stock", "Per Warehouse", "Min", "Status", "Actions"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-slate-500">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => {
                  const status = stockStatus(row);
                  return (
                    <tr key={row.id} className="border-t border-slate-100">
                      <td className="px-4 py-3">
                        <div className="text-sm font-semibold text-slate-900">
                          {row.name}
                          {row.final_prdt ? (
                            <span className="ml-2 rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700">
                              FINAL
                            </span>
                          ) : null}
                        </div>
                        <div className="text-xs text-slate-500">
                          {row.product_code}
                          {row.barcode ? ` · ${row.barcode}` : ""}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700">
                        {[row.category, row.brand].filter(Boolean).join(" / ") || "-"}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700">{row.supplier_name || "-"}</td>
                      <td className="px-4 py-3 text-sm font-bold text-slate-900">
                        {row.total_quantity} {row.unit || ""}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">
                        {row.balances.length
                          ? row.balances
                              .filter((b) => b.quantity !== 0)
                              .map((b) => `${b.warehouse_name}: ${b.quantity}`)
                              .join(" · ") || "-"
                          : "-"}
                      </td>
                      <td className="px-4 py-3">
                        <MinStockCell
                          productId={row.id}
                          value={row.min_stock}
                          canEdit={isAdmin}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${
                            status === "ok"
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                              : status === "low"
                                ? "border-amber-200 bg-amber-50 text-amber-700"
                                : "border-red-200 bg-red-50 text-red-700"
                          }`}
                        >
                          {status === "ok" ? "In Stock" : status === "low" ? "Low Stock" : "Out of Stock"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1.5">
                          <button
                            type="button"
                            title="Receive stock"
                            onClick={() => setMovement({ mode: "receive", row })}
                            className="rounded-md border border-slate-200 p-1.5 text-emerald-600"
                          >
                            <ArrowDownToLine size={14} />
                          </button>
                          <button
                            type="button"
                            title="Issue stock"
                            onClick={() => setMovement({ mode: "issue", row })}
                            className="rounded-md border border-slate-200 p-1.5 text-rose-600"
                          >
                            <ArrowUpFromLine size={14} />
                          </button>
                          <button
                            type="button"
                            title="Print barcode label"
                            onClick={() => printLabel(row)}
                            className="rounded-md border border-slate-200 p-1.5 text-slate-600"
                          >
                            <Printer size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-sm text-slate-500">
                      No products found.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </>
      ) : null}

      {tab === "ledger" ? <LedgerTable ledger={ledger} /> : null}

      {tab === "warehouses" ? (
        <WarehousesTab warehouses={warehouses} isAdmin={isAdmin} />
      ) : null}

      {movement ? (
        <MovementModal
          mode={movement.mode}
          preselected={movement.row}
          stock={tracked}
          warehouses={warehouses.filter((w) => w.is_active)}
          onClose={() => setMovement(null)}
        />
      ) : null}
    </div>
  );
}

// ── Ledger tab ───────────────────────────────────────────────────────────────

function LedgerTable({ ledger }: { ledger: StockMovementRecord[] }) {
  const [text, setText] = useState("");
  const rows = useMemo(() => {
    const t = text.trim().toLowerCase();
    if (!t) return ledger;
    return ledger.filter((m) =>
      [m.product_name, m.product_code, m.warehouse_name, m.reference ?? "", TXN_TYPE_LABELS[m.txn_type]]
        .join(" ")
        .toLowerCase()
        .includes(t)
    );
  }, [ledger, text]);

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-slate-200 bg-white p-3">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Filter by product, warehouse, type, reference..."
          className="w-full min-w-[220px] rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />
      </div>
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[920px]">
          <thead className="bg-slate-50">
            <tr>
              {["Date", "Product", "Warehouse", "Type", "Qty", "Balance After", "Reference", "By"].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-slate-500">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((m) => (
              <tr key={m.id} className="border-t border-slate-100">
                <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">
                  {new Date(m.created_at).toLocaleString("en-IN", {
                    day: "2-digit",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </td>
                <td className="px-4 py-3">
                  <div className="text-sm font-semibold text-slate-900">{m.product_name}</div>
                  <div className="text-xs text-slate-500">{m.product_code}</div>
                </td>
                <td className="px-4 py-3 text-sm text-slate-700">{m.warehouse_name}</td>
                <td className="px-4 py-3 text-sm text-slate-700">{TXN_TYPE_LABELS[m.txn_type]}</td>
                <td className={`px-4 py-3 text-sm font-bold ${m.direction === "in" ? "text-emerald-600" : "text-rose-600"}`}>
                  {m.direction === "in" ? "+" : "-"}
                  {m.quantity}
                </td>
                <td className="px-4 py-3 text-sm text-slate-700">{m.balance_after ?? "-"}</td>
                <td className="px-4 py-3 text-xs text-slate-600">{m.reference || "-"}</td>
                <td className="px-4 py-3 text-xs text-slate-600">{m.actor_name || "-"}</td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-sm text-slate-500">
                  No stock movements yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Warehouses tab ───────────────────────────────────────────────────────────

function WarehousesTab({
  warehouses,
  isAdmin,
}: {
  warehouses: WarehouseRecord[];
  isAdmin: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [form, setForm] = useState({ code: "", name: "", kind: "branch" as WarehouseKind });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    startTransition(async () => {
      try {
        await createWarehouseAction(form);
        window.location.reload();
      } catch (err: any) {
        setError(err.message || "Failed to create warehouse.");
      }
    });
  };

  return (
    <div className="space-y-4">
      {isAdmin ? (
        <form
          onSubmit={handleCreate}
          className="rounded-xl border border-slate-200 bg-white p-3 flex flex-wrap items-end gap-2"
        >
          <div>
            <label className="block text-[11px] font-bold uppercase text-slate-500">Code</label>
            <input
              required
              value={form.code}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
              placeholder="WH-VAN1"
              className="mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
          <div className="flex-1 min-w-[180px]">
            <label className="block text-[11px] font-bold uppercase text-slate-500">Name</label>
            <input
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Delivery Vehicle 1"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold uppercase text-slate-500">Kind</label>
            <select
              value={form.kind}
              onChange={(e) => setForm((f) => ({ ...f, kind: e.target.value as WarehouseKind }))}
              className="mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
            >
              {(Object.keys(WAREHOUSE_KIND_LABELS) as WarehouseKind[]).map((k) => (
                <option key={k} value={k}>
                  {WAREHOUSE_KIND_LABELS[k]}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={isPending}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            <Plus size={15} /> Add Warehouse
          </button>
          {error ? <div className="w-full text-sm font-semibold text-red-600">{error}</div> : null}
        </form>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[560px]">
          <thead className="bg-slate-50">
            <tr>
              {["Code", "Name", "Kind", "Status", "Actions"].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-slate-500">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {warehouses.map((w) => (
              <WarehouseRow key={w.id} warehouse={w} isAdmin={isAdmin} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function WarehouseRow({ warehouse, isAdmin }: { warehouse: WarehouseRecord; isAdmin: boolean }) {
  const [isPending, startTransition] = useTransition();
  return (
    <tr className="border-t border-slate-100">
      <td className="px-4 py-3 text-sm font-mono text-slate-700">{warehouse.code}</td>
      <td className="px-4 py-3 text-sm font-semibold text-slate-900">{warehouse.name}</td>
      <td className="px-4 py-3 text-sm text-slate-700">{WAREHOUSE_KIND_LABELS[warehouse.kind]}</td>
      <td className="px-4 py-3">
        <span
          className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${
            warehouse.is_active
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-slate-200 bg-slate-50 text-slate-600"
          }`}
        >
          {warehouse.is_active ? "Active" : "Inactive"}
        </span>
      </td>
      <td className="px-4 py-3">
        {isAdmin ? (
          <button
            type="button"
            disabled={isPending}
            onClick={() =>
              startTransition(async () => {
                await setWarehouseActiveAction(warehouse.id, !warehouse.is_active);
                window.location.reload();
              })
            }
            className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700 disabled:opacity-50"
          >
            {warehouse.is_active ? "Deactivate" : "Activate"}
          </button>
        ) : null}
      </td>
    </tr>
  );
}

// ── Min stock inline edit ────────────────────────────────────────────────────

function MinStockCell({
  productId,
  value,
  canEdit,
}: {
  productId: string;
  value: number | null;
  canEdit: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value != null ? String(value) : "");
  const [display, setDisplay] = useState(value);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  if (!canEdit) {
    return <span className="text-sm text-slate-700">{display ?? "-"}</span>;
  }

  if (!editing) {
    return (
      <button
        type="button"
        title="Edit min stock"
        onClick={() => {
          setDraft(display != null ? String(display) : "");
          setError("");
          setEditing(true);
        }}
        className="group inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-sm text-slate-700 hover:bg-slate-100"
      >
        <span className="tabular-nums">{display ?? "-"}</span>
        <Pencil size={11} className="text-slate-400 opacity-0 group-hover:opacity-100" />
      </button>
    );
  }

  const save = () => {
    setError("");
    const trimmed = draft.trim();
    const next = trimmed === "" ? null : Number(trimmed);
    if (trimmed !== "" && (!Number.isFinite(next) || (next as number) < 0)) {
      setError("Invalid");
      return;
    }
    startTransition(async () => {
      try {
        await updateProductMinStockAction(productId, next);
        setDisplay(next);
        setEditing(false);
      } catch (err: any) {
        setError(err?.message || "Failed");
      }
    });
  };

  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center gap-1">
        <input
          type="number"
          min="0"
          step="1"
          autoFocus
          value={draft}
          disabled={isPending}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              save();
            }
            if (e.key === "Escape") setEditing(false);
          }}
          className="w-16 rounded-md border border-slate-300 px-1.5 py-1 text-sm tabular-nums"
        />
        <button
          type="button"
          disabled={isPending}
          onClick={save}
          className="rounded-md border border-emerald-200 bg-emerald-50 p-1 text-emerald-700 disabled:opacity-50"
        >
          <Check size={12} />
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => setEditing(false)}
          className="rounded-md border border-slate-200 p-1 text-slate-500 disabled:opacity-50"
        >
          <X size={12} />
        </button>
      </div>
      {error ? <span className="text-[10px] font-semibold text-red-600">{error}</span> : null}
    </div>
  );
}

// ── Movement modal ───────────────────────────────────────────────────────────

function MovementModal({
  mode,
  preselected,
  stock,
  warehouses,
  onClose,
}: {
  mode: MovementMode;
  preselected: InventoryStockRow | null;
  stock: InventoryStockRow[];
  warehouses: WarehouseRecord[];
  onClose: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [productId, setProductId] = useState(preselected?.id ?? "");
  const [productSearch, setProductSearch] = useState("");
  const [warehouseId, setWarehouseId] = useState(warehouses[0]?.id ?? "");
  const [toWarehouseId, setToWarehouseId] = useState(warehouses[1]?.id ?? warehouses[0]?.id ?? "");
  const defaultTxn: StockTxnType = mode === "receive" ? "purchase" : "production_consumption";
  const [txnType, setTxnType] = useState<StockTxnType>(defaultTxn);
  const [quantity, setQuantity] = useState("");
  const [unitCost, setUnitCost] = useState("");
  const [totalCost, setTotalCost] = useState("");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");

  const roundMoney = (n: number) => Math.round(n * 100) / 100;

  const syncFromUnit = (qtyStr: string, unitStr: string) => {
    const q = Number(qtyStr);
    const u = Number(unitStr);
    if (qtyStr && unitStr && Number.isFinite(q) && Number.isFinite(u) && q > 0) {
      setTotalCost(String(roundMoney(q * u)));
    } else if (!unitStr) {
      setTotalCost("");
    }
  };

  const syncFromTotal = (qtyStr: string, totalStr: string) => {
    const q = Number(qtyStr);
    const t = Number(totalStr);
    if (qtyStr && totalStr && Number.isFinite(q) && Number.isFinite(t) && q > 0) {
      setUnitCost(String(roundMoney(t / q)));
    } else if (!totalStr) {
      setUnitCost("");
    }
  };

  const titles: Record<MovementMode, string> = {
    receive: "Receive Stock",
    issue: "Issue Stock",
    transfer: "Transfer Stock",
  };

  const productOptions = useMemo(() => {
    const text = productSearch.trim().toLowerCase();
    if (!text) return stock;
    return stock.filter((p) =>
      [p.name, p.product_code, p.barcode ?? ""].join(" ").toLowerCase().includes(text)
    );
  }, [stock, productSearch]);

  const selectedProduct = stock.find((p) => p.id === productId) ?? null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const qty = Number(quantity);
    if (!productId) { setError("Select a product."); return; }
    if (!Number.isFinite(qty) || qty <= 0) { setError("Enter a valid quantity."); return; }

    startTransition(async () => {
      try {
        if (mode === "transfer") {
          await transferStockAction({
            productId,
            fromWarehouseId: warehouseId,
            toWarehouseId,
            quantity: qty,
            reference: reference || null,
            notes: notes || null,
          });
        } else {
          await recordStockMovementAction({
            productId,
            warehouseId,
            direction: mode === "receive" ? "in" : "out",
            txnType,
            quantity: qty,
            unitCost: unitCost ? Number(unitCost) : null,
            reference: reference || null,
            notes: notes || null,
          });
        }
        window.location.reload();
      } catch (err: any) {
        setError(err.message || "Failed to record movement.");
      }
    });
  };

  const txnOptions = mode === "receive" ? IN_TXN_TYPES : OUT_TXN_TYPES;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/55 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100">
              <Boxes size={17} className="text-slate-700" />
            </div>
            <h3 className="m-0 text-base font-extrabold text-slate-900">{titles[mode]}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100"
          >
            <X size={14} className="text-slate-500" />
          </button>
        </div>

        {error ? (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
            {error}
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[11px] font-bold uppercase text-slate-500">Product</label>
            {preselected ? (
              <div className="mt-1 flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <div className="min-w-0 text-sm font-semibold text-slate-800">
                  {preselected.name}{" "}
                  <span className="text-xs font-normal text-slate-500">({preselected.product_code})</span>
                </div>
                <span className="shrink-0 text-xs font-bold tabular-nums text-slate-600">
                  {preselected.total_quantity} {preselected.unit || ""}
                </span>
              </div>
            ) : (
              <>
                <input
                  value={productSearch}
                  onChange={(e) => {
                    setProductSearch(e.target.value);
                    setProductId("");
                  }}
                  placeholder="Search name, SKU, or scan barcode..."
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  autoComplete="off"
                />
                {selectedProduct ? (
                  <div className="mt-2 flex items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
                    <div className="min-w-0 text-sm font-semibold text-slate-800">
                      {selectedProduct.name}{" "}
                      <span className="text-xs font-normal text-slate-500">({selectedProduct.product_code})</span>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="text-xs font-bold tabular-nums text-slate-600">
                        {selectedProduct.total_quantity} {selectedProduct.unit || ""}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setProductId("");
                          setProductSearch("");
                        }}
                        className="text-[10px] font-bold uppercase text-slate-500 hover:text-slate-800"
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-2 max-h-44 overflow-y-auto rounded-lg border border-slate-200">
                    {productOptions.length === 0 ? (
                      <p className="m-0 px-3 py-3 text-xs text-slate-400">No products match your search.</p>
                    ) : (
                      productOptions.slice(0, 40).map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => {
                            setProductId(p.id);
                            setProductSearch(p.name);
                            if (p.purchase_price != null && Number.isFinite(p.purchase_price)) {
                              const unit = String(p.purchase_price);
                              setUnitCost(unit);
                              if (quantity) syncFromUnit(quantity, unit);
                              else setTotalCost("");
                            }
                          }}
                          className="flex w-full items-center justify-between gap-3 border-b border-slate-100 px-3 py-2 text-left last:border-b-0 hover:bg-slate-50"
                        >
                          <span className="min-w-0 truncate text-sm font-semibold text-slate-800">
                            {p.name}{" "}
                            <span className="font-normal text-slate-400">({p.product_code})</span>
                          </span>
                          <span className="shrink-0 text-xs font-bold tabular-nums text-slate-500">
                            {p.total_quantity} {p.unit || ""}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold uppercase text-slate-500">
                {mode === "transfer" ? "From Warehouse" : "Warehouse"}
              </label>
              <select
                value={warehouseId}
                onChange={(e) => setWarehouseId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              >
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>
            {mode === "transfer" ? (
              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-500">To Warehouse</label>
                <select
                  value={toWarehouseId}
                  onChange={(e) => setToWarehouseId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                >
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </div>
            ) : (
              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-500">Transaction Type</label>
                <select
                  value={txnType}
                  onChange={(e) => setTxnType(e.target.value as StockTxnType)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                >
                  {txnOptions.map((t) => (
                    <option key={t} value={t}>{TXN_TYPE_LABELS[t]}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className={`grid gap-3 ${mode !== "transfer" ? "grid-cols-3" : "grid-cols-2"}`}>
            <div>
              <label className="block text-[11px] font-bold uppercase text-slate-500">Quantity</label>
              <input
                type="number"
                required
                min="0.01"
                step="0.01"
                value={quantity}
                onChange={(e) => {
                  const next = e.target.value;
                  setQuantity(next);
                  if (unitCost) syncFromUnit(next, unitCost);
                  else if (totalCost) syncFromTotal(next, totalCost);
                }}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
            {mode !== "transfer" ? (
              <>
                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-500">Unit Cost (₹)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={unitCost}
                    onChange={(e) => {
                      const next = e.target.value;
                      setUnitCost(next);
                      syncFromUnit(quantity, next);
                    }}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-500">Total Cost (₹)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={totalCost}
                    onChange={(e) => {
                      const next = e.target.value;
                      setTotalCost(next);
                      syncFromTotal(quantity, next);
                    }}
                    placeholder="Qty × unit"
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
              </>
            ) : (
              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-500">Reference</label>
                <input
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="e.g. TRF-14"
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
            )}
          </div>

          {mode !== "transfer" ? (
            <div>
              <label className="block text-[11px] font-bold uppercase text-slate-500">Reference</label>
              <input
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="e.g. PO number, invoice, job"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
          ) : null}

          <div>
            <label className="block text-[11px] font-bold uppercase text-slate-500">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {isPending ? "Saving..." : titles[mode]}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
