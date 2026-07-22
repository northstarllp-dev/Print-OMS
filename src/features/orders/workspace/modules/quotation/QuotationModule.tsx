"use client";

import React, { useState, useEffect, useRef, useTransition, useCallback } from "react";
import { createPortal } from "react-dom";
import { OverlayPortal } from "@/components/ui/OverlayPortal";
import {
  Plus, Trash2, Search, Check, ChevronDown, Info, X,
  ClipboardList, IndianRupee, Loader2, AlertCircle, Package, Save, Sparkles, Shield,
  Eye, ArrowLeft
} from "lucide-react";
import {
  upsertQuotation,
  sendQuotationToCustomer
} from "@/features/quotations/actions/quotationActions";
import { formatSiteMeasurementLabel } from "@/features/orders/actions/siteVisitMapper";
import {
  calcLineAmount,
  getLineMeasurement,
  normalizeLineItem,
  normalizePricingType,
  type PricingType,
} from "@/features/quotations/utils/lineAmount";
import { createClient } from "@/utils/supabase/client";
import { ensureRealtimeAuth } from "@/utils/supabase/ensureRealtimeAuth";
import type { StagePermission } from "@/features/orders/workspace/shared/types";
import { QuotationDocument } from "@/features/quotations/components/QuotationDocument";
import { getAppSettings } from "@/features/settings/actions/settingsActions";
import type { InvoiceProfile } from "@/features/quotations/types/invoiceProfile";
import { EMPTY_INVOICE_PROFILE } from "@/features/quotations/types/invoiceProfile";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface Product {
  id: string;
  product_id: string;
  name: string;
  category: string | null;
  pricing_type: string;
  is_active: boolean;
  price_per_sqft?: number | null;
  price_per_unit?: number | null;
  images?: string[];
}

interface SiteVisitItem {
  id: string;
  name: string;
  width?: number | null;
  widthUnit?: string | null;
  height?: number | null;
  heightUnit?: string | null;
  depth?: number | null;
  depthUnit?: string | null;
  notes?: string | null;
}

interface LineItem {
  id: string;
  productId?: string;
  description: string;
  /** Optional HSN/SAC — stored in signage_options JSON only. */
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

interface Quotation {
  id?: string;
  quotation_id?: string;
  rejection_reason?: string;
  status: "Draft" | "Sent" | "Approved" | "Rejected" | "Pending Approval";
  signage_options?: SignageSection[];
  subtotal: number;
  discount: number;
  tax: number;
  grand_total: number;
  shipping?: number;
  notes: string;
  terms: string;
  created_at?: string;
  updated_at?: string;
}

interface QuotationModuleProps {
  order: {
    id: string;
    orderId?: string;
    orderCode?: string;
    clientName: string;
    businessName: string;
    customerName?: string;
    customerId?: string;
    stage?: string;
    stageStatus?: string;
    workflow_type?: "quote_first" | "design_first";
  };
  isEmployee: boolean;
  products: Product[];
  initialQuotation: Quotation | null;
  siteVisitItems?: SiteVisitItem[];
  currentUserRole?: string;
  currentUserName?: string;
  onRequestAdvance?: () => void;
  /** DB-shaped quotation row from parent realtime (when externalRealtime). */
  realtimeQuotation?: Record<string, unknown> | null;
  /** Parent (OrderWorksheetModal) owns the quotations realtime channel. */
  externalRealtime?: boolean;
  adminOverrideUnlocked?: boolean;
  setAdminOverrideUnlocked?: (val: boolean) => void;
  /** RBAC — when canEdit is false the module renders read-only. */
  permission?: StagePermission;
}

const GST_OPTIONS = [0, 5, 12, 18, 28];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function newItem(gstRate: number = 18): LineItem {
  return {
    id: crypto.randomUUID(),
    description: "",
    hsn: "",
    quantity: 1,
    pricingType: "per_unit",
    unit: "nos",
    unitPrice: 0,
    totalSqFt: 0,
    gstRate,
  };
}

function resolveInitialPricing(p: Product): { pricingType: PricingType; price: number } {
  const ut = (p.pricing_type || "").toLowerCase().trim();

  if (ut === "per sq.ft" || ut === "per sqft" || ut === "sqft" || ut === "per_sqft") {
    return { pricingType: "per_sqft", price: p.price_per_sqft ?? 0 };
  }
  if (ut === "per unit" || ut === "per_unit" || ut === "unit" || ut === "nos") {
    return { pricingType: "per_unit", price: p.price_per_unit ?? 0 };
  }
  // Legacy running-ft products fall back to unit pricing
  if (p.price_per_sqft != null && p.price_per_sqft > 0) {
    return { pricingType: "per_sqft", price: p.price_per_sqft };
  }
  if (p.price_per_unit != null && p.price_per_unit > 0) {
    return { pricingType: "per_unit", price: p.price_per_unit };
  }
  return { pricingType: "per_unit", price: 0 };
}

function getProductPriceForType(p: Product, type: PricingType): number {
  if (type === "per_sqft") return p.price_per_sqft ?? 0;
  return p.price_per_unit ?? 0;
}

function normalizeSection(section: SignageSection): SignageSection {
  return {
    ...section,
    lines: (section.lines || []).map((line) => normalizeLineItem(line)),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Product Search component
// ─────────────────────────────────────────────────────────────────────────────

function ProductSearch({
  value,
  products,
  onSelect,
  onChange,
  disabled,
}: {
  value: string;
  products: Product[];
  onSelect: (p: Product) => void;
  onChange: (val: string) => void;
  disabled?: boolean;
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
        p.is_active &&
        (p.name.toLowerCase().includes(query.toLowerCase()) ||
          p.product_id.toLowerCase().includes(query.toLowerCase()) ||
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
            const resolved = resolveInitialPricing(p);
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
                  <span className="text-[11px] font-bold text-slate-900">{p.name}</span>
                  {p.category && (
                    <span className="ml-1.5 text-[9px] text-slate-400">{p.category}</span>
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
              Type more to narrow {filtered.length - visibleResults.length} more…
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

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

function applyQuotationRealtimeRow(
  newQuote: Record<string, unknown>,
  isDirtyRef: React.MutableRefObject<boolean>,
  setters: {
    setQuotationId: (v: string) => void;
    setStatus: (v: "Draft" | "Sent" | "Approved" | "Rejected" | "Pending Approval") => void;
    setNotes: (v: string) => void;
    setTerms: (v: string) => void;
    setShipping: (v: number) => void;
    setDiscount: (v: number) => void;
    setRejectionReason: (v: string) => void;
    setSections: React.Dispatch<React.SetStateAction<SignageSection[]>>;
    setQuoteCreatedAt?: (v: string | null) => void;
  }
) {
  if (newQuote.quotation_id) setters.setQuotationId(String(newQuote.quotation_id));
  if (newQuote.status) {
    setters.setStatus(newQuote.status as "Draft" | "Sent" | "Approved" | "Rejected" | "Pending Approval");
  }
  if (setters.setQuoteCreatedAt) {
    const created =
      (typeof newQuote.created_at === "string" && newQuote.created_at) ||
      (typeof newQuote.updated_at === "string" && newQuote.updated_at) ||
      null;
    if (created) setters.setQuoteCreatedAt(created);
  }
  if (newQuote.notes !== undefined) setters.setNotes((newQuote.notes as string) ?? "");
  if (newQuote.terms !== undefined) setters.setTerms((newQuote.terms as string) ?? "");
  if (newQuote.shipping !== undefined) setters.setShipping(Number(newQuote.shipping) || 0);
  if (newQuote.discount !== undefined) setters.setDiscount(Number(newQuote.discount) || 0);
  if (newQuote.rejection_reason !== undefined) {
    setters.setRejectionReason((newQuote.rejection_reason as string) ?? "");
  }
  const options = newQuote.signage_options;
  if (Array.isArray(options) && !isDirtyRef.current) {
    setters.setSections(options.map((section) => normalizeSection(section as SignageSection)));
  }
}

export const QuotationModule: React.FC<QuotationModuleProps> = ({
  order,
  isEmployee,
  currentUserRole = "Customer",
  currentUserName,
  products,
  initialQuotation,
  siteVisitItems = [],
  onRequestAdvance,
  externalRealtime = false,
  realtimeQuotation = null,
  adminOverrideUnlocked,
  setAdminOverrideUnlocked,
  permission,
}) => {
  const canEdit = permission?.canEdit ?? true;
  const [isPending, startTransition] = useTransition();
  const [saveMsg, setSaveMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [activeRowId, setActiveRowId] = useState<string | null>(null);
  const [sendingToCustomer, setSendingToCustomer] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [selectedProductInfo, setSelectedProductInfo] = useState<Product | null>(null);
  const [showSendConfirm, setShowSendConfirm] = useState(false);
  const [showDocumentPreview, setShowDocumentPreview] = useState(false);
  const [invoiceProfile, setInvoiceProfile] = useState<InvoiceProfile>(EMPTY_INVOICE_PROFILE);
  const [advanceConfirmType, setAdvanceConfirmType] = useState<"override" | "advance" | null>(null);
  const isDirtyRef = useRef(false);
  const lastRealtimeAtRef = useRef<string | null>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Core metadata states
  const [quotationId, setQuotationId] = useState(initialQuotation?.quotation_id ?? "");
  const [quoteCreatedAt, setQuoteCreatedAt] = useState<string | null>(
    initialQuotation?.created_at ?? initialQuotation?.updated_at ?? null
  );
  const [status, setStatus] = useState<"Draft" | "Sent" | "Approved" | "Rejected" | "Pending Approval">(
    initialQuotation?.status ?? "Draft"
  );
  const [rejectionReason, setRejectionReason] = useState(
    initialQuotation?.rejection_reason ?? ""
  );

  // Redesigned: multi-section structure without options A/B
  const [sections, setSections] = useState<SignageSection[]>(() => {
    const savedSections = (initialQuotation?.signage_options || []).map(normalizeSection);

    if (siteVisitItems && siteVisitItems.length > 0) {
      const mapped = siteVisitItems.map((item) => {
        const existing = savedSections.find((s) => s.siteVisitItemId === item.id);
        if (existing) {
          return {
            ...existing,
            itemLabel: item.name, // Keep latest name
          };
        }

        const defaultMeasurement = (item.width && item.height) ? item.width * item.height : 1;
        // Default empty row inside a section
        return {
          siteVisitItemId: item.id,
          itemLabel: item.name,
          lines: [
            {
              id: crypto.randomUUID(),
              description: "",
              hsn: "",
              quantity: defaultMeasurement,
              pricingType: "per_unit" as const,
              unit: "nos",
              unitPrice: 0,
              totalSqFt: defaultMeasurement,
              gstRate: 18,
            },
          ],
          notes: item.notes || "",
        };
      });

      // Keep any saved sections that do not correspond to any site visit item ID (e.g. custom sections or fallback ones)
      const unmatched = savedSections.filter(
        (s) => !siteVisitItems.some((item) => item.id === s.siteVisitItemId)
      );

      return [...mapped, ...unmatched];
    }

    if (savedSections.length > 0) {
      return savedSections;
    }

    // Fallback: single empty section if absolutely nothing
    return [
      {
        siteVisitItemId: crypto.randomUUID(),
        itemLabel: "General Signage",
        lines: [newItem(18)],
        notes: "",
      },
    ];
  });

  // Recreated 2nd SS bottom section states
  const [discount, setDiscount] = useState<number>(
    initialQuotation?.discount ? Number(initialQuotation.discount) : 0
  );
  const [discountType, setDiscountType] = useState<"amount" | "percentage">("amount");
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const [shipping, setShipping] = useState<number>(
    initialQuotation?.shipping ? Number(initialQuotation.shipping) : 0
  );


  const [taxPercent, setTaxPercent] = useState<number>(() => {
    if (initialQuotation) {
      const sub = Number(initialQuotation.subtotal) || 0;
      const tx = Number(initialQuotation.tax) || 0;
      if (sub > 0) {
        return Math.round((tx / sub) * 100);
      }
    }
    return 18; // default to 18%
  });

  const [showDiscountInput, setShowDiscountInput] = useState(discount > 0);
  const [showShippingInput, setShowShippingInput] = useState(shipping > 0);

  const [notes, setNotes] = useState(initialQuotation?.notes ?? "");
  const [terms, setTerms] = useState(
    initialQuotation?.terms ?? "Terms and conditions - late fees, payment methods, delivery schedule"
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const settings = await getAppSettings();
        if (!cancelled) {
          setInvoiceProfile(settings.invoiceProfile || EMPTY_INVOICE_PROFILE);
          if (
            !initialQuotation?.terms &&
            settings.invoiceProfile?.defaultTerms?.trim()
          ) {
            setTerms(settings.invoiceProfile.defaultTerms);
          }
        }
      } catch {
        // Letterhead optional for builder preview
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seed once
  }, []);

  const applyRealtimeQuote = (newQuote: Record<string, unknown>) => {
    const stamp = typeof newQuote.updated_at === "string" ? newQuote.updated_at : null;
    if (stamp && stamp === lastRealtimeAtRef.current) return;
    if (stamp) lastRealtimeAtRef.current = stamp;
    applyQuotationRealtimeRow(newQuote, isDirtyRef, {
      setQuotationId,
      setStatus,
      setNotes,
      setTerms,
      setShipping,
      setDiscount,
      setRejectionReason,
      setSections,
      setQuoteCreatedAt,
    });
  };

  // Own quotations channel for this module's UI state.
  useEffect(() => {
    if (!order.id) return;

    const supabase = createClient();
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    void (async () => {
      await ensureRealtimeAuth(supabase);
      if (cancelled) return;

      channel = supabase
        .channel(`quotation-sync:${order.id}:${Math.random().toString(36).slice(2, 8)}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "quotations",
            filter: `order_id=eq.${order.id}`,
          },
          (payload: { eventType: string; new: Record<string, unknown> }) => {
            if (
              (payload.eventType === "INSERT" || payload.eventType === "UPDATE") &&
              payload.new
            ) {
              applyRealtimeQuote(payload.new);
            }
          }
        )
        .subscribe((status, err) => {
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            console.error("[QuotationModule] realtime error", { orderId: order.id, status, err });
          }
        });
    })();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- bind once per order; setters are stable
  }, [order.id]);

  useEffect(() => {
    if (!externalRealtime || !realtimeQuotation) return;
    applyRealtimeQuote(realtimeQuotation);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalRealtime, realtimeQuotation]);

  // Calculations
  const subtotal = sections.reduce((sum, sec) => {
    return sum + sec.lines.reduce((s, line) => s + calcLineAmount(line), 0);
  }, 0);

  const totalGst = sections.reduce((sum, sec) => {
    return sum + sec.lines.reduce((s, line) => s + (calcLineAmount(line) * ((line.gstRate || 0) / 100)), 0);
  }, 0);

  const effectiveDiscount = Math.min(Math.max(0, discount), subtotal);
  const tax = subtotal > 0 ? Math.round(totalGst * (1 - effectiveDiscount / subtotal) * 100) / 100 : 0;
  const grandTotal = Math.round((subtotal - effectiveDiscount + tax + shipping) * 100) / 100;

  useEffect(() => {
    if (discountType === "percentage") {
      setDiscount(Math.min(subtotal, Math.round(subtotal * (discountPercent / 100) * 100) / 100));
    } else if (discount > subtotal) {
      setDiscount(subtotal);
    }
  }, [subtotal, discount, discountType, discountPercent]);

  function markDirty() {
    isDirtyRef.current = true;
  }

  const orderStage = order.stage || "";
  const isQuotationStage = [
    "Quotation In Progress",
    "Quotation Sent",
    "Quotation Negotiation",
    "Quotation Approved",
  ].includes(orderStage);
  
  const baseFrozen = !isQuotationStage;
  const isLocked = baseFrozen && !adminOverrideUnlocked;


  // ── Section Actions ──
  function updateSection(id: string, updater: (sec: SignageSection) => SignageSection) {
    markDirty();
    setSections((prev) => prev.map((s) => (s.siteVisitItemId === id ? updater(s) : s)));
  }

  function removeSection(sectionId: string) {
    if (confirm("Are you sure you want to remove this entire signage section?")) {
      markDirty();
      setSections((prev) => prev.filter((s) => s.siteVisitItemId !== sectionId));
    }
  }

  function addLine(sectionId: string) {
    updateSection(sectionId, (sec) => ({
      ...sec,
      lines: [...sec.lines, newItem(taxPercent)],
    }));
  }

  function removeLine(sectionId: string, lineId: string) {
    updateSection(sectionId, (sec) => {
      const remaining = sec.lines.filter((l) => l.id !== lineId);
      return {
        ...sec,
        lines: remaining.length > 0 ? remaining : [newItem(taxPercent)],
      };
    });
  }

  function updateLine(sectionId: string, lineId: string, patch: Partial<LineItem>) {
    updateSection(sectionId, (sec) => ({
      ...sec,
      lines: sec.lines.map((l) => (l.id === lineId ? { ...l, ...patch } : l)),
    }));
  }

  function selectProduct(sectionId: string, lineId: string, p: Product) {
    const resolved = resolveInitialPricing(p);
    const siteVisitItem = siteVisitItems.find((sv) => sv.id === sectionId);
    const defaultMeasurement =
      siteVisitItem?.width && siteVisitItem?.height
        ? siteVisitItem.width * siteVisitItem.height
        : 1;

    updateLine(sectionId, lineId, {
      productId: p.id,
      description: p.name,
      pricingType: resolved.pricingType,
      unit: resolved.pricingType === "per_sqft" ? "sqft" : "nos",
      unitPrice: resolved.price,
      quantity: defaultMeasurement,
      totalSqFt: defaultMeasurement,
    });
  }

  function setLineMeasurement(sectionId: string, lineId: string, value: number) {
    const measurement = value > 0 ? value : 0;
    updateLine(sectionId, lineId, {
      quantity: measurement,
      totalSqFt: measurement,
    });
  }

  // ── Save/Send Actions ──
  function handleSave() {
    if (!canEdit) return;
    setSaveMsg(null);
    startTransition(async () => {
      try {
        const saved = await upsertQuotation(order.id, {
          signage_options: sections,
          discount: effectiveDiscount,
          status: "Draft",
          notes,
          terms,
          shipping,
        });
        if (saved.quotation_id) setQuotationId(saved.quotation_id);
        setStatus("Draft");
        isDirtyRef.current = false;
        setSaveMsg({ text: "Quotation saved ✓", ok: true });
        setTimeout(() => setSaveMsg(null), 3000);
      } catch (err: any) {
        setSaveMsg({ text: err.message || "Save failed", ok: false });
      }
    });
  }

  const handleSendToCustomer = async () => {
    if (!canEdit) return;
    setSendingToCustomer(true);
    try {
      const actorName = currentUserName || currentUserRole || "Admin";
      const saved = await upsertQuotation(order.id, {
        signage_options: sections,
        discount: effectiveDiscount,
        status,
        notes,
        terms,
        shipping,
      });
      if (saved.quotation_id) setQuotationId(saved.quotation_id);
      await sendQuotationToCustomer(saved.id, actorName);
      setStatus("Sent");
      isDirtyRef.current = false;
      setSaveMsg({ text: "Quotation sent to customer successfully!", ok: true });
      setTimeout(() => setSaveMsg(null), 4000);
    } catch (err: any) {
      setSaveMsg({ text: err.message || "Send failed", ok: false });
    } finally {
      setSendingToCustomer(false);
    }
  };

  const inputCls = "border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 min-h-[40px]";

  return (
    <div className="space-y-6" style={{ fontFamily: "inherit" }}>
      {/* ── ADMIN OVERRIDE BANNER ── */}
      {baseFrozen && currentUserRole === "Admin" && setAdminOverrideUnlocked && (
        <div className={`p-4 rounded-xl border flex flex-col md:flex-row md:items-center gap-3 md:justify-between transition-colors ${adminOverrideUnlocked ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200'}`}>
          <div className="flex items-start md:items-center gap-3 min-w-0">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${adminOverrideUnlocked ? 'bg-amber-100 text-amber-600' : 'bg-slate-200 text-slate-500'}`}>
              <Shield size={16} />
            </div>
            <div className="min-w-0">
              <h4 className={`text-sm font-bold ${adminOverrideUnlocked ? 'text-amber-900' : 'text-slate-700'}`}>Admin God Mode</h4>
              <p className={`text-xs ${adminOverrideUnlocked ? 'text-amber-700' : 'text-slate-500'}`}>
                {adminOverrideUnlocked 
                  ? "Module is currently unlocked. You can edit all details and click 'Save Draft' at the bottom." 
                  : "This module is locked. Unlock it to forcefully edit details."}
              </p>
            </div>
          </div>
          <button
            onClick={() => setAdminOverrideUnlocked(!adminOverrideUnlocked)}
            className={`px-4 py-2.5 rounded-lg text-xs font-bold transition-colors w-full md:w-auto shrink-0 ${
              adminOverrideUnlocked 
                ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-xs' 
                : 'bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 shadow-3xs'
            }`}
          >
            {adminOverrideUnlocked ? "Lock Module" : "Unlock for Editing"}
          </button>
        </div>
      )}

      {/* Header Row */}
      <div className="flex flex-col md:flex-row md:items-center gap-3 md:justify-between bg-slate-50 p-3 md:p-4 border border-slate-200 rounded-2xl">
        <div className="flex flex-col gap-1.5 min-w-0">
          <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
            <ClipboardList size={16} className="text-blue-600 shrink-0" />
            Quotation Builder
          </h3>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-slate-400 font-bold uppercase">Quote No:</span>
            <input
              type="text"
              value={quotationId || "—"}
              readOnly={true}
              className="text-xs font-mono text-slate-700 bg-slate-100/50 border border-slate-200 cursor-not-allowed rounded px-2 py-1"
              style={{ width: "90px" }}
            />
          </div>
        </div>
        <div className="flex items-center gap-2 md:gap-3 flex-wrap">
          <button
            type="button"
            onClick={() => setShowDocumentPreview(true)}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] font-bold text-slate-700 hover:bg-slate-50 shadow-sm w-full sm:w-auto"
          >
            <Eye size={13} />
            Preview / Print
          </button>

          <span className={`text-[10px] px-2.5 py-1 rounded-full font-black uppercase border ${status === "Approved" ? "bg-emerald-50 border-emerald-200 text-emerald-700" :
              status === "Sent" ? "bg-blue-50 border-blue-200 text-blue-700" :
                status === "Rejected" ? "bg-rose-50 border-rose-200 text-rose-700" :
                  "bg-slate-100 border-slate-200 text-slate-600"
            }`}>
            {status}
          </span>
        </div>
      </div>

      {(status === "Rejected" || (status === "Draft" && rejectionReason)) && (
        <div className="p-4 rounded-2xl border flex items-center gap-3 shadow-sm bg-rose-50 border-rose-200 text-rose-800">
          <AlertCircle size={16} className="text-rose-600 shrink-0" />
          <div className="text-xs font-semibold">
            {status === "Rejected" ? "Quotation was rejected / declined by the customer." : "Previous quotation was rejected by customer (drafting new version)."}
            {rejectionReason && (
              <span className="block mt-1 text-rose-700 bg-white/50 px-2 py-1 rounded border border-rose-100">
                Reason: <span className="font-bold">"{rejectionReason}"</span>
              </span>
            )}
          </div>
        </div>
      )}

      {/* Customer Info Card */}
      <div className="bg-white rounded-2xl px-5 py-4 border border-slate-200 flex justify-between items-start text-xs shadow-sm">
        <div className="space-y-1.5 flex-1 max-w-[60%]">
          <div className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Bill To</div>
          <div className="font-black text-slate-800 py-0.5">
            {order.businessName} - {order.clientName}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-0.5">Date</div>
          <div className="font-mono text-slate-700 font-bold" suppressHydrationWarning>
            {new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
          </div>
        </div>
      </div>



      {/* Signage Sections */}
      <div className="space-y-6">
        {sections.map((section, sIdx) => {
          const itemTotal = section.lines.reduce((s, line) => s + calcLineAmount(line) * (1 + (line.gstRate || 0) / 100), 0);
          // Check matching site visit measurements for details
          const svItem = siteVisitItems.find((sv) => sv.id === section.siteVisitItemId);

          return (
            <div key={section.siteVisitItemId} className="border border-slate-200 rounded-2xl bg-white shadow-sm overflow-visible">
              {/* Section Header */}
              <div className="bg-[#f8fafc] px-4 md:px-5 py-3.5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center gap-2 sm:justify-between rounded-t-2xl">
                <div className="flex flex-col gap-0.5 min-w-0">
                  <span className="text-xs font-black text-[#0f172a] uppercase tracking-wider">{section.itemLabel}</span>
                  {(() => {
                    const measurementLabel = formatSiteMeasurementLabel(svItem);
                    return measurementLabel ? (
                      <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                        {measurementLabel}
                      </span>
                    ) : null;
                  })()}
                </div>
                <div className="flex items-center gap-3 sm:gap-4 shrink-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[10px] text-slate-400 font-black uppercase shrink-0">Total (incl. GST):</span>
                    <span className="text-sm font-black text-[#1e40af] font-mono truncate">
                      ₹{itemTotal.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  {!isLocked && (
                    <button
                      type="button"
                      onClick={() => removeSection(section.siteVisitItemId)}
                      className="text-slate-400 hover:text-rose-500 transition-colors p-2"
                      title="Remove section"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>

              {/* Line Items Table — wide horizontal scroll on phone/tablet */}
              <div
                className="overflow-x-auto overscroll-x-contain -mx-px scrollbar-none"
                style={{ WebkitOverflowScrolling: "touch" }}
              >
              <div className="min-w-[980px] md:min-w-[1040px]">
              <div
                className="grid gap-3 px-4 py-2.5 text-[10px] font-black text-[#64748b] uppercase tracking-wider bg-slate-50 border-b border-slate-100"
                style={{
                  gridTemplateColumns: "minmax(300px, 2.5fr) 80px 120px 120px 100px 56px 100px 36px",
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

              {/* Lines */}
              <div className="divide-y divide-slate-100 overflow-visible">
                {section.lines.map((line) => {
                  const lineAmt = calcLineAmount(line) * (1 + (line.gstRate || 0) / 100);
                  const measurement = getLineMeasurement(line);

                  return (
                    <div key={line.id} className="flex flex-col hover:bg-slate-50 transition-colors">
                      <div
                        className="grid gap-3 px-4 py-3 items-center overflow-visible"
                        style={{
                          gridTemplateColumns: "minmax(300px, 2.5fr) 80px 120px 120px 100px 56px 100px 36px",
                          position: "relative",
                          zIndex: activeRowId === line.id ? 50 : 1,
                        }}
                        onFocus={() => setActiveRowId(line.id)}
                        onBlur={(e) => {
                          if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                            setActiveRowId(null);
                          }
                        }}
                      >
                        {/* Product Search / Description */}
                        <div className="flex items-center gap-2 w-full min-w-0">
                          <ProductSearch
                            value={line.description}
                            products={products}
                            disabled={isLocked}
                            onSelect={(p) => selectProduct(section.siteVisitItemId, line.id, p)}
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
                                const prod = products.find((p) => p.id === line.productId);
                                if (prod) setSelectedProductInfo(prod);
                              }}
                              className="shrink-0 p-2 text-blue-600 rounded-lg hover:bg-blue-50"
                              title="Product Details"
                            >
                              <Info size={14} style={{ strokeWidth: 2.5 }} />
                            </button>
                          )}
                        </div>

                        {/* HSN */}
                        <input
                          type="text"
                          value={line.hsn || ""}
                          disabled={isLocked}
                          onChange={(e) =>
                            updateLine(section.siteVisitItemId, line.id, {
                              hsn: e.target.value,
                            })
                          }
                          className={`${inputCls} w-full py-1.5 text-center font-mono`}
                          placeholder="HSN"
                          maxLength={12}
                        />

                        {/* Unit Type Selector */}
                        <select
                          value={normalizePricingType(line.pricingType)}
                          disabled={isLocked}
                          onChange={(e) => {
                            const newType = e.target.value as PricingType;
                            const measurement = getLineMeasurement(line) || 1;
                            const patch: Partial<LineItem> = {
                              pricingType: newType,
                              unit: newType === "per_sqft" ? "sqft" : "nos",
                              quantity: measurement,
                              totalSqFt: measurement,
                            };

                            if (line.productId) {
                              const p = products.find((prod) => prod.id === line.productId);
                              if (p) {
                                patch.unitPrice = getProductPriceForType(p, newType);
                              }
                            }
                            updateLine(section.siteVisitItemId, line.id, patch);
                          }}
                          className={`${inputCls} w-full py-1.5 px-2 bg-white`}
                        >
                          <option value="per_unit">Per Unit</option>
                          <option value="per_sqft">Per Sq.Ft</option>
                        </select>

                        {/* Qty / Measurement — same field for unit and sqft */}
                        <input
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={measurement === 0 ? "" : measurement}
                          disabled={isLocked}
                          onFocus={(e) => e.target.select()}
                          onBlur={() => {
                            if (getLineMeasurement(line) <= 0) {
                              setLineMeasurement(section.siteVisitItemId, line.id, 1);
                            }
                          }}
                          onChange={(e) =>
                            setLineMeasurement(
                              section.siteVisitItemId,
                              line.id,
                              parseFloat(e.target.value) || 0
                            )
                          }
                          className={`${inputCls} w-full py-1.5 text-center font-mono`}
                          placeholder="Qty / Meas."
                        />

                        {/* Rate */}
                        <div className="relative">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-bold">₹</span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={line.unitPrice === 0 ? "" : line.unitPrice}
                            disabled={isLocked}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) =>
                              updateLine(section.siteVisitItemId, line.id, {
                                unitPrice: parseFloat(e.target.value) || 0,
                              })
                            }
                            className={`${inputCls} w-full pl-5 pr-2 py-1.5 text-right font-mono`}
                            placeholder="0.00"
                          />
                        </div>

                        {/* GST */}
                        <select
                          value={line.gstRate}
                          disabled={isLocked}
                          onChange={(e) =>
                            updateLine(section.siteVisitItemId, line.id, {
                              gstRate: Number(e.target.value),
                            })
                          }
                          className={`${inputCls} w-full py-1.5 text-center bg-white`}
                        >
                          {GST_OPTIONS.map((g) => (
                            <option key={g} value={g}>{g}%</option>
                          ))}
                        </select>

                        {/* Line Amount */}
                        <div className="text-right text-xs font-black font-mono text-slate-800 whitespace-nowrap">
                          ₹{lineAmt.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>

                        {/* Delete button */}
                        <button
                          type="button"
                          disabled={isLocked}
                          onClick={() => removeLine(section.siteVisitItemId, line.id)}
                          className="text-slate-300 hover:text-rose-500 transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>

                      {/* Note section */}
                      <div className="px-4 pb-3 flex flex-col gap-2">
                        {(line.notes !== undefined && line.notes !== null) ? (
                          <div className="relative">
                            <textarea
                              value={line.notes}
                              onChange={(e) => updateLine(section.siteVisitItemId, line.id, { notes: e.target.value })}
                              placeholder="Add item notes..."
                              disabled={isLocked}
                              className="w-full text-xs p-2 pr-8 border border-slate-200 rounded-lg outline-none focus:border-blue-500 min-h-[60px] text-slate-700 resize-y"
                            />
                            {!isLocked && (
                              <button
                                type="button"
                                onClick={() => updateLine(section.siteVisitItemId, line.id, { notes: undefined })}
                                className="absolute top-2 right-2 text-slate-400 hover:text-rose-500 bg-white rounded-md transition-colors"
                                title="Remove notes"
                              >
                                <X size={14} />
                              </button>
                            )}
                          </div>
                        ) : (
                          !isLocked && (
                            <button
                              type="button"
                              onClick={() => updateLine(section.siteVisitItemId, line.id, { notes: "" })}
                              className="text-xs text-blue-600 font-semibold flex items-center gap-1 hover:text-blue-700 self-start"
                            >
                              <Plus size={12} /> Add Note
                            </button>
                          )
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              </div>
              </div>

              {/* Add Line inside section */}
              {!isLocked && (
                <div className="border-t border-slate-100 p-3 bg-slate-50/50 rounded-b-2xl">
                  <button
                    type="button"
                    onClick={() => addLine(section.siteVisitItemId)}
                    className="w-full flex items-center justify-center gap-1.5 py-2 border border-dashed border-slate-200 rounded-xl text-xs font-bold text-slate-500 hover:border-blue-400 hover:text-blue-600 transition-all bg-white shadow-sm"
                  >
                    <Plus size={13} /> Add Line Item
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>





      {/* Recreated 2nd SS bottom section layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
        {/* Left Column: Notes, Included Services, Terms */}
        <div className="space-y-4">
          {/* Notes */}
          <div>
            <label className="block text-[10px] font-black text-[#0f172a] uppercase tracking-wider mb-1">Notes</label>
            <textarea
              value={notes}
              disabled={isLocked}
              onChange={(e) => { markDirty(); setNotes(e.target.value); }}
              rows={3}
              placeholder="Internal notes or notes for customer..."
              className={`${inputCls} w-full px-3.5 py-2.5 resize-none bg-white font-medium`}
            />
          </div>



          {/* Terms & Conditions */}
          <div>
            <label className="block text-[10px] font-black text-[#0f172a] uppercase tracking-wider mb-1">Terms & Conditions</label>
            <textarea
              value={terms}
              disabled={isLocked}
              onChange={(e) => { markDirty(); setTerms(e.target.value); }}
              rows={10}
              placeholder="Terms and conditions - late fees, payment methods, delivery schedule"
              className={`${inputCls} w-full min-h-[280px] px-3.5 py-2.5 resize-y bg-white font-medium`}
            />
          </div>
        </div>

        {/* Right Column: Invoice summary details */}
        <div className="bg-[#f8fafc] border border-slate-200/80 rounded-3xl p-6 space-y-4 shadow-sm h-fit">
          {/* Subtotal */}
          <div className="flex justify-between items-center text-xs font-bold text-slate-500 uppercase tracking-wider pb-3 border-b border-slate-200/50">
            <span>Subtotal</span>
            <span className="font-mono text-slate-800 text-sm">
              ₹{subtotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </span>
          </div>

          {/* Tax Amount Display */}
          <div className="flex justify-between items-center text-xs font-bold text-slate-500 uppercase tracking-wider pb-3 border-b border-slate-200/50">
            <span>Tax Amount (GST)</span>
            <span className="font-mono text-slate-800">
              ₹{tax.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </span>
          </div>

          {/* Discount & Shipping Buttons / Inputs */}
          <div className="space-y-3.5 py-1.5">
            <div className="flex gap-4">
              {!showDiscountInput && (
                <button
                  type="button"
                  onClick={() => setShowDiscountInput(true)}
                  className="text-xs font-black text-[#1e40af] hover:text-[#173087] flex items-center gap-1 transition-colors"
                >
                  + Discount
                </button>
              )}
              {!showShippingInput && (
                <button
                  type="button"
                  onClick={() => setShowShippingInput(true)}
                  className="text-xs font-black text-[#1e40af] hover:text-[#173087] flex items-center gap-1 transition-colors"
                >
                  + Shipping
                </button>
              )}
            </div>

            {showDiscountInput && (
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-black text-[#0f172a] uppercase tracking-wider">Discount</label>
                  <button
                    type="button"
                    onClick={() => {
                      setDiscount(0);
                      setDiscountPercent(0);
                      setDiscountType("amount");
                      setShowDiscountInput(false);
                    }}
                    className="text-[10px] text-rose-500 hover:underline font-bold"
                  >
                    Remove
                  </button>
                </div>
                <div className="flex gap-2">
                  <select
                    value={discountType}
                    disabled={isLocked && isEmployee}
                    onChange={(e) => {
                      const type = e.target.value as "amount" | "percentage";
                      setDiscountType(type);
                      if (type === "percentage") {
                        setDiscount(Math.min(subtotal, Math.round(subtotal * (discountPercent / 100) * 100) / 100));
                      }
                      markDirty();
                    }}
                    className={`${inputCls} w-16 px-2 py-2 font-mono font-bold bg-white text-center cursor-pointer`}
                  >
                    <option value="amount">₹</option>
                    <option value="percentage">%</option>
                  </select>
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-black">
                      {discountType === "amount" ? "₹" : "%"}
                    </span>
                    <input
                      type="number"
                      min="0"
                      max={discountType === "percentage" ? "100" : undefined}
                      value={discountType === "percentage" ? (discountPercent === 0 ? "" : discountPercent) : (discount === 0 ? "" : discount)}
                      disabled={isLocked && isEmployee}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        markDirty();
                        if (discountType === "percentage") {
                          const p = Math.min(Math.max(0, val), 100);
                          setDiscountPercent(p);
                          setDiscount(Math.min(subtotal, Math.round(subtotal * (p / 100) * 100) / 100));
                        } else {
                          setDiscount(Math.min(Math.max(0, val), subtotal));
                        }
                      }}
                      className={`${inputCls} w-full pl-7 pr-3 py-2 font-mono font-bold bg-white`}
                      placeholder="0.00"
                    />
                  </div>
                </div>
                {discountType === "percentage" && discount > 0 && (
                  <div className="text-[10px] text-slate-500 font-medium text-right mt-1 px-1">
                    Amount to deduct: ₹{discount.toFixed(2)}
                  </div>
                )}
              </div>
            )}

            {showShippingInput && (
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-black text-[#0f172a] uppercase tracking-wider">Shipping (₹)</label>
                  <button
                    type="button"
                    onClick={() => {
                      setShipping(0);
                      setShowShippingInput(false);
                    }}
                    className="text-[10px] text-rose-500 hover:underline font-bold"
                  >
                    Remove
                  </button>
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-black">₹</span>
                  <input
                    type="number"
                    min="0"
                    value={shipping === 0 ? "" : shipping}
                    disabled={isLocked}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => {
                      markDirty();
                      setShipping(parseFloat(e.target.value) || 0);
                    }}
                    className={`${inputCls} w-full pl-7 pr-3 py-2 font-mono font-bold bg-white`}
                    placeholder="0.00"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Grand Total */}
          <div className="flex justify-between items-center py-4 border-t border-slate-200">
            <span className="font-black text-slate-900 text-sm uppercase tracking-wider">Total</span>
            <span className="font-black text-[#0f172a] text-xl font-mono">
              ₹{grandTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </span>
          </div>

        </div>
      </div>

      {/* Save Msg Notification */}
      {saveMsg && (
        <div className={`p-3.5 rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm border ${saveMsg.ok ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-rose-50 border-rose-200 text-rose-700"
          }`}>
          {saveMsg.ok ? <Check size={14} /> : <AlertCircle size={14} />}
          {saveMsg.text}
        </div>
      )}

      {/* Action Buttons Row */}
      {(() => {
        const portalTarget = isMounted ? document.getElementById("modal-footer-portal") : null;

        const isEmployeeRole = currentUserRole === "Employee";
        const isAdmin = currentUserRole === "Admin";
        const nextStageLabel = nextStageLabelFromWorkflow(order.workflow_type);
        const quoteStage = order.stage || "";
        // isQuotationStage is defined above now
        // Staff and admin advance only after customer approval; admin may bypass separately when Sent.
        const canMoveToNextStage =
          !!onRequestAdvance &&
          isQuotationStage &&
          status === "Approved" &&
          quoteStage === "Quotation Approved";
        const canAdminApproveWithoutCustomer =
          !!onRequestAdvance &&
          isAdmin &&
          isQuotationStage &&
          status === "Sent";
        const canSendToCustomer =
          status === "Draft" ||
          status === "Sent" ||
          status === "Rejected" ||
          status === "Pending Approval";
        const advanceButtonLabel = isEmployeeRole
          ? `Request Advance to ${nextStageLabel}`
          : `Move to ${nextStageLabel}`;

        const actionButtons = (
          <>
            {!isLocked ? (
              <div className="flex flex-row flex-wrap items-stretch sm:items-center gap-2 w-full">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={isPending}
                  className="py-2.5 px-4 bg-slate-100 border border-slate-200 text-slate-700 hover:bg-slate-200 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 shadow-sm flex-1 sm:flex-none min-w-0"
                >
                  {isPending ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                  Save Draft
                </button>

                {canSendToCustomer && (
                  <button
                    type="button"
                    onClick={() => setShowSendConfirm(true)}
                    disabled={isPending || sendingToCustomer || sections.length === 0}
                    className="py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex-1 sm:flex-none min-w-0"
                  >
                    {sendingToCustomer ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Check size={14} />
                    )}
                    Send to Customer
                  </button>
                )}

                {canAdminApproveWithoutCustomer && (
                  <button
                    type="button"
                    onClick={() => setAdvanceConfirmType("override")}
                    disabled={isPending}
                    className="py-2.5 px-4 md:px-5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50 flex-1 sm:flex-none min-w-0"
                  >
                    <Sparkles size={13} className="shrink-0" />
                    <span className="text-center leading-tight">
                      <span className="md:hidden">Approve &amp; Advance</span>
                      <span className="hidden md:inline">Approve without Customer &amp; Advance</span>
                    </span>
                  </button>
                )}

                {canMoveToNextStage && (
                  <button
                    type="button"
                    onClick={() => setAdvanceConfirmType("advance")}
                    className="py-2.5 px-4 md:px-5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 shadow-sm flex-1 sm:flex-none min-w-0"
                  >
                    <Sparkles size={13} className="shrink-0" />
                    {advanceButtonLabel}
                  </button>
                )}
              </div>
            ) : (
              <div className="flex flex-row flex-wrap items-stretch sm:items-center gap-2 w-full">
                <div className="py-2.5 px-4 bg-slate-100 border border-slate-200 text-slate-500 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 shadow-sm flex-1 sm:flex-none min-w-0">
                  <Check size={14} /> Submitted & Locked
                </div>
                {canAdminApproveWithoutCustomer && (
                  <button
                    type="button"
                    onClick={() => setAdvanceConfirmType("override")}
                    disabled={isPending}
                    className="py-2.5 px-4 md:px-5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50 flex-1 sm:flex-none min-w-0"
                  >
                    <Sparkles size={13} className="shrink-0" />
                    <span className="text-center leading-tight">
                      <span className="md:hidden">Approve &amp; Advance</span>
                      <span className="hidden md:inline">Approve without Customer &amp; Advance</span>
                    </span>
                  </button>
                )}
                {canMoveToNextStage && (
                  <button
                    type="button"
                    onClick={() => setAdvanceConfirmType("advance")}
                    className="py-2.5 px-4 md:px-5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 shadow-sm flex-1 sm:flex-none min-w-0"
                  >
                    <Sparkles size={13} className="shrink-0" />
                    {advanceButtonLabel}
                  </button>
                )}
              </div>
            )}
          </>
        );

        if (portalTarget) {
          return createPortal(
            <div className="flex flex-col sm:flex-row flex-wrap gap-2.5 items-stretch sm:items-center justify-end w-full">
              {actionButtons}
            </div>,
            portalTarget
          );
        }

        return null;
      })()}

      {selectedProductInfo && (
        <ProductInfoModal
          product={selectedProductInfo}
          onClose={() => setSelectedProductInfo(null)}
        />
      )}

      {showDocumentPreview && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-stretch md:items-center justify-center overflow-hidden bg-black/50 p-0 md:p-4 lg:p-6 print:static print:inset-auto print:block print:bg-transparent print:p-0 print:overflow-visible">
          <div className="relative flex w-full h-full md:h-auto md:max-h-[92dvh] max-w-4xl flex-col rounded-none md:rounded-2xl bg-slate-100 shadow-2xl print:static print:max-w-none print:max-h-none print:shadow-none print:bg-transparent print:rounded-none print:h-auto">
            <div className="shrink-0 flex items-start justify-between gap-2 sm:gap-3 border-b border-slate-200 bg-white px-3 sm:px-4 py-3 md:rounded-t-2xl quotation-no-print">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1 md:mb-0">
                  <button
                    type="button"
                    onClick={() => setShowDocumentPreview(false)}
                    className="md:hidden inline-flex items-center gap-1.5 shrink-0 rounded-lg px-2.5 py-1.5 bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200 transition-colors"
                    aria-label="Back"
                  >
                    <ArrowLeft size={14} />
                    Back
                  </button>
                  <h3 className="text-sm font-black text-slate-900 truncate">Customer quotation preview</h3>
                </div>
                <p className="text-[11px] text-slate-500 leading-snug hidden sm:block md:mt-0.5">
                  Same layout as the portal. Use Print / Save as PDF on the document.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowDocumentPreview(false)}
                className="rounded-lg border border-slate-200 bg-white p-2 text-slate-500 hover:bg-slate-50 shrink-0"
                aria-label="Close preview"
              >
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-2 sm:p-3 md:p-6 print:overflow-visible print:p-0 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              <QuotationDocument
                quotationId={quotationId}
                quoteDate={quoteCreatedAt || new Date().toISOString()}
                status={status}
                showStatus
                billToName={[order.businessName, order.clientName].filter(Boolean).join(" - ") || "—"}
                billToAddress={null}
                placeOfSupply={invoiceProfile.placeOfSupplyDefault}
                sections={sections}
                subtotal={subtotal}
                discount={effectiveDiscount}
                shipping={shipping}
                tax={tax}
                grandTotal={grandTotal}
                notes={notes}
                terms={terms}
                invoiceProfile={invoiceProfile}
                siteVisitItems={siteVisitItems}
                showPrintButton
              />
            </div>
          </div>
        </div>,
        document.body
      )}

      {showSendConfirm && (
        <QuotationConfirmModal
          status={status}
          subtotal={subtotal}
          discount={effectiveDiscount}
          tax={tax}
          shipping={shipping}
          grandTotal={grandTotal}
          totalItems={sections.reduce((acc, sec) => acc + sec.lines.length, 0)}
          sectionSummaries={sections.map((sec) => ({
            id: sec.siteVisitItemId,
            name: sec.itemLabel || "Custom Signage",
            linesCount: sec.lines.length,
            amount: sec.lines.reduce((s, line) => s + calcLineAmount(line), 0),
            lines: sec.lines.map(l => ({
              id: l.id,
              description: l.description || "Custom Item",
              amount: calcLineAmount(l)
            }))
          }))}
          onConfirm={() => {
            handleSendToCustomer();
            setShowSendConfirm(false);
          }}
          onClose={() => setShowSendConfirm(false)}
        />
      )}

      {advanceConfirmType && (
        <WorkflowAdvanceConfirmModal
          mode={advanceConfirmType}
          isEmployee={currentUserRole === "Employee"}
          nextStageLabel={nextStageLabelFromWorkflow(order.workflow_type)}
          onConfirm={() => {
            onRequestAdvance?.();
            setAdvanceConfirmType(null);
          }}
          onClose={() => setAdvanceConfirmType(null)}
        />
      )}
    </div>
  );
};

function nextStageLabelFromWorkflow(workflowType?: "quote_first" | "design_first"): string {
  return workflowType === "design_first" ? "Production" : "Design In Progress";
}

// ─────────────────────────────────────────────────────────────────────────────
// Product Info Popup Modal Component
// ─────────────────────────────────────────────────────────────────────────────
function ProductInfoModal({ product, onClose }: { product: Product; onClose: () => void }) {
  const [activeImgIdx, setActiveImgIdx] = useState(0);
  const images = product.images && product.images.length > 0 ? product.images : [];

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100000] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="relative flex w-full sm:max-w-[500px] max-h-[min(92dvh,100%)] flex-col overflow-hidden rounded-t-2xl sm:rounded-2xl bg-white shadow-2xl border border-slate-100"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-info-title"
      >
        {/* Header */}
        <div className="shrink-0 flex items-start justify-between gap-3 border-b border-slate-100 bg-slate-50 px-4 py-3 sm:px-6 sm:py-4">
          <div className="min-w-0 flex-1 pr-2">
            <h4
              id="product-info-title"
              className="m-0 text-sm font-black text-slate-800 uppercase tracking-wide truncate"
            >
              {product.name}
            </h4>
            <span className="mt-0.5 block text-[10px] font-bold uppercase text-slate-400 truncate">
              {product.product_id} • {product.category || "General"}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-full text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-colors"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6 sm:py-5 flex flex-col gap-5">
          {images.length > 0 ? (
            <div className="flex flex-col gap-2">
              <div className="aspect-video bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden flex items-center justify-center">
                <img
                  src={images[activeImgIdx]}
                  alt={product.name}
                  className="max-h-full max-w-full object-contain"
                  onError={(e) => {
                    e.currentTarget.src =
                      "https://images.unsplash.com/photo-1542744094-3a31f103e35f?w=400&auto=format&fit=crop";
                  }}
                />
              </div>
              {images.length > 1 && (
                <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
                  {images.map((img: string, idx: number) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setActiveImgIdx(idx)}
                      className={`shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 transition-colors ${
                        activeImgIdx === idx ? "border-blue-600" : "border-slate-300"
                      }`}
                    >
                      <img src={img} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="aspect-video bg-slate-50 border border-slate-200 rounded-2xl flex flex-col items-center justify-center text-slate-300 gap-1">
              <Package size={32} strokeWidth={1.5} />
              <span className="text-[10px] font-bold uppercase">No images uploaded</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 rounded-2xl border border-blue-100 bg-blue-50/30 p-4">
            <div>
              <span className="block text-[9px] font-black uppercase tracking-wider text-slate-400">Pricing Type</span>
              <span className="mt-0.5 block text-xs font-extrabold text-slate-700 capitalize">
                {product.pricing_type?.replace("_", " ")}
              </span>
            </div>
            <div>
              <span className="block text-[9px] font-black uppercase tracking-wider text-slate-400">Standard Rate</span>
              <span className="mt-0.5 block text-xs font-black text-blue-700 font-mono">
                ₹{(product.price_per_unit || product.price_per_sqft || 0).toLocaleString("en-IN")}
                <span className="text-[10px] font-medium text-slate-400 font-sans">
                  /{product.pricing_type === "per_sqft" ? "sqft" : "unit"}
                </span>
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">Product Description</span>
            <p className="m-0 text-xs text-slate-600 leading-relaxed font-medium">
              High-quality {product.name} suitable for premium indoor and outdoor signage applications.
              Manufactured with durable materials to ensure long-lasting visibility and brand representation.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-slate-100 bg-slate-50 px-4 py-3 sm:px-6 flex justify-end pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Quotation Confirm Modal Component
// ─────────────────────────────────────────────────────────────────────────────
function getSendConfirmSubtitle(status: string): string {
  if (status === "Rejected") {
    return "Review revised totals before resending to the customer.";
  }
  if (status === "Sent") {
    return "Review totals before resending the quotation to the customer.";
  }
  return "Review totals before sending to the customer for approval.";
}

function QuotationConfirmModal({
  status,
  subtotal,
  discount,
  tax,
  shipping,
  grandTotal,
  totalItems,
  sectionSummaries,
  onConfirm,
  onClose,
}: {
  status: string;
  subtotal: number;
  discount: number;
  tax: number;
  shipping: number;
  grandTotal: number;
  totalItems: number;
  sectionSummaries: {
    id: string;
    name: string;
    linesCount: number;
    amount: number;
    lines: { id: string; description: string; amount: number; }[];
  }[];
  onConfirm: () => void;
  onClose: () => void;
}) {
  const confirmLabel = status === "Rejected" ? "Resend to Customer" : "Send to Customer";

  return (
    <OverlayPortal>
      <div
        className="fixed inset-0 z-[100000] flex items-end md:items-center justify-center bg-black/60 backdrop-blur-sm p-0 md:p-4"
        onClick={onClose}
        role="presentation"
      >
      <div
        style={{
          backgroundColor: "white",
          borderRadius: "16px 16px 0 0",
          maxWidth: "400px",
          width: "100%",
          overflow: "hidden",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
          border: "1px solid #f1f5f9",
          display: "flex",
          flexDirection: "column",
          maxHeight: "92dvh",
        }}
        className="md:!rounded-2xl md:!max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div style={{ padding: "14px 16px", borderBottom: "1px solid #f1f5f9", backgroundColor: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", flexShrink: 0 }}>
          <div style={{ minWidth: 0 }}>
            <h4 style={{ margin: 0, fontSize: "14px", fontWeight: 800, color: "#0f172a", textTransform: "uppercase" }}>
              Confirm Quotation
            </h4>
            <span style={{ fontSize: "10px", color: "#64748b", fontWeight: 600, display: "block", marginTop: "2px" }}>
              {getSendConfirmSubtitle(status)}
            </span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 shrink-0 p-1" aria-label="Close">
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "12px", overflowY: "auto", flex: 1, minHeight: 0 }}>
          {/* Section Summaries Breakdown */}
          {sectionSummaries && sectionSummaries.length > 0 && (
            <div style={{ maxHeight: "160px", overflowY: "auto", borderBottom: "1px dashed #cbd5e1", paddingBottom: "12px", marginBottom: "4px", display: "flex", flexDirection: "column", gap: "10px" }}>
              {sectionSummaries.map((sec) => (
                <div key={sec.id} style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" }}>
                    <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                      <span style={{ fontSize: "12px", color: "#334155", fontWeight: 700 }}>{sec.name}</span>
                      <span style={{ fontSize: "10px", color: "#94a3b8", fontWeight: 600 }}>{sec.linesCount} line item{sec.linesCount !== 1 ? 's' : ''}</span>
                    </div>
                    <span style={{ fontSize: "12px", color: "#0f172a", fontWeight: 700, flexShrink: 0 }}>
                      ₹{sec.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  {/* Detailed Lines */}
                  {sec.lines && sec.lines.length > 0 && (
                    <div style={{ paddingLeft: "8px", borderLeft: "2px solid #e2e8f0", display: "flex", flexDirection: "column", gap: "4px" }}>
                      {sec.lines.map(line => (
                        <div key={line.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" }}>
                          <span style={{ fontSize: "11px", color: "#64748b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0, flex: 1 }}>
                            {line.description}
                          </span>
                          <span style={{ fontSize: "11px", color: "#475569", fontWeight: 600, flexShrink: 0 }}>
                            ₹{line.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "12px", color: "#64748b", fontWeight: 600 }}>Total Items</span>
            <span style={{ fontSize: "12px", color: "#0f172a", fontWeight: 800 }}>{totalItems}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "12px", color: "#64748b", fontWeight: 600 }}>Subtotal</span>
            <span style={{ fontSize: "12px", color: "#0f172a", fontWeight: 800 }}>₹{subtotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
          </div>
          {discount > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "12px", color: "#64748b", fontWeight: 600 }}>Discount</span>
              <span style={{ fontSize: "12px", color: "#16a34a", fontWeight: 800 }}>-₹{discount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "12px", color: "#64748b", fontWeight: 600 }}>Tax (GST)</span>
            <span style={{ fontSize: "12px", color: "#0f172a", fontWeight: 800 }}>+₹{tax.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
          </div>
          {shipping > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "12px", color: "#64748b", fontWeight: 600 }}>Shipping</span>
              <span style={{ fontSize: "12px", color: "#0f172a", fontWeight: 800 }}>+₹{shipping.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
            </div>
          )}
          <div style={{ borderTop: "1px dashed #cbd5e1", margin: "4px 0" }} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "14px", color: "#0f172a", fontWeight: 900 }}>Grand Total</span>
            <span style={{ fontSize: "16px", color: "#2563eb", fontWeight: 900, wordBreak: "break-all", textAlign: "right" }}>₹{grandTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "12px 16px",
            paddingBottom: "max(12px, env(safe-area-inset-bottom))",
            borderTop: "1px solid #f1f5f9",
            backgroundColor: "#f8fafc",
            display: "flex",
            flexDirection: "column-reverse",
            gap: "8px",
            flexShrink: 0,
          }}
          className="md:!flex-row md:!justify-end"
        >
          <button
            onClick={onClose}
            style={{ padding: "10px 16px", backgroundColor: "white", color: "#475569", border: "1px solid #cbd5e1", borderRadius: "8px", fontSize: "12px", fontWeight: 700, cursor: "pointer", width: "100%" }}
            className="md:!w-auto"
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#f1f5f9"}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "white"}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            style={{ padding: "10px 16px", backgroundColor: "#22c55e", color: "white", border: "none", borderRadius: "8px", fontSize: "12px", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "4px", width: "100%" }}
            className="md:!w-auto"
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#16a34a"}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "#22c55e"}
          >
            <Check size={14} /> {confirmLabel}
          </button>
        </div>
      </div>
    </div>
    </OverlayPortal>
  );
}

function WorkflowAdvanceConfirmModal({
  mode,
  isEmployee,
  nextStageLabel,
  onConfirm,
  onClose,
}: {
  mode: "override" | "advance";
  isEmployee: boolean;
  nextStageLabel: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const title =
    mode === "override"
      ? "Approve Without Customer?"
      : isEmployee
        ? `Request Advance to ${nextStageLabel}?`
        : `Move to ${nextStageLabel}?`;
  const description =
    mode === "override"
      ? `This will mark the quotation as approved on behalf of the customer, set the order to Quotation Approved, and advance it to ${nextStageLabel}.`
      : isEmployee
        ? `This flags the order for admin review. The order will not move to ${nextStageLabel} until an admin approves.`
        : `This will advance the order from Quotation Approved to ${nextStageLabel}.`;
  const confirmLabel =
    mode === "override"
      ? "Approve & Advance"
      : isEmployee
        ? "Submit Request"
        : `Move to ${nextStageLabel}`;

  return (
    <OverlayPortal>
      <div
        className="fixed inset-0 z-[100000] flex items-end md:items-center justify-center bg-black/60 backdrop-blur-sm p-0 md:p-4"
        onClick={onClose}
        role="presentation"
      >
      <div
        style={{
          backgroundColor: "white",
          borderRadius: "14px 14px 0 0",
          maxWidth: "420px",
          width: "100%",
          overflow: "hidden",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
          border: "1px solid #f1f5f9",
          display: "flex",
          flexDirection: "column",
          maxHeight: "92dvh",
        }}
        className="md:!rounded-[14px]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div style={{ padding: "16px", borderBottom: "1px solid #f1f5f9", backgroundColor: "#f8fafc" }}>
          <h4 style={{ margin: 0, fontSize: "14px", fontWeight: 800, color: "#0f172a", textTransform: "uppercase" }}>
            {title}
          </h4>
          <p style={{ margin: "8px 0 0", fontSize: "12px", color: "#64748b", lineHeight: 1.5 }}>{description}</p>
        </div>
        <div
          style={{
            padding: "12px 16px",
            paddingBottom: "max(12px, env(safe-area-inset-bottom))",
            borderTop: "1px solid #f1f5f9",
            backgroundColor: "#f8fafc",
            display: "flex",
            flexDirection: "column-reverse",
            gap: "8px",
          }}
          className="md:!flex-row md:!justify-end"
        >
          <button
            onClick={onClose}
            style={{ padding: "10px 16px", backgroundColor: "white", color: "#475569", border: "1px solid #cbd5e1", borderRadius: "8px", fontSize: "12px", fontWeight: 700, cursor: "pointer", width: "100%" }}
            className="md:!w-auto"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            style={{ padding: "10px 16px", backgroundColor: mode === "override" ? "#d97706" : "#16a34a", color: "white", border: "none", borderRadius: "8px", fontSize: "12px", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "4px", width: "100%" }}
            className="md:!w-auto"
          >
            <Check size={14} /> {confirmLabel}
          </button>
        </div>
      </div>
    </div>
    </OverlayPortal>
  );
}
