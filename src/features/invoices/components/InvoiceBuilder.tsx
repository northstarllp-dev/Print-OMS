"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import {
  ArrowLeft,
  Ban,
  CheckCircle2,
  Eye,
  Info,
  Loader2,
  Plus,
  Save,
  Search,
  Trash2,
  X,
} from "lucide-react";
import {
  upsertInvoice,
  voidInvoice,
  markInvoicePaid,
} from "@/features/invoices/actions/invoiceActions";
import {
  convertProformaToInvoiceAction,
  setInvoiceTypeAction,
} from "@/features/finance/actions/financeActions";
import { INVOICE_TYPES, type InvoiceType } from "@/features/finance/types";
import {
  calcLineAmount,
  getLineMeasurement,
  normalizeLineItem,
  normalizePricingType,
  type PricingType,
} from "@/features/quotations/utils/lineAmount";
import {
  getProductPriceForType,
  resolvePricingForMeasurement,
} from "@/features/quotations/utils/conditionalProductPricing";
import { InvoiceDocument } from "@/features/invoices/components/InvoiceDocument";
import type { InvoiceProfile } from "@/features/quotations/types/invoiceProfile";
import { EMPTY_INVOICE_PROFILE } from "@/features/quotations/types/invoiceProfile";

interface Product {
  id: string;
  product_id: string;
  name: string;
  category?: string | null;
  pricing_type?: string | null;
  price_per_sqft?: number | null;
  price_per_unit?: number | null;
  unit_price_max_sqft?: number | null;
  pricing_type_below?: string | null;
  pricing_type_above?: string | null;
  is_active?: boolean;
  images?: string[];
}

interface LineItem {
  id: string;
  productId?: string;
  description: string;
  hsn?: string;
  quantity: number;
  pricingType: PricingType;
  unit: string;
  unitPrice: number;
  totalSqFt: number;
  gstRate: number;
  notes?: string | null;
}

interface SignageSection {
  siteVisitItemId: string;
  itemLabel: string;
  lines: LineItem[];
  notes?: string;
}

const GST_OPTIONS = [0, 5, 12, 18, 28];
const inputCls =
  "border border-slate-200 rounded-lg text-[12px] text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 bg-white disabled:bg-slate-50 disabled:text-slate-500";

function newLine(): LineItem {
  return {
    id: crypto.randomUUID(),
    description: "",
    hsn: "",
    quantity: 1,
    pricingType: "per_unit",
    unit: "nos",
    unitPrice: 0,
    totalSqFt: 0,
    gstRate: 18,
  };
}

function mapSections(raw: unknown): SignageSection[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    return [
      {
        siteVisitItemId: "general",
        itemLabel: "Items",
        lines: [newLine()],
      },
    ];
  }
  return raw.map((sec: any, i: number) => ({
    siteVisitItemId: sec.siteVisitItemId || `sec-${i}`,
    itemLabel: sec.itemLabel || `Section ${i + 1}`,
    notes: sec.notes,
    lines:
      Array.isArray(sec.lines) && sec.lines.length > 0
        ? sec.lines.map((l: any) => normalizeLineItem({ ...l, id: l.id || crypto.randomUUID() }))
        : [newLine()],
  }));
}

function formatINR(n: number) {
  return `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

function ProductSearch({
  value,
  products,
  onSelect,
  onChange,
  disabled,
  measurement = 1,
}: {
  value: string;
  products: Product[];
  onSelect: (p: Product) => void;
  onChange: (val: string) => void;
  disabled?: boolean;
  measurement?: number;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const [dropdownRect, setDropdownRect] = useState<DOMRect | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  const updateDropdownRect = useCallback(() => {
    if (inputRef.current) {
      setDropdownRect(inputRef.current.getBoundingClientRect());
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    updateDropdownRect();
    const onReposition = () => updateDropdownRect();
    window.addEventListener("scroll", onReposition, true);
    window.addEventListener("resize", onReposition);
    return () => {
      window.removeEventListener("scroll", onReposition, true);
      window.removeEventListener("resize", onReposition);
    };
  }, [open, updateDropdownRect]);

  useEffect(() => {
    function handler(e: MouseEvent) {
      const target = e.target as Node;
      if (rootRef.current?.contains(target)) return;
      if (dropdownRef.current?.contains(target)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = query.trim()
    ? products.filter(
        (p) =>
          p.is_active !== false &&
          (p.name.toLowerCase().includes(query.toLowerCase()) ||
            (p.product_id || "").toLowerCase().includes(query.toLowerCase()) ||
            (p.category ?? "").toLowerCase().includes(query.toLowerCase()))
      )
    : [];

  const visibleResults = filtered.slice(0, 6);
  const hasMore = filtered.length > visibleResults.length;

  const dropdown =
    isMounted && open && visibleResults.length > 0 && dropdownRect
      ? createPortal(
          <div
            ref={dropdownRef}
            className="fixed z-[10000] bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden"
            style={{
              top: dropdownRect.bottom + 4,
              left: dropdownRect.left,
              width: dropdownRect.width,
              maxWidth: "calc(100vw - 16px)",
            }}
          >
            {visibleResults.map((p) => {
              const resolved = resolvePricingForMeasurement(p, measurement);
              return (
                <button
                  key={p.id}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onSelect(p);
                    setQuery(p.name);
                    setOpen(false);
                  }}
                  className="flex w-full items-center justify-between gap-2 border-b border-slate-100 px-3 py-2.5 text-left last:border-b-0 hover:bg-slate-50"
                >
                  <div className="min-w-0">
                    <span className="text-[11px] font-bold text-slate-900">
                      {p.name}
                    </span>
                    {p.category && (
                      <span className="ml-1.5 text-[9px] text-slate-400">
                        {p.category}
                      </span>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-[10px] font-extrabold text-slate-900 font-mono">
                      ₹{resolved.price.toLocaleString("en-IN")}
                    </div>
                    <div className="text-[9px] text-slate-500">
                      per {resolved.pricingType === "per_sqft" ? "sqft" : "unit"}
                    </div>
                  </div>
                </button>
              );
            })}
            {hasMore && (
              <div className="px-3 py-2 text-[10px] font-semibold text-slate-400 bg-slate-50 border-t border-slate-100">
                Type more to narrow {filtered.length - visibleResults.length}{" "}
                more…
              </div>
            )}
          </div>,
          document.body
        )
      : null;

  return (
    <div ref={rootRef} className="relative w-full min-w-0">
      <div className="relative">
        <Search
          size={14}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
        />
        <input
          ref={inputRef}
          type="text"
          value={query}
          disabled={disabled}
          onChange={(e) => {
            setQuery(e.target.value);
            onChange(e.target.value);
            setOpen(true);
            updateDropdownRect();
          }}
          onFocus={() => {
            setQuery(value);
            setOpen(true);
            updateDropdownRect();
          }}
          placeholder="Search product or type description…"
          className="w-full min-h-[40px] border border-slate-200 rounded-xl text-[13px] text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 bg-white pl-9 pr-3 py-2.5 font-medium placeholder:text-slate-400 placeholder:font-normal disabled:bg-slate-50 disabled:text-slate-500"
        />
      </div>
      {dropdown}
    </div>
  );
}

export interface InvoiceBuilderProps {
  invoice: Record<string, any>;
  products: Product[];
  invoiceProfile?: InvoiceProfile | null;
  basePath: "/admin/invoices" | "/staff/invoices";
  orderBasePath: "/admin/orders" | "/staff/orders";
  canEdit: boolean;
}

export function InvoiceBuilder({
  invoice: initial,
  products,
  invoiceProfile = EMPTY_INVOICE_PROFILE,
  basePath,
  orderBasePath,
  canEdit,
}: InvoiceBuilderProps) {
  const order = initial.orders || {};
  const customer = initial.customers || {};

  const [sections, setSections] = useState<SignageSection[]>(() =>
    mapSections(initial.signage_options)
  );
  const [discount, setDiscount] = useState(Number(initial.discount || 0));
  const [shipping, setShipping] = useState(Number(initial.shipping || 0));
  const [notes, setNotes] = useState(initial.notes || "");
  const [terms, setTerms] = useState(initial.terms || "");
  const [invoiceDate, setInvoiceDate] = useState(
    (initial.invoice_date as string)?.slice(0, 10) ||
      new Date().toISOString().slice(0, 10)
  );
  const [dueDate, setDueDate] = useState(
    (initial.due_date as string)?.slice(0, 10) || ""
  );
  const [status, setStatus] = useState(initial.status || "Draft");
  const [invoiceType, setInvoiceType] = useState<InvoiceType>(
    (initial.invoice_type as InvoiceType) || "Tax Invoice"
  );
  const [invoiceId, setInvoiceId] = useState(initial.invoice_id || "—");
  const [showPreview, setShowPreview] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [activeRowId, setActiveRowId] = useState<string | null>(null);
  const [selectedProductInfo, setSelectedProductInfo] = useState<Product | null>(
    null
  );
  const [isPending, startTransition] = useTransition();

  const locked = !canEdit || status === "Paid" || status === "Void";

  const totals = useMemo(() => {
    const subtotal = sections.reduce(
      (sum, sec) =>
        sum + sec.lines.reduce((s, line) => s + calcLineAmount(line), 0),
      0
    );
    const totalGst = sections.reduce(
      (sum, sec) =>
        sum +
        sec.lines.reduce(
          (s, line) => s + calcLineAmount(line) * ((line.gstRate || 0) / 100),
          0
        ),
      0
    );
    const clampedDiscount = Math.max(0, Math.min(discount, subtotal));
    const tax =
      subtotal > 0
        ? Math.round(totalGst * (1 - clampedDiscount / subtotal) * 100) / 100
        : 0;
    const ship = Math.max(0, shipping);
    const grand_total =
      Math.round((subtotal - clampedDiscount + tax + ship) * 100) / 100;
    return {
      subtotal,
      discount: clampedDiscount,
      tax,
      shipping: ship,
      grand_total,
    };
  }, [sections, discount, shipping]);

  const billToName = [order.business_name, order.client_name]
    .filter(Boolean)
    .join(" - ");

  const updateLine = (
    sectionId: string,
    lineId: string,
    patch: Partial<LineItem>
  ) => {
    setSections((prev) =>
      prev.map((sec) =>
        sec.siteVisitItemId !== sectionId
          ? sec
          : {
              ...sec,
              lines: sec.lines.map((l) =>
                l.id !== lineId ? l : { ...l, ...patch }
              ),
            }
      )
    );
  };

  const selectProduct = (
    sectionId: string,
    lineId: string,
    p: Product
  ) => {
    const line = sections
      .find((s) => s.siteVisitItemId === sectionId)
      ?.lines.find((l) => l.id === lineId);
    const measurement = getLineMeasurement(line || { quantity: 1 }) || 1;
    const resolved = resolvePricingForMeasurement(p, measurement);
    updateLine(sectionId, lineId, {
      productId: p.id,
      description: p.name,
      pricingType: resolved.pricingType,
      unit: resolved.unit,
      unitPrice: resolved.price,
      quantity: measurement,
      totalSqFt: measurement,
    });
  };

  const handleSave = () => {
    setError(null);
    setSaveMsg(null);
    startTransition(async () => {
      try {
        const result = await upsertInvoice(initial.id, {
          signage_options: sections,
          discount: totals.discount,
          shipping: totals.shipping,
          status: status === "Sent" ? "Sent" : "Draft",
          notes,
          terms,
          invoice_date: invoiceDate,
          due_date: dueDate || null,
        });
        if (result?.status) setStatus(result.status);
        setSaveMsg("Invoice saved");
      } catch (e: any) {
        setError(e?.message || "Failed to save invoice");
      }
    });
  };

  const handleVoid = () => {
    if (!confirm("Void this invoice? This cannot be undone.")) return;
    setError(null);
    startTransition(async () => {
      try {
        await voidInvoice(initial.id);
        setStatus("Void");
      } catch (e: any) {
        setError(e?.message || "Failed to void invoice");
      }
    });
  };

  const handleMarkPaid = () => {
    setError(null);
    startTransition(async () => {
      try {
        await markInvoicePaid(initial.id);
        setStatus("Paid");
      } catch (e: any) {
        setError(e?.message || "Failed to mark paid");
      }
    });
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-start gap-3">
          <Link
            href={basePath}
            className="mt-1 p-2 rounded-lg border border-slate-200 hover:bg-slate-50"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Invoice Number
            </p>
            <h1 className="text-xl font-extrabold text-slate-900 font-mono">
              {invoiceId}
            </h1>
            <p className="text-sm text-slate-500">
              {billToName || "—"} ·{" "}
              <Link
                href={`${orderBasePath}/${order.order_id || order.id}`}
                className="text-[var(--color-primary)] hover:underline font-mono text-xs"
              >
                {order.order_id || "Order"}
              </Link>
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold uppercase border bg-slate-100 text-slate-700 border-slate-200">
                {status}
              </span>
              {canEdit ? (
                <select
                  value={invoiceType}
                  disabled={isPending || locked}
                  onChange={(e) => {
                    const nextType = e.target.value as InvoiceType;
                    setInvoiceType(nextType);
                    startTransition(async () => {
                      try {
                        await setInvoiceTypeAction(initial.id, nextType);
                      } catch (err: any) {
                        setError(err?.message || "Failed to change invoice type");
                      }
                    });
                  }}
                  className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-bold uppercase text-slate-700"
                >
                  {INVOICE_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              ) : (
                <span className="inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold uppercase border bg-indigo-50 text-indigo-700 border-indigo-200">
                  {invoiceType}
                </span>
              )}
              {canEdit && invoiceType === "Proforma Invoice" ? (
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => {
                    startTransition(async () => {
                      try {
                        const result = await convertProformaToInvoiceAction(initial.id);
                        setInvoiceType("Tax Invoice");
                        setStatus("Draft");
                        if (result?.invoiceId) setInvoiceId(result.invoiceId);
                        setSaveMsg("Proforma converted to Tax Invoice");
                      } catch (err: any) {
                        setError(err?.message || "Failed to convert proforma");
                      }
                    });
                  }}
                  className="inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold uppercase border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                >
                  Convert to Invoice
                </button>
              ) : null}
            </div>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setShowPreview(true)}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-bold hover:bg-slate-50 w-full sm:w-auto"
          >
            <Eye className="w-4 h-4" /> Preview / Print / PDF
          </button>
          {!locked && (
            <button
              type="button"
              disabled={isPending}
              onClick={handleSave}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-bold hover:bg-slate-800 disabled:opacity-50 w-full sm:w-auto"
            >
              {isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Save
            </button>
          )}
          {canEdit && status === "Sent" && (
            <button
              type="button"
              disabled={isPending}
              onClick={handleMarkPaid}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border border-emerald-200 text-emerald-700 text-sm font-bold hover:bg-emerald-50 disabled:opacity-50 w-full sm:w-auto"
            >
              <CheckCircle2 className="w-4 h-4" /> Mark Paid
            </button>
          )}
          {canEdit && status !== "Paid" && status !== "Void" && (
            <button
              type="button"
              disabled={isPending}
              onClick={handleVoid}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border border-red-200 text-red-700 text-sm font-bold hover:bg-red-50 disabled:opacity-50 w-full sm:w-auto"
            >
              <Ban className="w-4 h-4" /> Void
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 text-red-700 text-sm px-4 py-3">
          {error}
        </div>
      )}
      {saveMsg && !error && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 text-sm px-4 py-3">
          {saveMsg}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <label className="block text-sm">
          <span className="text-[11px] font-bold uppercase text-slate-400">
            Invoice Date
          </span>
          <input
            type="date"
            disabled={locked}
            value={invoiceDate}
            onChange={(e) => setInvoiceDate(e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-50"
          />
        </label>
        <label className="block text-sm">
          <span className="text-[11px] font-bold uppercase text-slate-400">
            Due Date
          </span>
          <input
            type="date"
            disabled={locked}
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-50"
          />
        </label>
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
          <p className="text-[11px] font-bold uppercase text-slate-400">
            Grand Total
          </p>
          <p className="text-2xl font-extrabold font-mono text-slate-900">
            {formatINR(totals.grand_total)}
          </p>
        </div>
      </div>

      {sections.map((section) => (
        <div
          key={section.siteVisitItemId}
          className="bg-white rounded-2xl border border-slate-200 overflow-visible shadow-xs"
        >
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-2">
            <input
              disabled={locked}
              value={section.itemLabel}
              onChange={(e) =>
                setSections((prev) =>
                  prev.map((s) =>
                    s.siteVisitItemId === section.siteVisitItemId
                      ? { ...s, itemLabel: e.target.value }
                      : s
                  )
                )
              }
              className="font-bold text-slate-800 bg-transparent border-0 focus:outline-none flex-1"
            />
            {!locked && (
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() =>
                    setSections((prev) =>
                      prev.map((s) =>
                        s.siteVisitItemId === section.siteVisitItemId
                          ? { ...s, lines: [...s.lines, newLine()] }
                          : s
                      )
                    )
                  }
                  className="inline-flex items-center gap-1 text-xs font-bold text-[var(--color-primary)]"
                >
                  <Plus className="w-3.5 h-3.5" /> Line
                </button>
                {sections.length > 1 && (
                  <button
                    type="button"
                    title="Delete section"
                    onClick={() =>
                      setSections((prev) =>
                        prev.filter(
                          (s) => s.siteVisitItemId !== section.siteVisitItemId
                        )
                      )
                    }
                    className="inline-flex items-center gap-1 text-xs font-bold text-red-600 hover:bg-red-50 px-2 py-1 rounded-lg"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Section
                  </button>
                )}
              </div>
            )}
          </div>

          <div
            className="overflow-x-auto overscroll-x-contain -mx-px"
            style={{ WebkitOverflowScrolling: "touch" }}
          >
            <p className="md:hidden px-4 pt-2 pb-1 text-[11px] font-semibold text-slate-400">
              Swipe sideways to edit all columns
            </p>
            <div className="min-w-[720px] md:min-w-[1040px]">
              <div
                className="grid gap-3 px-4 py-2.5 text-[10px] font-black text-[#64748b] uppercase tracking-wider bg-slate-50 border-b border-slate-100"
                style={{
                  gridTemplateColumns:
                    "minmax(300px, 2.5fr) 80px 120px 120px 100px 56px 100px 36px",
                }}
              >
                <div>Item Description</div>
                <div className="text-center">HSN</div>
                <div className="text-center">Unit Type</div>
                <div className="text-center">Measurement/Qty</div>
                <div className="text-right">Rate (₹)</div>
                <div className="text-center">GST</div>
                <div className="text-right">Amount (₹)</div>
                <div />
              </div>

              <div className="divide-y divide-slate-100 overflow-visible">
                {section.lines.map((line) => {
                  const lineAmt =
                    calcLineAmount(line) * (1 + (line.gstRate || 0) / 100);
                  const measurement = getLineMeasurement(line);

                  return (
                    <div
                      key={line.id}
                      className="flex flex-col hover:bg-slate-50 transition-colors"
                    >
                      <div
                        className="grid gap-3 px-4 py-3 items-center overflow-visible"
                        style={{
                          gridTemplateColumns:
                            "minmax(300px, 2.5fr) 80px 120px 120px 100px 56px 100px 36px",
                          position: "relative",
                          zIndex: activeRowId === line.id ? 50 : 1,
                        }}
                        onFocus={() => setActiveRowId(line.id)}
                        onBlur={(e) => {
                          if (
                            !e.currentTarget.contains(e.relatedTarget as Node)
                          ) {
                            setActiveRowId(null);
                          }
                        }}
                      >
                        <div className="flex items-center gap-2 w-full min-w-0">
                          <ProductSearch
                            value={line.description}
                            products={products}
                            disabled={locked}
                            measurement={getLineMeasurement(line) || 1}
                            onSelect={(p) =>
                              selectProduct(
                                section.siteVisitItemId,
                                line.id,
                                p
                              )
                            }
                            onChange={(val) =>
                              updateLine(section.siteVisitItemId, line.id, {
                                description: val,
                                productId: undefined,
                              })
                            }
                          />
                          {line.productId && (
                            <button
                              type="button"
                              onClick={() => {
                                const prod = products.find(
                                  (p) => p.id === line.productId
                                );
                                if (prod) setSelectedProductInfo(prod);
                              }}
                              className="shrink-0 p-2 text-blue-600 rounded-lg hover:bg-blue-50"
                              title="Product Details"
                            >
                              <Info size={14} style={{ strokeWidth: 2.5 }} />
                            </button>
                          )}
                        </div>

                        <input
                          type="text"
                          value={line.hsn || ""}
                          disabled={locked}
                          onChange={(e) =>
                            updateLine(section.siteVisitItemId, line.id, {
                              hsn: e.target.value,
                            })
                          }
                          className={`${inputCls} w-full py-1.5 text-center font-mono`}
                          placeholder="HSN"
                          maxLength={12}
                        />

                        <select
                          value={normalizePricingType(line.pricingType)}
                          disabled={locked}
                          onChange={(e) => {
                            const newType = e.target.value as PricingType;
                            const m = getLineMeasurement(line) || 1;
                            const patch: Partial<LineItem> = {
                              pricingType: newType,
                              unit: newType === "per_sqft" ? "sqft" : "nos",
                              quantity: m,
                              totalSqFt: m,
                            };
                            if (line.productId) {
                              const p = products.find(
                                (prod) => prod.id === line.productId
                              );
                              if (p) {
                                patch.unitPrice = getProductPriceForType(
                                  p,
                                  newType
                                );
                              }
                            }
                            updateLine(
                              section.siteVisitItemId,
                              line.id,
                              patch
                            );
                          }}
                          className={`${inputCls} w-full py-1.5 px-2 bg-white`}
                        >
                          <option value="per_unit">Per Unit</option>
                          <option value="per_sqft">Per Sq.Ft</option>
                        </select>

                        <input
                          type="number"
                          disabled={locked}
                          min={0}
                          step="any"
                          value={measurement || ""}
                          onChange={(e) => {
                            const v = Number(e.target.value) || 0;
                            const patch: Partial<LineItem> = {
                              quantity: v,
                              totalSqFt: v,
                            };
                            if (line.productId) {
                              const p = products.find(
                                (prod) => prod.id === line.productId
                              );
                              if (p) {
                                const resolved = resolvePricingForMeasurement(p, v);
                                patch.pricingType = resolved.pricingType;
                                patch.unit = resolved.unit;
                                patch.unitPrice = resolved.price;
                              }
                            }
                            updateLine(section.siteVisitItemId, line.id, patch);
                          }}
                          className={`${inputCls} w-full py-1.5 text-center font-mono`}
                        />

                        <input
                          type="number"
                          disabled={locked}
                          min={0}
                          step="any"
                          value={line.unitPrice || ""}
                          onChange={(e) =>
                            updateLine(section.siteVisitItemId, line.id, {
                              unitPrice: Number(e.target.value) || 0,
                            })
                          }
                          className={`${inputCls} w-full py-1.5 text-right font-mono`}
                        />

                        <select
                          disabled={locked}
                          value={line.gstRate}
                          onChange={(e) =>
                            updateLine(section.siteVisitItemId, line.id, {
                              gstRate: Number(e.target.value),
                            })
                          }
                          className={`${inputCls} w-full py-1.5 px-1 text-center`}
                        >
                          {GST_OPTIONS.map((g) => (
                            <option key={g} value={g}>
                              {g}%
                            </option>
                          ))}
                        </select>

                        <div className="text-right font-mono text-[12px] font-bold text-slate-800">
                          {formatINR(lineAmt)}
                        </div>

                        <div className="flex justify-end">
                          {!locked && (
                            <button
                              type="button"
                              title="Delete line"
                              onClick={() =>
                                setSections((prev) =>
                                  prev.map((s) => {
                                    if (
                                      s.siteVisitItemId !==
                                      section.siteVisitItemId
                                    ) {
                                      return s;
                                    }
                                    if (s.lines.length <= 1) {
                                      return { ...s, lines: [newLine()] };
                                    }
                                    return {
                                      ...s,
                                      lines: s.lines.filter(
                                        (l) => l.id !== line.id
                                      ),
                                    };
                                  })
                                )
                              }
                              className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      ))}

      {!locked && (
        <button
          type="button"
          onClick={() =>
            setSections((prev) => [
              ...prev,
              {
                siteVisitItemId: crypto.randomUUID(),
                itemLabel: `Section ${prev.length + 1}`,
                lines: [newLine()],
              },
            ])
          }
          className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-600 hover:text-slate-900"
        >
          <Plus className="w-4 h-4" /> Add section
        </button>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <label className="block text-sm">
          <span className="text-[11px] font-bold uppercase text-slate-400">
            Notes
          </span>
          <textarea
            disabled={locked}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-50"
          />
        </label>
        <label className="block text-sm">
          <span className="text-[11px] font-bold uppercase text-slate-400">
            Terms
          </span>
          <textarea
            disabled={locked}
            value={terms}
            onChange={(e) => setTerms(e.target.value)}
            rows={3}
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-50"
          />
        </label>
        <label className="block text-sm">
          <span className="text-[11px] font-bold uppercase text-slate-400">
            Discount (₹)
          </span>
          <input
            type="number"
            disabled={locked}
            min={0}
            value={discount || ""}
            onChange={(e) => setDiscount(Number(e.target.value) || 0)}
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-50"
          />
        </label>
        <label className="block text-sm">
          <span className="text-[11px] font-bold uppercase text-slate-400">
            Shipping (₹)
          </span>
          <input
            type="number"
            disabled={locked}
            min={0}
            value={shipping || ""}
            onChange={(e) => setShipping(Number(e.target.value) || 0)}
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-50"
          />
        </label>
      </div>

      <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4 space-y-2 text-sm max-w-sm ml-auto">
        <div className="flex justify-between">
          <span>Subtotal</span>
          <span className="font-mono">{formatINR(totals.subtotal)}</span>
        </div>
        <div className="flex justify-between">
          <span>Discount</span>
          <span className="font-mono">−{formatINR(totals.discount)}</span>
        </div>
        <div className="flex justify-between">
          <span>Tax</span>
          <span className="font-mono">{formatINR(totals.tax)}</span>
        </div>
        <div className="flex justify-between">
          <span>Shipping</span>
          <span className="font-mono">{formatINR(totals.shipping)}</span>
        </div>
        <div className="flex justify-between pt-2 border-t border-slate-200 font-extrabold text-base">
          <span>Grand Total</span>
          <span className="font-mono">{formatINR(totals.grand_total)}</span>
        </div>
      </div>

      {showPreview && (
        <div className="fixed inset-0 z-[100000] bg-black/50 flex items-end sm:items-start justify-center overflow-y-auto p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full max-w-4xl my-0 sm:my-8 relative max-h-[96dvh] sm:max-h-none overflow-y-auto">
            <button
              type="button"
              onClick={() => setShowPreview(false)}
              className="sticky top-3 float-right mr-3 mt-3 z-10 p-2 rounded-full bg-white border border-slate-200 shadow"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="p-3 sm:p-4 clear-both overflow-x-auto">
              <InvoiceDocument
                invoiceId={invoiceId}
                invoiceDate={invoiceDate}
                dueDate={dueDate || null}
                status={status}
                billToName={billToName || customer.name || "—"}
                billToAddress={customer.billing_address}
                placeOfSupply={
                  invoiceProfile?.placeOfSupplyDefault || customer.city
                }
                sections={sections as any}
                subtotal={totals.subtotal}
                discount={totals.discount}
                shipping={totals.shipping}
                tax={totals.tax}
                grandTotal={totals.grand_total}
                notes={notes}
                terms={terms}
                invoiceProfile={invoiceProfile}
                showPrintButton
              />
            </div>
          </div>
        </div>
      )}

      {selectedProductInfo && (
        <div className="fixed inset-0 z-[100000] bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl max-w-md w-full p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-bold text-slate-900">
                  {selectedProductInfo.name}
                </h3>
                <p className="text-xs text-slate-500 font-mono mt-1">
                  {selectedProductInfo.product_id}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedProductInfo(null)}
                className="p-2 rounded-lg hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
