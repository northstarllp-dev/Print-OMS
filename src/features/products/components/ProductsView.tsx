"use client";

import React, { useState, useEffect, useTransition, useRef } from "react";
import {
  Search, Plus, X, Pencil, Trash2, Package, ToggleLeft, ToggleRight,
  Upload, Image as ImageIcon, Loader2, IndianRupee, ChevronDown, Tag, Ruler, Hash, RefreshCw, Filter
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import {
  createProduct, updateProduct, deleteProduct, deleteImagesFromStorage, 
  createProductCategory, deleteProductCategory, type Product, type CreateProductPayload, type ProductCategory,
} from "../actions/productActions";

const PRICING_TYPES = ["Per Sq.Ft", "Per Unit", "Multiple"];

function productsForTenant(existing: Product[], companyId?: string | null): Product[] {
  if (!companyId) return existing;
  return existing.filter((p) => p.company_id === companyId);
}

function generateProductId(existing: Product[], companyId?: string | null): string {
  const scoped = productsForTenant(existing, companyId);
  const maxNum = scoped.reduce((max, p) => {
    const match = p.product_id?.match(/^PRD-(\d+)$/);
    if (match) return Math.max(max, parseInt(match[1], 10));
    return max;
  }, 0);
  return `PRD-${String(maxNum + 1).padStart(3, "0")}`;
}

function generateFinalProductId(existing: Product[], companyId?: string | null): string {
  const scoped = productsForTenant(existing, companyId);
  const maxNum = scoped.reduce((max, p) => {
    const match = p.product_id?.match(/^FP(\d+)$/);
    if (match) return Math.max(max, parseInt(match[1], 10));
    return max;
  }, 0);
  return `FP${String(maxNum + 1).padStart(3, "0")}`;
}

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "9px 12px", border: "1px solid #e2e8f0",
  borderRadius: "8px", fontSize: "13px", fontFamily: "inherit",
  outline: "none", transition: "border-color 0.15s, box-shadow 0.15s", boxSizing: "border-box",
};
const labelStyle: React.CSSProperties = {
  fontSize: "11px", fontWeight: "700", color: "#374151",
  marginBottom: "4px", display: "block", textTransform: "uppercase", letterSpacing: "0.04em",
};

// ── Image Upload Component ───────────────────────────────────────────────────
function ProductImageUpload({
  images,
  onChange,
  onUpload,
  onRemove,
}: {
  images: string[];
  onChange: (imgs: string[]) => void;
  onUpload?: (urls: string[]) => void;
  onRemove?: (url: string) => void;
}) {
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true);
    const newUrls: string[] = [];
    for (const file of files) {
      const ext = file.name.split(".").pop();
      const path = `products/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("product-images")
        .upload(path, file, { cacheControl: "3600", upsert: false });
      if (upErr) {
        console.error("Storage upload error:", upErr);
        alert(`Upload failed: ${upErr.message}`);
      } else {
        const { data: urlData } = supabase.storage.from("product-images").getPublicUrl(path);
        newUrls.push(urlData.publicUrl);
      }
    }
    onChange([...images, ...newUrls]);
    if (onUpload) onUpload(newUrls);
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeImage = (idx: number) => {
    if (onRemove) onRemove(images[idx]);
    onChange(images.filter((_, i) => i !== idx));
  };

  return (
    <div>
      <label style={labelStyle}>Product Images</label>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "8px" }}>
        {images.map((url, idx) => (
          <div key={idx} style={{ position: "relative", width: 72, height: 72 }}>
            <img
              src={url} alt={`img-${idx}`}
              style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 8, border: "1px solid #e2e8f0" }}
            />
            <button
              type="button"
              onClick={() => removeImage(idx)}
              style={{
                position: "absolute", top: -6, right: -6, width: 18, height: 18,
                borderRadius: "50%", background: "#EF4444", color: "white",
                border: "none", cursor: "pointer", display: "flex", alignItems: "center",
                justifyContent: "center", fontSize: 10,
              }}
            >
              <X size={10} />
            </button>
          </div>
        ))}
        {images.length < 5 && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            style={{
              width: 72, height: 72, borderRadius: 8, border: "2px dashed #cbd5e1",
              background: "#f8fafc", cursor: "pointer", display: "flex",
              flexDirection: "column", alignItems: "center", justifyContent: "center",
              gap: 4, color: "#94a3b8", fontSize: 10, fontWeight: 600,
            }}
          >
            {uploading ? <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> : <Upload size={16} />}
            {!uploading && <span>Upload</span>}
          </button>
        )}
      </div>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp,image/gif"
        style={{ display: "none" }}
        onChange={handleFileChange}
        capture={undefined}
      />
      <p style={{ fontSize: 10, color: "#94a3b8", margin: 0 }}>
        Upload from gallery or camera · Max 5 images · JPEG / PNG / WebP
      </p>
    </div>
  );
}

function isFieldDisabled(key: string, pricingType?: string | null): boolean {
  if (!pricingType || pricingType === "Multiple") return false;
  if (pricingType === "Per Sq.Ft" && key === "price_per_sqft") return false;
  if (pricingType === "Per Unit" && key === "price_per_unit") return false;
  return true;
}

// ── Pricing Section ──────────────────────────────────────────────────────────
function PricingSection({
  form, setForm,
}: {
  form: Partial<CreateProductPayload>;
  setForm: React.Dispatch<React.SetStateAction<Partial<CreateProductPayload>>>;
}) {
  const pricingFields = [
    { key: "price_per_sqft", label: "Price / Sq.Ft", placeholder: "e.g. 120" },
    { key: "price_per_unit", label: "Price / Unit", placeholder: "e.g. 500" },
  ] as const;

  return (
    <div>
      <label style={labelStyle}>Pricing (fill whichever apply)</label>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "12px" }}>
        {pricingFields.map(({ key, label, placeholder }) => {
          const disabled = isFieldDisabled(key, form.pricing_type);
          return (
            <div key={key}>
              <label style={{ ...labelStyle, fontSize: 10, textTransform: "none" }}>{label}</label>
              <div style={{ position: "relative" }}>
                <IndianRupee size={11} style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", color: disabled ? "#cbd5e1" : "#94a3b8", pointerEvents: "none" }} />
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder={placeholder}
                  disabled={disabled}
                  value={(form as any)[key] ?? ""}
                  onChange={e => setForm(f => ({ ...f, [key]: e.target.value === "" ? null : parseFloat(e.target.value) }))}
                  style={{
                    ...inputStyle,
                    paddingLeft: 26,
                    background: disabled ? "#f8fafc" : "white",
                    color: disabled ? "#cbd5e1" : "#374151",
                    cursor: disabled ? "not-allowed" : "text",
                    borderColor: disabled ? "#f1f5f9" : "#cbd5e1"
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Product Form Modal ───────────────────────────────────────────────────────
function ProductFormModal({
  product, allProducts, categories, onClose, onSaved
}: {
  product: Product | null;
  allProducts: Product[];
  categories: ProductCategory[];
  onClose: () => void;
  onSaved: (p: Product) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const isEdit = !!product;

  const [uploadedImagesThisSession, setUploadedImagesThisSession] = useState<string[]>([]);
  const [imagesToDeleteOnSave, setImagesToDeleteOnSave] = useState<string[]>([]);

  const tenantCompanyId = product?.company_id ?? allProducts.find((p) => p.company_id)?.company_id;

  const [form, setForm] = useState<Partial<CreateProductPayload>>(() => {
    const final_prdt = product?.final_prdt ?? false;
    const defaultId = final_prdt
      ? generateFinalProductId(allProducts, tenantCompanyId)
      : generateProductId(allProducts, tenantCompanyId);
    return {
      product_id: product?.product_id ?? defaultId,
      name: product?.name ?? "",
      description: product?.description ?? "",
      category: product?.category ?? "",
      pricing_type: product?.pricing_type ? (
        product.pricing_type === "per_unit" ? "Per Unit" :
        product.pricing_type === "per_sqft" ? "Per Sq.Ft" :
        product.pricing_type === "per_running_ft" ? "Per Unit" :
        product.pricing_type
      ) : "",
      price_per_sqft: product?.price_per_sqft ?? null,
      price_per_unit: product?.price_per_unit ?? null,
      images: product?.images ?? [],
      is_active: product?.is_active ?? true,
      final_prdt,
      unit: product?.unit ?? "",
      brand: product?.brand ?? "",
      supplier_name: product?.supplier_name ?? "",
      purchase_price: product?.purchase_price ?? null,
      min_stock: product?.min_stock ?? null,
      max_stock: product?.max_stock ?? null,
      hsn_code: product?.hsn_code ?? "",
      gst_rate: product?.gst_rate ?? null,
      barcode: product?.barcode ?? "",
      track_inventory: product?.track_inventory ?? true,
    };
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!form.name?.trim()) { setError("Product name is required."); return; }
    startTransition(async () => {
      try {
        const payloadToSave = { ...form };
        if (payloadToSave.pricing_type === "Per Unit") payloadToSave.pricing_type = "per_unit";
        else if (payloadToSave.pricing_type === "Per Sq.Ft") payloadToSave.pricing_type = "per_sqft";

        if (isEdit) {
          const res = await updateProduct(product!.id, payloadToSave);
          onSaved({ ...product!, ...payloadToSave, ...(res?.[0] || {}) } as Product);
        } else {
          const res = await createProduct(payloadToSave as CreateProductPayload);
          onSaved({ ...payloadToSave, ...(res?.[0] || {}), id: res?.[0]?.id || "" } as Product);
        }
        
        if (imagesToDeleteOnSave.length > 0) {
          deleteImagesFromStorage(imagesToDeleteOnSave).catch(console.error);
        }
        onClose();
      } catch (err: any) {
        setError(err.message || "Failed to save product.");
      }
    });
  };

  const handleClose = () => {
    if (uploadedImagesThisSession.length > 0) {
      deleteImagesFromStorage(uploadedImagesThisSession).catch(console.error);
    }
    onClose();
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.55)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 16 }}>
      <div style={{ background: "white", width: "100%", maxWidth: 620, maxHeight: "90vh", overflowY: "auto", borderRadius: 16, padding: "28px 28px 24px", boxShadow: "0 24px 48px rgba(0,0,0,0.18)" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Package size={18} style={{ color: "#1e40af" }} />
            </div>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: "#0f172a", margin: 0 }}>{isEdit ? "Edit Product" : "Add Product"}</h3>
              <p style={{ fontSize: 11, color: "#64748b", margin: 0 }}>Product Master — Quotation Catalogue</p>
            </div>
          </div>
          <button onClick={handleClose} style={{ width: 32, height: 32, borderRadius: 8, background: "#f1f5f9", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <X size={14} style={{ color: "#64748b" }} />
          </button>
        </div>

        {error && <div style={{ padding: "8px 12px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, fontSize: 12, color: "#b91c1c", fontWeight: 600, marginBottom: 16 }}>{error}</div>}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Row 1: ID + Name */}
          <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: 12 }}>
            <div>
              <label style={labelStyle}>Product ID</label>
              <input type="text" readOnly value={form.product_id} style={{ ...inputStyle, background: "#f8fafc", color: "#64748b", fontFamily: "monospace", fontSize: 12 }} />
            </div>
             <div>
              <label style={{ ...labelStyle, marginBottom: "4px" }}>Product Name *</label>
              <input
                type="text" required placeholder="e.g. SS Letters 3D" autoFocus
                value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                style={inputStyle}
              />
              <div style={{ marginTop: "8px" }}>
                <label style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "11px", fontWeight: "700", color: "#374151", textTransform: "uppercase", letterSpacing: "0.04em", cursor: "pointer", userSelect: "none" }}>
                  <input
                    type="checkbox"
                    checked={form.final_prdt ?? false}
                    onChange={e => {
                      const checked = e.target.checked;
                      setForm(f => {
                        const updated = {
                          ...f,
                          final_prdt: checked,
                          product_id: isEdit ? f.product_id : (checked ? generateFinalProductId(allProducts, tenantCompanyId) : generateProductId(allProducts, tenantCompanyId))
                        };
                        return updated;
                      });
                    }}
                    style={{ cursor: "pointer" }}
                  />
                  Final Product
                </label>
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={labelStyle}>Category</label>
                <select value={form.category ?? ""} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} style={{ ...inputStyle, appearance: "none" }}>
                  <option value="">Select category...</option>
                  {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Pricing Type</label>
                <select
                  value={form.pricing_type ?? ""}
                  onChange={e => {
                    const nextPricingType = e.target.value;
                    setForm(f => {
                      const next = { ...f, pricing_type: nextPricingType };
                      if (nextPricingType === "Per Sq.Ft") {
                        next.price_per_unit = null;
                      } else if (nextPricingType === "Per Unit") {
                        next.price_per_sqft = null;
                      } else if (!nextPricingType) {
                        next.price_per_sqft = null;
                        next.price_per_unit = null;
                      }
                      return next;
                    });
                  }}
                  style={{ ...inputStyle, appearance: "none" }}
                >
                  <option value="">Select pricing type...</option>
                  {PRICING_TYPES.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
          </div>

          {/* Description */}
          <div>
            <label style={labelStyle}>Description</label>
            <textarea
              placeholder="Describe material, specifications, finish..."
              value={form.description ?? ""} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              rows={2}
              style={{ ...inputStyle, resize: "vertical", minHeight: 60 }}
            />
          </div>

          {/* Pricing Section */}
          <PricingSection form={form} setForm={setForm} />

          {/* Inventory Attributes */}
          <div style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 14, display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: "#334155", textTransform: "uppercase", letterSpacing: "0.05em" }}>Inventory Attributes</span>
              <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 700, color: "#374151", cursor: "pointer", userSelect: "none" }}>
                <input
                  type="checkbox"
                  checked={form.track_inventory ?? true}
                  onChange={e => setForm(f => ({ ...f, track_inventory: e.target.checked }))}
                  style={{ cursor: "pointer" }}
                />
                Track Inventory
              </label>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              <div>
                <label style={labelStyle}>Unit</label>
                <input type="text" placeholder="e.g. pcs, sqft, kg" value={form.unit ?? ""} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Brand</label>
                <input type="text" placeholder="Brand" value={form.brand ?? ""} onChange={e => setForm(f => ({ ...f, brand: e.target.value }))} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Supplier</label>
                <input type="text" placeholder="Supplier name" value={form.supplier_name ?? ""} onChange={e => setForm(f => ({ ...f, supplier_name: e.target.value }))} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Purchase Price (₹)</label>
                <input type="number" min={0} step="0.01" value={form.purchase_price ?? ""} onChange={e => setForm(f => ({ ...f, purchase_price: e.target.value === "" ? null : Number(e.target.value) }))} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Min Stock</label>
                <input type="number" min={0} step="0.01" value={form.min_stock ?? ""} onChange={e => setForm(f => ({ ...f, min_stock: e.target.value === "" ? null : Number(e.target.value) }))} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Max Stock</label>
                <input type="number" min={0} step="0.01" value={form.max_stock ?? ""} onChange={e => setForm(f => ({ ...f, max_stock: e.target.value === "" ? null : Number(e.target.value) }))} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>HSN Code</label>
                <input type="text" placeholder="HSN" value={form.hsn_code ?? ""} onChange={e => setForm(f => ({ ...f, hsn_code: e.target.value }))} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>GST Rate (%)</label>
                <input type="number" min={0} max={100} step="0.01" value={form.gst_rate ?? ""} onChange={e => setForm(f => ({ ...f, gst_rate: e.target.value === "" ? null : Number(e.target.value) }))} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Barcode</label>
                <input type="text" placeholder="Scan or type" value={form.barcode ?? ""} onChange={e => setForm(f => ({ ...f, barcode: e.target.value }))} style={inputStyle} />
              </div>
            </div>
          </div>

          {/* Image Upload */}
          <ProductImageUpload
            images={form.images ?? []}
            onChange={imgs => setForm(f => ({ ...f, images: imgs }))}
            onUpload={newUrls => setUploadedImagesThisSession(prev => [...prev, ...newUrls])}
            onRemove={url => {
              if (uploadedImagesThisSession.includes(url)) {
                deleteImagesFromStorage([url]).catch(console.error);
                setUploadedImagesThisSession(prev => prev.filter(u => u !== url));
              } else {
                setImagesToDeleteOnSave(prev => [...prev, url]);
              }
            }}
          />

          {/* Status */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "#f8fafc", borderRadius: 8, border: "1px solid #e2e8f0" }}>
            <button
              type="button"
              onClick={() => setForm(f => ({ ...f, is_active: !f.is_active }))}
              style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}
            >
              {form.is_active
                ? <ToggleRight size={22} style={{ color: "#16a34a" }} />
                : <ToggleLeft size={22} style={{ color: "#94a3b8" }} />}
              <span style={{ fontSize: 13, fontWeight: 700, color: form.is_active ? "#16a34a" : "#94a3b8" }}>
                {form.is_active ? "Active" : "Inactive"}
              </span>
            </button>
            <span style={{ fontSize: 11, color: "#94a3b8" }}>Active products appear in quotation builder</span>
          </div>

          {/* Actions */}
          <div style={{ display: "flex", gap: 10, paddingTop: 4 }}>
            <button type="button" onClick={handleClose} style={{ flex: 1, padding: "10px 16px", background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: 10, fontSize: 13, fontWeight: 700, color: "#64748b", cursor: "pointer" }}>
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              style={{ flex: 2, padding: "10px 16px", background: "#1e40af", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 800, color: "white", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
            >
              {isPending ? <Loader2 size={14} style={{ animation: "prt-spin 1s linear infinite" }} /> : (isEdit ? "Save Changes" : "Add Product")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Product Card ─────────────────────────────────────────────────────────────
function ProductCard({
  product, onEdit, onDelete, onToggle,
}: {
  product: Product;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
}) {
  const images = product.images || [];
  const [currentIdx, setCurrentIdx] = useState(0);

  useEffect(() => {
    if (images.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIdx((prev) => (prev + 1) % images.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [images.length]);

  const hasPricing = product.price_per_sqft || product.price_per_unit;

  return (
    <div style={{
      background: "white", border: "1px solid #e2e8f0", borderRadius: 14,
      overflow: "hidden", transition: "box-shadow 0.15s, transform 0.15s",
      display: "flex", flexDirection: "column",
    }}
      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = "0 4px 20px rgba(0,0,0,0.08)"; (e.currentTarget as HTMLDivElement).style.transform = "translateY(-1px)"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = "none"; (e.currentTarget as HTMLDivElement).style.transform = "none"; }}
    >
      {/* Image or placeholder */}
      <div style={{ height: 120, background: images.length ? "transparent" : "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center", borderBottom: "1px solid #f1f5f9", position: "relative", overflow: "hidden" }}>
        {images.length > 0 ? (
          images.map((url, idx) => (
            <img
              key={url}
              src={url}
              alt={`${product.name}-${idx}`}
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "cover",
                opacity: idx === currentIdx ? 1 : 0,
                transition: "opacity 0.6s ease-in-out",
              }}
            />
          ))
        ) : (
          <Package size={32} style={{ color: "#cbd5e1" }} />
        )}

        {/* Carousel Dots */}
        {images.length > 1 && (
          <div style={{ position: "absolute", bottom: 8, left: "50%", transform: "translateX(-50%)", display: "flex", gap: 4, zIndex: 10 }}>
            {images.map((_, idx) => (
              <div
                key={idx}
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: "50%",
                  background: idx === currentIdx ? "white" : "rgba(255,255,255,0.4)",
                  transition: "background 0.3s",
                }}
              />
            ))}
          </div>
        )}

        {/* Image count badge */}
        {images.length > 1 && (
          <div style={{ position: "absolute", top: 8, right: 8, background: "rgba(0,0,0,0.6)", color: "white", borderRadius: 6, padding: "2px 7px", fontSize: 10, fontWeight: 700, zIndex: 10 }}>
            +{images.length - 1}
          </div>
        )}
        {/* Status badge */}
        <div style={{
          position: "absolute", top: 8, left: 8,
          padding: "3px 8px", borderRadius: 6, fontSize: 9, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em",
          background: product.is_active ? "#dcfce7" : "#fee2e2",
          color: product.is_active ? "#16a34a" : "#dc2626",
          border: `1px solid ${product.is_active ? "#bbf7d0" : "#fecaca"}`,
          zIndex: 10,
        }}>
          {product.is_active ? "Active" : "Inactive"}
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "14px 14px 12px", flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#0f172a", lineHeight: 1.3 }}>{product.name}</div>
            {product.category && <div style={{ fontSize: 10, color: "#64748b", fontWeight: 600, marginTop: 2 }}>{product.category}</div>}
          </div>
          <span style={{ fontSize: 9, fontWeight: 700, color: "#94a3b8", fontFamily: "monospace", flexShrink: 0 }}>{product.product_id}</span>
        </div>

        {product.pricing_type && (
          <span style={{ display: "inline-block", padding: "2px 8px", background: "#eff6ff", color: "#1e40af", borderRadius: 5, fontSize: 10, fontWeight: 700, border: "1px solid #bfdbfe" }}>
            {product.pricing_type === "per_unit" || product.pricing_type === "per_running_ft"
              ? "Per Unit"
              : product.pricing_type === "per_sqft"
                ? "Per Sq.Ft"
                : product.pricing_type}
          </span>
        )}

        {/* Pricing display */}
        {hasPricing && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 8px", marginTop: 2 }}>
            {product.price_per_sqft && <span style={{ fontSize: 11, fontWeight: 700, color: "#0f172a" }}>₹{Number(product.price_per_sqft).toLocaleString("en-IN")}<span style={{ fontWeight: 500, color: "#64748b", fontSize: 9 }}>/sqft</span></span>}
            {product.price_per_unit && <span style={{ fontSize: 11, fontWeight: 700, color: "#0f172a" }}>₹{Number(product.price_per_unit).toLocaleString("en-IN")}<span style={{ fontWeight: 500, color: "#64748b", fontSize: 9 }}>/unit</span></span>}
          </div>
        )}

        {product.description && (
          <p style={{ fontSize: 11, color: "#64748b", margin: 0, lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
            {product.description}
          </p>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: 6, padding: "10px 14px", borderTop: "1px solid #f1f5f9" }}>
        <button
          onClick={onToggle}
          title={product.is_active ? "Deactivate" : "Activate"}
          style={{ flex: 1, padding: "7px", borderRadius: 8, border: "1px solid #e2e8f0", background: "#f8fafc", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          {product.is_active ? <ToggleRight size={15} style={{ color: "#16a34a" }} /> : <ToggleLeft size={15} style={{ color: "#94a3b8" }} />}
        </button>
        <button onClick={onEdit} style={{ flex: 3, padding: "7px 10px", borderRadius: 8, border: "1px solid #e2e8f0", background: "#f8fafc", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontSize: 12, fontWeight: 700, color: "#374151" }}>
          <Pencil size={12} /> Edit
        </button>
        <button onClick={onDelete} style={{ flex: 2, padding: "7px 10px", borderRadius: 8, border: "1px solid #fecaca", background: "#fff5f5", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontSize: 12, fontWeight: 700, color: "#dc2626" }}>
          <Trash2 size={12} /> Delete
        </button>
      </div>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────
export function ProductsView({
  initialProducts,
  initialCategories = [],
}: {
  initialProducts: Product[];
  initialCategories?: ProductCategory[];
}) {
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [categories, setCategories] = useState<ProductCategory[]>(initialCategories);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState<"All" | "Active" | "Inactive">("All");
  const [finalFilter, setFinalFilter] = useState<"All" | "Final" | "Regular">("All");
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showManageCategories, setShowManageCategories] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isPending, startTransition] = useTransition();
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [pageError, setPageError] = useState("");

  const uniqueCategories = ["All", ...categories.map(c => c.name)];

  const filtered = products.filter(p => {
    const matchSearch = !search.trim() || p.name.toLowerCase().includes(search.toLowerCase()) || p.product_id?.toLowerCase().includes(search.toLowerCase()) || (p.category || "").toLowerCase().includes(search.toLowerCase());
    const matchCategory = categoryFilter === "All" || p.category === categoryFilter;
    const matchStatus = statusFilter === "All" || (statusFilter === "Active" ? p.is_active : !p.is_active);
    const matchFinal = finalFilter === "All" || (finalFilter === "Final" ? p.final_prdt === true : !p.final_prdt);
    return matchSearch && matchCategory && matchStatus && matchFinal;
  });

  const handleOpenAdd = () => { setEditingProduct(null); setShowForm(true); setPageError(""); };
  const handleOpenEdit = (p: Product) => { setEditingProduct(p); setShowForm(true); setPageError(""); };

  const handleDelete = (id: string) => {
    setPageError("");
    startTransition(async () => {
      try {
        await deleteProduct(id);
        setProducts(prev => prev.filter(p => p.id !== id));
        setDeleteConfirm(null);
      } catch (err: any) {
        setPageError(err.message || "Failed to delete product. It might be in use.");
        setDeleteConfirm(null);
      }
    });
  };

  const handleToggle = (product: Product) => {
    setPageError("");
    startTransition(async () => {
      try {
        await updateProduct(product.id, { is_active: !product.is_active });
        setProducts(prev => prev.map(p => p.id === product.id ? { ...p, is_active: !p.is_active } : p));
      } catch (err: any) {
        setPageError(err.message || "Failed to update status.");
      }
    });
  };

  const handleSaved = (saved: Product) => {
    setProducts(prev => {
      const idx = prev.findIndex(p => p.id === saved.id);
      if (idx >= 0) { const next = [...prev]; next[idx] = saved; return next; }
      return [saved, ...prev];
    });
  };

  const activeCount = products.filter(p => p.is_active).length;

  const resetFilters = () => {
    setSearch("");
    setCategoryFilter("All");
    setStatusFilter("All");
    setFinalFilter("All");
  };

  const activeFilterCount = [
    categoryFilter !== "All",
    statusFilter !== "All",
    finalFilter !== "All",
  ].filter(Boolean).length;

  return (
    <div className="p-3 sm:p-4 md:p-8 min-h-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-5 md:mb-6">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl md:text-[26px] font-black text-slate-900 m-0 tracking-tight">Product Master</h1>
          <p className="text-xs sm:text-[13px] text-slate-500 mt-1 m-0 font-medium">
            Catalogue of signage materials & components for quotation building.
            <span className="ml-2 font-bold text-[#1e40af]">{activeCount} active</span>
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-2.5 w-full sm:w-auto">
          <button
            onClick={() => setShowManageCategories(true)}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white text-[#1e40af] border border-[#1e40af] rounded-[10px] text-[13px] font-extrabold"
          >
            <Tag size={16} /> Manage Categories
          </button>
          <button
            onClick={handleOpenAdd}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#1e40af] text-white rounded-[10px] text-[13px] font-extrabold"
          >
            <Plus size={16} /> Add Product
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 mb-5 md:mb-[22px]">
        {[
          { label: "Total Products", value: products.length, color: "#1e40af", bg: "#eff6ff" },
          { label: "Active", value: activeCount, color: "#16a34a", bg: "#f0fdf4" },
          { label: "Inactive", value: products.length - activeCount, color: "#dc2626", bg: "#fef2f2" },
        ].map(stat => (
          <div key={stat.label} style={{ padding: "14px 18px", background: stat.bg, borderRadius: 12, border: `1px solid ${stat.bg}` }}>
            <div style={{ fontSize: 22, fontWeight: 900, color: stat.color }}>{stat.value}</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: stat.color, opacity: 0.75, textTransform: "uppercase", letterSpacing: "0.04em" }}>{stat.label}</div>
          </div>
        ))}
      </div>

      {pageError && (
        <div style={{ padding: "10px 14px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, fontSize: 13, color: "#b91c1c", fontWeight: 600, marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          {pageError}
          <button onClick={() => setPageError("")} style={{ background: "none", border: "none", color: "#b91c1c", cursor: "pointer" }}><X size={14} /></button>
        </div>
      )}

      {/* Search + Filters */}
      <div className="mb-5 md:mb-[22px]">
        {/* Mobile / tablet: search + Filters + Reset */}
        <div className="lg:hidden flex items-center gap-2">
          <div className="relative flex-1 min-w-0">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search products..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ ...inputStyle, paddingLeft: 36, height: 40, borderRadius: 9999, background: "#f8fafc" }}
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
              >
                <X size={14} />
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => setMobileFiltersOpen(true)}
            className={`relative shrink-0 inline-flex items-center gap-1.5 h-10 px-3.5 rounded-full border text-[12px] font-bold transition-colors ${
              activeFilterCount > 0
                ? "bg-slate-900 text-white border-slate-900"
                : "bg-white text-slate-700 border-slate-200"
            }`}
          >
            <Filter size={14} />
            Filters
            {activeFilterCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[var(--color-primary)] text-white text-[10px] font-extrabold flex items-center justify-center border-2 border-white">
                {activeFilterCount}
              </span>
            )}
          </button>
          <button
            type="button"
            title="Reset filters"
            onClick={resetFilters}
            className="shrink-0 w-10 h-10 inline-flex items-center justify-center rounded-full bg-red-50 border border-red-200 text-red-600"
          >
            <RefreshCw size={14} />
          </button>
        </div>

        {mobileFiltersOpen && (
          <div className="lg:hidden fixed inset-0 z-[80]">
            <button
              type="button"
              aria-label="Close filters"
              className="absolute inset-0 bg-slate-900/40"
              onClick={() => setMobileFiltersOpen(false)}
            />
            <div className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-2xl bg-white shadow-xl">
              <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-white rounded-t-2xl">
                <h3 className="text-sm font-extrabold text-slate-900">Filters</h3>
                <button
                  type="button"
                  onClick={() => setMobileFiltersOpen(false)}
                  className="w-8 h-8 inline-flex items-center justify-center rounded-full bg-slate-100 text-slate-500"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="p-4 space-y-4">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Category</label>
                  <select
                    value={categoryFilter}
                    onChange={e => setCategoryFilter(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-medium text-slate-700"
                  >
                    {uniqueCategories.map(c => <option key={c} value={c}>{c === "All" ? "All Categories" : c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Status</label>
                  <select
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value as any)}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-medium text-slate-700"
                  >
                    <option value="All">All Status</option>
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Type</label>
                  <select
                    value={finalFilter}
                    onChange={e => setFinalFilter(e.target.value as any)}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-medium text-slate-700"
                  >
                    <option value="All">All Types</option>
                    <option value="Final">Final Products</option>
                    <option value="Regular">Regular Products</option>
                  </select>
                </div>
              </div>
              <div className="sticky bottom-0 flex gap-2 px-4 py-3 border-t border-slate-100 bg-white pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                <button
                  type="button"
                  onClick={resetFilters}
                  className="flex-1 h-10 inline-flex items-center justify-center gap-1.5 rounded-xl bg-red-50 border border-red-200 text-red-600 text-[13px] font-bold"
                >
                  <RefreshCw size={14} /> Reset
                </button>
                <button
                  type="button"
                  onClick={() => setMobileFiltersOpen(false)}
                  className="flex-1 h-10 inline-flex items-center justify-center rounded-xl bg-slate-900 text-white text-[13px] font-bold"
                >
                  Apply
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Desktop: inline filters */}
        <div className="hidden lg:flex flex-row gap-3 items-center flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text" placeholder="Search products..."
              value={search} onChange={e => setSearch(e.target.value)}
              style={{ ...inputStyle, paddingLeft: 36, height: 40 }}
            />
          </div>
          <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} style={{ ...inputStyle, width: "auto", height: 40, paddingRight: 28 }}>
            {uniqueCategories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)} style={{ ...inputStyle, width: "auto", height: 40 }}>
            <option value="All">All Status</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
          <select value={finalFilter} onChange={e => setFinalFilter(e.target.value as any)} style={{ ...inputStyle, width: "auto", height: 40 }}>
            <option value="All">All Types</option>
            <option value="Final">Final Products</option>
            <option value="Regular">Regular Products</option>
          </select>
          <button
            title="Reset Filters"
            onClick={resetFilters}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "0 14px",
              background: "#fef2f2",
              border: "1px solid #fecaca",
              borderRadius: "8px",
              cursor: "pointer",
              color: "#dc2626",
              outline: "none",
              height: "40px",
              transition: "all 0.2s",
              fontWeight: "600",
              fontSize: "13px",
              gap: "6px",
              flexShrink: 0
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "#fee2e2"; e.currentTarget.style.borderColor = "#fca5a5"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "#fef2f2"; e.currentTarget.style.borderColor = "#fecaca"; }}
          >
            <RefreshCw size={14} />
            Reset
          </button>
        </div>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div style={{ padding: "60px 20px", textAlign: "center" }}>
          <Package size={40} style={{ color: "#cbd5e1", margin: "0 auto 12px" }} />
          <p style={{ fontSize: 14, fontWeight: 600, color: "#94a3b8" }}>No products found.</p>
          <button onClick={handleOpenAdd} style={{ marginTop: 12, padding: "8px 20px", background: "#1e40af", color: "white", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
            Add First Product
          </button>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 260px), 1fr))", gap: 16 }}>
          {filtered.map(p => (
            <ProductCard
              key={p.id}
              product={p}
              onEdit={() => handleOpenEdit(p)}
              onDelete={() => setDeleteConfirm(p.id)}
              onToggle={() => handleToggle(p)}
            />
          ))}
        </div>
      )}

      {/* Delete Confirm */}
      {deleteConfirm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.5)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 110 }}>
          <div style={{ background: "white", borderRadius: 14, padding: 28, maxWidth: 340, width: "100%", boxShadow: "0 20px 40px rgba(0,0,0,0.15)" }}>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: "#0f172a", margin: "0 0 8px" }}>Delete Product?</h3>
            <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 20px" }}>This product will be permanently removed from the catalogue.</p>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setDeleteConfirm(null)} style={{ flex: 1, padding: "9px", borderRadius: 8, border: "1px solid #e2e8f0", background: "#f8fafc", fontSize: 13, fontWeight: 700, color: "#475569", cursor: "pointer" }}>Cancel</button>
              <button onClick={() => handleDelete(deleteConfirm)} disabled={isPending} style={{ flex: 1, padding: "9px", borderRadius: 8, border: "none", background: "#dc2626", color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                {isPending ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <ProductFormModal
          product={editingProduct}
          allProducts={products}
          categories={categories}
          onClose={() => { setEditingProduct(null); setShowForm(false); }}
          onSaved={handleSaved}
        />
      )}

      {/* Manage Categories Modal */}
      {showManageCategories && (
        <ManageCategoriesModal
          categories={categories}
          onClose={() => setShowManageCategories(false)}
          onAdded={(newCat) => {
            setCategories(prev => [...prev, newCat].sort((a, b) => a.name.localeCompare(b.name)));
          }}
          onDeleted={(id) => {
            setCategories(prev => prev.filter(c => c.id !== id));
            // Update products that had this category? (Optional, just clear it locally or let it be)
            setProducts(prev => prev.map(p => {
              const catName = categories.find(c => c.id === id)?.name;
              if (p.category === catName) return { ...p, category: "" };
              return p;
            }));
          }}
        />
      )}
    </div>
  );
}

// ── Manage Categories Modal Component ─────────────────────────────────────────
function ManageCategoriesModal({
  categories,
  onClose,
  onAdded,
  onDeleted,
}: {
  categories: ProductCategory[];
  onClose: () => void;
  onAdded: (cat: ProductCategory) => void;
  onDeleted: (id: string) => void;
}) {
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!name.trim()) return;
    startTransition(async () => {
      try {
        const res = await createProductCategory(name);
        onAdded(res);
        setName("");
      } catch (err: any) {
        setError(err.message || "Failed to create category.");
      }
    });
  };

  const handleDelete = (id: string) => {
    startTransition(async () => {
      try {
        await deleteProductCategory(id);
        onDeleted(id);
      } catch (err: any) {
        setError(err.message || "Failed to delete category.");
      }
    });
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.55)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 110, padding: 16 }}>
      <div style={{ background: "white", borderRadius: 14, padding: 24, maxWidth: 360, width: "100%", maxHeight: "80vh", display: "flex", flexDirection: "column", boxShadow: "0 20px 40px rgba(0,0,0,0.15)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: "#0f172a", margin: "0 0 4px" }}>Manage Categories</h3>
            <p style={{ fontSize: 11, color: "#64748b", margin: 0 }}>Create or remove custom categories.</p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b" }}><X size={16} /></button>
        </div>
        
        {error && <div style={{ padding: "8px 12px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, fontSize: 12, color: "#b91c1c", fontWeight: 600, marginBottom: 12 }}>{error}</div>}
        
        <form onSubmit={handleSubmit} style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <input
            type="text" required placeholder="New category name..."
            value={name} onChange={e => setName(e.target.value)}
            style={{ ...inputStyle, flex: 1 }}
          />
          <button type="submit" disabled={isPending} style={{ padding: "0 14px", borderRadius: 8, border: "none", background: "#1e40af", color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
            {isPending ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : "Add"}
          </button>
        </form>

        <div style={{ flex: 1, overflowY: "auto", borderTop: "1px solid #f1f5f9", paddingTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
          {categories.length === 0 ? (
            <div style={{ textAlign: "center", padding: "20px", color: "#94a3b8", fontSize: 13 }}>No categories found.</div>
          ) : (
            categories.map(cat => (
              <div key={cat.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", background: "#f8fafc", borderRadius: 8, border: "1px solid #e2e8f0" }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>{cat.name}</span>
                <button
                  onClick={() => handleDelete(cat.id)}
                  disabled={isPending}
                  title="Delete Category"
                  style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", padding: 4 }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
