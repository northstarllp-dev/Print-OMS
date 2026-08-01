"use client";

import React, { useEffect, useMemo, useState, useTransition } from "react";
import { Boxes, Loader2, PackageCheck, Plus, Trash2 } from "lucide-react";
import {
  consumeMaterialsAction,
  getOrderConsumptions,
  getProductionMaterialContext,
  recordFinalYieldAction,
  type ConsumptionLineInput,
  type OrderConsumptionRecord,
  type UsageKind,
} from "@/features/inventory/actions/productionStockActions";

interface PanelProduct {
  id: string;
  product_id: string;
  name: string;
  unit: string | null;
  barcode: string | null;
  purchase_price: number | null;
  final_prdt: boolean;
  track_inventory: boolean;
}

interface PanelWarehouse {
  id: string;
  code: string;
  name: string;
}

interface DraftLine extends ConsumptionLineInput {
  key: string;
  productName: string;
  unit: string | null;
}

const USAGE_KINDS: { value: UsageKind; label: string }[] = [
  { value: "normal", label: "Normal" },
  { value: "wastage", label: "Wastage" },
  { value: "damaged", label: "Damaged" },
  { value: "returned", label: "Returned" },
  { value: "scrap", label: "Scrap" },
];

export function ProductionMaterialsPanel({
  orderId,
  canEdit,
}: {
  orderId: string;
  canEdit: boolean;
}) {
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<PanelProduct[]>([]);
  const [warehouses, setWarehouses] = useState<PanelWarehouse[]>([]);
  const [balances, setBalances] = useState<
    { product_id: string; warehouse_id: string; quantity: number }[]
  >([]);
  const [consumptions, setConsumptions] = useState<OrderConsumptionRecord[]>([]);
  const [alert, setAlert] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // draft consume lines
  const [search, setSearch] = useState("");
  const [draftLines, setDraftLines] = useState<DraftLine[]>([]);
  const [isPending, startTransition] = useTransition();

  // final yield
  const [yieldProductId, setYieldProductId] = useState("");
  const [yieldWarehouseId, setYieldWarehouseId] = useState("");
  const [yieldQty, setYieldQty] = useState("");
  const [yieldPending, startYieldTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    Promise.all([getProductionMaterialContext(), getOrderConsumptions(orderId)])
      .then(([ctx, cons]) => {
        if (cancelled) return;
        setProducts(ctx.products as PanelProduct[]);
        setWarehouses(ctx.warehouses as PanelWarehouse[]);
        setBalances(ctx.balances);
        setConsumptions(cons);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  const stockFor = (productId: string, warehouseId: string) =>
    balances.find((b) => b.product_id === productId && b.warehouse_id === warehouseId)
      ?.quantity ?? 0;

  const recentProductIds = useMemo(() => {
    const seen = new Set<string>();
    for (const c of consumptions) {
      if (seen.size >= 5) break;
      seen.add(c.product_id);
    }
    return Array.from(seen);
  }, [consumptions]);

  const pickerResults = useMemo(() => {
    const text = search.trim().toLowerCase();
    const pool = products.filter((p) => p.track_inventory);
    if (!text) {
      if (recentProductIds.length === 0) return [];
      return pool.filter((p) => recentProductIds.includes(p.id));
    }
    return pool
      .filter((p) =>
        [p.name, p.product_id, p.barcode ?? ""].join(" ").toLowerCase().includes(text)
      )
      .slice(0, 8);
  }, [products, search, recentProductIds]);

  const addLine = (product: PanelProduct) => {
    const defaultWarehouse = warehouses[0]?.id ?? "";
    setDraftLines((lines) => [
      ...lines,
      {
        key: `${product.id}-${Date.now()}`,
        productId: product.id,
        productName: product.name,
        unit: product.unit,
        warehouseId: defaultWarehouse,
        quantity: 1,
        usageKind: "normal",
        unitCost: product.purchase_price,
      },
    ]);
    setSearch("");
  };

  const updateLine = (key: string, patch: Partial<DraftLine>) => {
    setDraftLines((lines) => lines.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  };

  const removeLine = (key: string) => {
    setDraftLines((lines) => lines.filter((l) => l.key !== key));
  };

  const showAlert = (message: string, type: "success" | "error") => {
    setAlert({ message, type });
    setTimeout(() => setAlert(null), 4000);
  };

  const handleConsume = () => {
    if (draftLines.length === 0) return;
    startTransition(async () => {
      try {
        const result = await consumeMaterialsAction({
          orderId,
          lines: draftLines.map(({ key: _key, productName: _n, unit: _u, ...line }) => line),
        });
        setDraftLines([]);
        const [ctx, cons] = await Promise.all([
          getProductionMaterialContext(),
          getOrderConsumptions(orderId),
        ]);
        setBalances(ctx.balances);
        setConsumptions(cons);
        showAlert(
          `Materials recorded. Order material cost: ₹${result.materialCost.toFixed(2)}`,
          "success"
        );
      } catch (err: any) {
        showAlert(err.message || "Failed to consume materials.", "error");
      }
    });
  };

  const finalProducts = products.filter((p) => p.final_prdt);

  const handleYield = () => {
    const qty = Number(yieldQty);
    if (!yieldProductId || !yieldWarehouseId || !Number.isFinite(qty) || qty <= 0) {
      showAlert("Select a final product, warehouse, and quantity.", "error");
      return;
    }
    startYieldTransition(async () => {
      try {
        await recordFinalYieldAction({
          orderId,
          productId: yieldProductId,
          warehouseId: yieldWarehouseId,
          quantity: qty,
        });
        setYieldQty("");
        const ctx = await getProductionMaterialContext();
        setBalances(ctx.balances);
        showAlert("Final yield added to stock.", "success");
      } catch (err: any) {
        showAlert(err.message || "Failed to record yield.", "error");
      }
    });
  };

  const totalCost = consumptions.reduce((sum, c) => sum + c.total_cost, 0);

  if (loading) {
    return (
      <div className="prt-card p-6 flex items-center justify-center gap-2 text-xs font-bold text-slate-400">
        <Loader2 size={14} className="animate-spin" /> Loading materials...
      </div>
    );
  }

  return (
    <div className="prt-card p-6">
      <div className="flex items-center justify-between gap-2 mb-4 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <Boxes size={18} className="text-amber-600 shrink-0" />
          <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider">
            Materials Consumed
          </h2>
          <span
            className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide bg-amber-50 text-amber-700 border border-amber-200"
            title="This materials panel is still in development"
          >
            Dev stage
          </span>
        </div>
        <span className="text-xs font-bold text-slate-600 shrink-0">
          Material cost: ₹{totalCost.toFixed(2)}
        </span>
      </div>

      {alert ? (
        <div
          className={`mb-4 px-3 py-2 rounded-lg text-xs font-bold border ${
            alert.type === "success"
              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
              : "bg-rose-50 text-rose-700 border-rose-200"
          }`}
        >
          {alert.message}
        </div>
      ) : null}

      {/* Existing consumption lines */}
      {consumptions.length > 0 ? (
        <div className="mb-5 overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full min-w-[560px]">
            <thead className="bg-slate-50">
              <tr>
                {["Material", "Warehouse", "Qty", "Usage", "Cost"].map((h) => (
                  <th
                    key={h}
                    className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wide text-slate-500"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {consumptions.map((c) => (
                <tr key={c.id} className="border-t border-slate-100">
                  <td className="px-3 py-2">
                    <div className="text-xs font-bold text-slate-800">{c.product_name}</div>
                    <div className="text-[10px] text-slate-400">{c.product_code}</div>
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-600">{c.warehouse_name}</td>
                  <td className="px-3 py-2 text-xs font-bold text-slate-800">{c.quantity}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold ${
                        c.usage_kind === "normal"
                          ? "border-slate-200 bg-slate-50 text-slate-600"
                          : c.usage_kind === "returned"
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : "border-amber-200 bg-amber-50 text-amber-700"
                      }`}
                    >
                      {c.usage_kind}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs font-bold text-slate-800">
                    ₹{c.total_cost.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mb-5 text-xs text-slate-400 font-semibold">
          No materials recorded for this order yet.
        </p>
      )}

      {canEdit ? (
        <>
          {/* Material picker */}
          <div className="mb-3">
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">
              Add Material (search name, SKU, or scan barcode)
            </label>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="e.g. ACP Sheet, PRD-014, or scan..."
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs"
            />
            {pickerResults.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {pickerResults.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => addLine(p)}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[11px] font-bold text-slate-700 hover:border-slate-400"
                  >
                    <Plus size={11} />
                    {p.name}
                    <span className="font-normal text-slate-400">({p.product_id})</span>
                  </button>
                ))}
              </div>
            ) : null}
            {!search && recentProductIds.length > 0 ? (
              <p className="m-0 mt-1 text-[10px] text-slate-400 font-semibold">Recently used on this order</p>
            ) : null}
          </div>

          {/* Draft lines */}
          {draftLines.length > 0 ? (
            <div className="mb-3 space-y-2">
              {draftLines.map((line) => (
                <div
                  key={line.key}
                  className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/60 p-2.5"
                >
                  <div className="min-w-[140px] flex-1 text-xs font-bold text-slate-800">
                    {line.productName}
                  </div>
                  <select
                    value={line.warehouseId}
                    onChange={(e) => updateLine(line.key, { warehouseId: e.target.value })}
                    className="rounded-lg border border-slate-200 px-2 py-1.5 text-[11px]"
                  >
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name} ({stockFor(line.productId, w.id)})
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={line.quantity}
                    onChange={(e) => updateLine(line.key, { quantity: Number(e.target.value) })}
                    className="w-20 rounded-lg border border-slate-200 px-2 py-1.5 text-[11px]"
                  />
                  <select
                    value={line.usageKind}
                    onChange={(e) => updateLine(line.key, { usageKind: e.target.value as UsageKind })}
                    className="rounded-lg border border-slate-200 px-2 py-1.5 text-[11px]"
                  >
                    {USAGE_KINDS.map((u) => (
                      <option key={u.value} value={u.value}>
                        {u.label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => removeLine(line.key)}
                    className="rounded-md border border-slate-200 p-1.5 text-rose-500"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={handleConsume}
                disabled={isPending}
                className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
              >
                {isPending ? <Loader2 size={13} className="animate-spin" /> : <Boxes size={13} />}
                Record Consumption ({draftLines.length})
              </button>
            </div>
          ) : null}

          {/* Final yield */}
          {finalProducts.length > 0 ? (
            <div className="mt-5 border-t border-slate-100 pt-4">
              <div className="flex items-center gap-2 mb-2">
                <PackageCheck size={15} className="text-emerald-600" />
                <h3 className="m-0 text-xs font-black uppercase tracking-wider text-slate-700">
                  Record Final Yield
                </h3>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={yieldProductId}
                  onChange={(e) => setYieldProductId(e.target.value)}
                  className="min-w-[160px] flex-1 rounded-lg border border-slate-200 px-2 py-1.5 text-[11px]"
                >
                  <option value="">Select final product...</option>
                  {finalProducts.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.product_id})
                    </option>
                  ))}
                </select>
                <select
                  value={yieldWarehouseId}
                  onChange={(e) => setYieldWarehouseId(e.target.value)}
                  className="rounded-lg border border-slate-200 px-2 py-1.5 text-[11px]"
                >
                  <option value="">Warehouse...</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={yieldQty}
                  onChange={(e) => setYieldQty(e.target.value)}
                  placeholder="Qty"
                  className="w-20 rounded-lg border border-slate-200 px-2 py-1.5 text-[11px]"
                />
                <button
                  type="button"
                  onClick={handleYield}
                  disabled={yieldPending}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-[11px] font-bold text-white disabled:opacity-50"
                >
                  {yieldPending ? <Loader2 size={12} className="animate-spin" /> : <PackageCheck size={12} />}
                  Add to Stock
                </button>
              </div>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
