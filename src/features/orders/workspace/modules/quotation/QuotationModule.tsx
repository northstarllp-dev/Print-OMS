"use client";

import React, { useState, useEffect, useRef, useTransition } from "react";
import { createPortal } from "react-dom";
import {
  Plus, Trash2, Search, Check, ChevronDown, Info, X,
  ClipboardList, IndianRupee, Loader2, AlertCircle, Package, Save, Sparkles, Shield,
  Eye
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
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
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

  return (
    <div ref={ref} style={{ position: "relative", width: "100%" }}>
      <div style={{ position: "relative" }}>
        <Search
          size={11}
          style={{
            position: "absolute",
            left: 8,
            top: "50%",
            transform: "translateY(-50%)",
            color: "#94a3b8",
            pointerEvents: "none",
          }}
        />
        <input
          type="text"
          value={query}
          disabled={disabled}
          onChange={(e) => {
            setQuery(e.target.value);
            onChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            setQuery(value);
            setOpen(true);
          }}
          placeholder="Item description or search..."
          className="w-full border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
          style={{ padding: "6px 8px 6px 24px", fontFamily: "inherit" }}
        />
      </div>

      {open && filtered.length > 0 && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            background: "white",
            border: "1px solid #e2e8f0",
            borderRadius: 8,
            boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
            zIndex: 9999,
            maxHeight: 200,
            overflowY: "auto",
          }}
        >
          {filtered.map((p) => {
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
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: "8px 12px",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  borderBottom: "1px solid #f1f5f9",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 8,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#f8fafc";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "none";
                }}
              >
                <div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#0f172a" }}>{p.name}</span>
                  {p.category && (
                    <span style={{ fontSize: 9, color: "#94a3b8", marginLeft: 6 }}>{p.category}</span>
                  )}
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: "#0f172a", fontFamily: "monospace" }}>
                    ₹{resolved.price.toLocaleString("en-IN")}
                  </div>
                  <div style={{ fontSize: 9, color: "#64748b" }}>
                    per {resolved.pricingType === "per_sqft" ? "sqft" : "unit"}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
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

  const inputCls = "border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500";

  return (
    <div className="space-y-6" style={{ fontFamily: "inherit" }}>
      {/* ── ADMIN OVERRIDE BANNER ── */}
      {baseFrozen && currentUserRole === "Admin" && setAdminOverrideUnlocked && (
        <div className={`p-4 rounded-xl border flex items-center justify-between transition-colors ${adminOverrideUnlocked ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200'}`}>
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${adminOverrideUnlocked ? 'bg-amber-100 text-amber-600' : 'bg-slate-200 text-slate-500'}`}>
              <Shield size={16} />
            </div>
            <div>
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
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors ${
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
      <div className="flex items-center justify-between bg-slate-50 p-4 border border-slate-200 rounded-2xl">
        <div className="flex flex-col gap-1.5">
          <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
            <ClipboardList size={16} className="text-blue-600" />
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
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowDocumentPreview(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-bold text-slate-700 hover:bg-slate-50 shadow-sm"
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
              <div className="bg-[#f8fafc] px-5 py-3.5 border-b border-slate-100 flex items-center justify-between rounded-t-2xl">
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs font-black text-[#0f172a] uppercase tracking-wider">{section.itemLabel}</span>
                  {(() => {
                    const measurementLabel = formatSiteMeasurementLabel(svItem);
                    return measurementLabel ? (
                      <span className="text-[10px] text-slate-450 font-bold uppercase tracking-wider">
                        {measurementLabel}
                      </span>
                    ) : null;
                  })()}
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-400 font-black uppercase">Total (incl. GST):</span>
                    <span className="text-sm font-black text-[#1e40af] font-mono">
                      ₹{itemTotal.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  {!isLocked && (
                    <button
                      type="button"
                      onClick={() => removeSection(section.siteVisitItemId)}
                      className="text-slate-400 hover:text-rose-500 transition-colors p-1"
                      title="Remove section"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </div>

              {/* Line Items Table Header */}
              <div
                className="grid gap-2 px-4 py-2.5 text-[10px] font-black text-[#64748b] uppercase tracking-wider bg-slate-50 border-b border-slate-100"
                style={{
                  gridTemplateColumns: "1fr 72px 105px 110px 95px 40px 90px 28px",
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
                        className="grid gap-2 px-4 py-3.5 items-center overflow-visible"
                        style={{
                          gridTemplateColumns: "1fr 72px 105px 110px 95px 40px 90px 28px",
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
                        <div style={{ display: "flex", alignItems: "center", gap: "6px", width: "100%" }}>
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
                              style={{
                                padding: "4px",
                                color: "#2563eb",
                                background: "none",
                                border: "none",
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                borderRadius: "4px",
                                flexShrink: 0
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#eff6ff"}
                              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
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
              rows={3}
              placeholder="Terms and conditions - late fees, payment methods, delivery schedule"
              className={`${inputCls} w-full px-3.5 py-2.5 resize-none bg-white font-medium`}
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
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={isPending}
                  className="py-2 px-4 bg-slate-100 border border-slate-200 text-slate-700 hover:bg-slate-200 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 shadow-sm"
                >
                  {isPending ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                  Save Draft
                </button>

                {canSendToCustomer && (
                  <button
                    type="button"
                    onClick={() => setShowSendConfirm(true)}
                    disabled={isPending || sendingToCustomer || sections.length === 0}
                    className="py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
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
                    className="py-2 px-5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50"
                  >
                    <Sparkles size={13} />
                    Approve without Customer & Advance
                  </button>
                )}

                {canMoveToNextStage && (
                  <button
                    type="button"
                    onClick={() => setAdvanceConfirmType("advance")}
                    className="py-2 px-5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    <Sparkles size={13} />
                    {advanceButtonLabel}
                  </button>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <div className="py-2 px-4 bg-slate-100 border border-slate-200 text-slate-500 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 shadow-sm">
                  <Check size={14} /> Submitted & Locked
                </div>
                {canAdminApproveWithoutCustomer && (
                  <button
                    type="button"
                    onClick={() => setAdvanceConfirmType("override")}
                    disabled={isPending}
                    className="py-2 px-5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50"
                  >
                    <Sparkles size={13} />
                    Approve without Customer & Advance
                  </button>
                )}
                {canMoveToNextStage && (
                  <button
                    type="button"
                    onClick={() => setAdvanceConfirmType("advance")}
                    className="py-2 px-5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    <Sparkles size={13} />
                    {advanceButtonLabel}
                  </button>
                )}
              </div>
            )}
          </>
        );

        if (portalTarget) {
          return createPortal(
            <div className="flex gap-2.5 items-center justify-end w-full">
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
        <div className="fixed inset-0 z-[99999] flex items-center justify-center overflow-hidden bg-black/50 p-4 sm:p-6 print:static print:inset-auto print:block print:bg-transparent print:p-0 print:overflow-visible">
          <div className="relative flex w-full max-w-4xl max-h-full flex-col rounded-2xl bg-slate-100 shadow-2xl print:static print:max-w-none print:max-h-none print:shadow-none print:bg-transparent print:rounded-none">
            <div className="shrink-0 flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 rounded-t-2xl quotation-no-print">
              <div>
                <h3 className="text-sm font-black text-slate-900">Customer quotation preview</h3>
                <p className="text-[11px] text-slate-500">
                  Same layout as the portal. Use Print / Save as PDF on the document.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowDocumentPreview(false)}
                className="rounded-lg border border-slate-200 bg-white p-2 text-slate-500 hover:bg-slate-50"
                aria-label="Close preview"
              >
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 print:overflow-visible print:p-0">
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

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.6)",
        backdropFilter: "blur(4px)",
        zIndex: 99999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
      }}
    >
      <div
        style={{
          backgroundColor: "white",
          borderRadius: "24px",
          maxWidth: "500px",
          width: "100%",
          overflow: "hidden",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
          border: "1px solid #f1f5f9",
          display: "flex",
          flexDirection: "column",
          maxHeight: "90vh",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "16px 24px",
            borderBottom: "1px solid #f1f5f9",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            backgroundColor: "#f8fafc",
          }}
        >
          <div>
            <h4 style={{ margin: 0, fontSize: "14px", fontWeight: 900, color: "#1e293b", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              {product.name}
            </h4>
            <span style={{ fontSize: "10px", color: "#94a3b8", fontWeight: 700, textTransform: "uppercase", marginTop: "2px", display: "block" }}>
              {product.product_id} • {product.category || "General"}
            </span>
          </div>
          <button
            onClick={onClose}
            style={{
              padding: "6px",
              backgroundColor: "transparent",
              border: "none",
              cursor: "pointer",
              borderRadius: "9999px",
              color: "#94a3b8",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#e2e8f0"; e.currentTarget.style.color = "#475569"; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; e.currentTarget.style.color = "#94a3b8"; }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Scrollable Content */}
        <div style={{ padding: "24px", overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* Images Section */}
          {images.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <div
                style={{
                  aspectRatio: "16/9",
                  backgroundColor: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  borderRadius: "16px",
                  overflow: "hidden",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  position: "relative",
                }}
              >
                <img
                  src={images[activeImgIdx]}
                  alt={product.name}
                  style={{ maxHeight: "100%", maxWidth: "100%", objectFit: "contain" }}
                  onError={(e) => { e.currentTarget.src = "https://images.unsplash.com/photo-1542744094-3a31f103e35f?w=400&auto=format&fit=crop"; }}
                />
              </div>
              {images.length > 1 && (
                <div style={{ display: "flex", gap: "8px", overflowX: "auto", paddingBottom: "4px" }}>
                  {images.map((img: string, idx: number) => (
                    <button
                      key={idx}
                      onClick={() => setActiveImgIdx(idx)}
                      style={{
                        width: "56px",
                        height: "56px",
                        borderRadius: "8px",
                        overflow: "hidden",
                        border: activeImgIdx === idx ? "2px solid #2563eb" : "2px solid #cbd5e1",
                        padding: 0,
                        backgroundColor: "transparent",
                        cursor: "pointer",
                        flexShrink: 0,
                        transition: "all 0.2s",
                      }}
                    >
                      <img src={img} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div
              style={{
                aspectRatio: "16/9",
                backgroundColor: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: "16px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                color: "#cbd5e1",
                gap: "4px",
              }}
            >
              <Package size={32} style={{ strokeWidth: 1.5 }} />
              <span style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase" }}>No images uploaded</span>
            </div>
          )}

          {/* Pricing Info */}
          <div
            style={{
              backgroundColor: "rgba(219, 234, 254, 0.3)",
              border: "1px solid #dbeafe",
              borderRadius: "16px",
              padding: "16px",
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "16px",
            }}
          >
            <div>
              <span style={{ fontSize: "9px", color: "#94a3b8", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.05em", display: "block" }}>Pricing Type</span>
              <span style={{ fontSize: "12px", fontWeight: 800, color: "#334155", textTransform: "capitalize", display: "block", marginTop: "2px" }}>
                {product.pricing_type?.replace("_", " ")}
              </span>
            </div>
            <div>
              <span style={{ fontSize: "9px", color: "#94a3b8", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.05em", display: "block" }}>Standard Rate</span>
              <span style={{ fontSize: "12px", fontWeight: 900, color: "#1d4ed8", fontFamily: "monospace", display: "block", marginTop: "2px" }}>
                ₹{(product.price_per_unit || product.price_per_sqft || 0).toLocaleString("en-IN")}
                <span style={{ fontSize: "10px", color: "#94a3b8", fontWeight: 500, fontFamily: "sans-serif" }}>
                  /{product.pricing_type === "per_sqft" ? "sqft" : "unit"}
                </span>
              </span>
            </div>
          </div>

          {/* Additional details */}
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <span style={{ fontSize: "9px", color: "#94a3b8", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.05em" }}>Product Description</span>
            <p style={{ margin: 0, fontSize: "12px", color: "#475569", lineHeight: 1.6, fontWeight: 500 }}>
              High-quality {product.name} suitable for premium indoor and outdoor signage applications. Manufactured with durable materials to ensure long-lasting visibility and brand representation.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "12px 24px",
            borderTop: "1px solid #f1f5f9",
            backgroundColor: "#f8fafc",
            display: "flex",
            justifyContent: "end",
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: "8px 16px",
              backgroundColor: "#1e293b",
              color: "white",
              border: "none",
              borderRadius: "12px",
              fontSize: "12px",
              fontWeight: 700,
              cursor: "pointer",
              transition: "background-color 0.2s",
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#0f172a"}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "#1e293b"}
          >
            Close
          </button>
        </div>
      </div>
    </div>
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
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        backdropFilter: "blur(2px)",
        zIndex: 99999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
      }}
    >
      <div
        style={{
          backgroundColor: "white",
          borderRadius: "16px",
          maxWidth: "400px",
          width: "100%",
          overflow: "hidden",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
          border: "1px solid #f1f5f9",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Header */}
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #f1f5f9", backgroundColor: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h4 style={{ margin: 0, fontSize: "14px", fontWeight: 800, color: "#0f172a", textTransform: "uppercase" }}>
              Confirm Quotation
            </h4>
            <span style={{ fontSize: "10px", color: "#64748b", fontWeight: 600 }}>
              {getSendConfirmSubtitle(status)}
            </span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "12px" }}>
          {/* Section Summaries Breakdown */}
          {sectionSummaries && sectionSummaries.length > 0 && (
            <div style={{ maxHeight: "160px", overflowY: "auto", borderBottom: "1px dashed #cbd5e1", paddingBottom: "12px", marginBottom: "4px", display: "flex", flexDirection: "column", gap: "10px" }}>
              {sectionSummaries.map((sec) => (
                <div key={sec.id} style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      <span style={{ fontSize: "12px", color: "#334155", fontWeight: 700 }}>{sec.name}</span>
                      <span style={{ fontSize: "10px", color: "#94a3b8", fontWeight: 600 }}>{sec.linesCount} line item{sec.linesCount !== 1 ? 's' : ''}</span>
                    </div>
                    <span style={{ fontSize: "12px", color: "#0f172a", fontWeight: 700 }}>
                      ₹{sec.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  {/* Detailed Lines */}
                  {sec.lines && sec.lines.length > 0 && (
                    <div style={{ paddingLeft: "8px", borderLeft: "2px solid #e2e8f0", display: "flex", flexDirection: "column", gap: "4px" }}>
                      {sec.lines.map(line => (
                        <div key={line.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontSize: "11px", color: "#64748b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "220px" }}>
                            {line.description}
                          </span>
                          <span style={{ fontSize: "11px", color: "#475569", fontWeight: 600 }}>
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
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "14px", color: "#0f172a", fontWeight: 900 }}>Grand Total</span>
            <span style={{ fontSize: "16px", color: "#2563eb", fontWeight: 900 }}>₹{grandTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: "16px 20px", borderTop: "1px solid #f1f5f9", backgroundColor: "#f8fafc", display: "flex", justifyContent: "flex-end", gap: "8px" }}>
          <button
            onClick={onClose}
            style={{ padding: "8px 16px", backgroundColor: "white", color: "#475569", border: "1px solid #cbd5e1", borderRadius: "8px", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#f1f5f9"}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "white"}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            style={{ padding: "8px 16px", backgroundColor: "#22c55e", color: "white", border: "none", borderRadius: "8px", fontSize: "12px", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#16a34a"}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "#22c55e"}
          >
            <Check size={14} /> {confirmLabel}
          </button>
        </div>
      </div>
    </div>
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
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        backdropFilter: "blur(2px)",
        zIndex: 99999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
      }}
    >
      <div
        style={{
          backgroundColor: "white",
          borderRadius: "14px",
          maxWidth: "420px",
          width: "100%",
          overflow: "hidden",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
          border: "1px solid #f1f5f9",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #f1f5f9", backgroundColor: "#f8fafc" }}>
          <h4 style={{ margin: 0, fontSize: "14px", fontWeight: 800, color: "#0f172a", textTransform: "uppercase" }}>
            {title}
          </h4>
          <p style={{ margin: "8px 0 0", fontSize: "12px", color: "#64748b", lineHeight: 1.5 }}>{description}</p>
        </div>
        <div style={{ padding: "16px 20px", borderTop: "1px solid #f1f5f9", backgroundColor: "#f8fafc", display: "flex", justifyContent: "flex-end", gap: "8px" }}>
          <button
            onClick={onClose}
            style={{ padding: "8px 16px", backgroundColor: "white", color: "#475569", border: "1px solid #cbd5e1", borderRadius: "8px", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            style={{ padding: "8px 16px", backgroundColor: mode === "override" ? "#d97706" : "#16a34a", color: "white", border: "none", borderRadius: "8px", fontSize: "12px", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}
          >
            <Check size={14} /> {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
