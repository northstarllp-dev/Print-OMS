"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { Save, Palette, MessageCircle, Calendar, Key, X, FileText, CheckSquare, Plus, Trash2, GripVertical } from "lucide-react";
import {
  updateAppSettings,
  updateInvoiceProfile,
  updateInvoiceNumbering,
  updateCompanyDetails,
} from "@/features/settings/actions/settingsActions";
import type { AppSettings, CompanyDetails } from "@/features/settings/settingsTypes";
import { updateUserPassword } from "@/features/auth/actions/authActions";
import {
  EMPTY_INVOICE_PROFILE,
  type InvoiceProfile,
  type InvoiceTaxSplit,
} from "@/features/quotations/types/invoiceProfile";
import {
  EMPTY_INVOICE_NUMBERING,
  previewInvoiceNumber,
  type InvoiceNumberingConfig,
  type InvoiceNumberReset,
  type InvoiceYearPart,
} from "@/features/invoices/types/invoiceNumbering";
import {
  createProductionChecklistItemId,
  normalizeProductionChecklistItems,
  type ProductionChecklistItem,
} from "@/features/settings/productionChecklist";

const SettingsAddressInput = dynamic(
  () =>
    import("@/features/settings/components/SettingsAddressInput").then(
      (m) => m.SettingsAddressInput
    ),
  { ssr: false }
);

interface SettingsViewNewProps {
  initialAppSettings?: AppSettings;
  companyDetails?: CompanyDetails | null;
}

export function SettingsViewNew({ initialAppSettings, companyDetails }: SettingsViewNewProps) {
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [invoiceSaveStatus, setInvoiceSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [isDirty, setIsDirty] = useState(false);
  
  const defaultSettings = {
    companyName: companyDetails?.name || "Printoms",
    address: companyDetails?.address || "123 Business Park, Tech City",
    googleReviewLink: initialAppSettings?.googleReviewLink ?? "",
    notifications: true,
    twoFactorAuth: true,
    theme: "light",
    siteVisitSchedulingEnabled: initialAppSettings?.siteVisitSchedulingEnabled ?? true,
    installationSchedulingEnabled: initialAppSettings?.installationSchedulingEnabled ?? true,
  };
  
  const [settings, setSettings] = useState(defaultSettings);
  const [initialSettings, setInitialSettings] = useState(defaultSettings);

  const [invoiceProfile, setInvoiceProfile] = useState<InvoiceProfile>(
    initialAppSettings?.invoiceProfile ?? EMPTY_INVOICE_PROFILE
  );
  const [invoiceNumbering, setInvoiceNumbering] = useState<InvoiceNumberingConfig>(
    initialAppSettings?.invoiceNumbering ?? EMPTY_INVOICE_NUMBERING
  );
  const [numberingSaveStatus, setNumberingSaveStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");

  const initialChecklist = useMemo(
    () => normalizeProductionChecklistItems(initialAppSettings?.productionChecklistItems),
    [initialAppSettings?.productionChecklistItems]
  );
  const [checklistItems, setChecklistItems] = useState<ProductionChecklistItem[]>(initialChecklist);
  const [initialChecklistItems, setInitialChecklistItems] = useState<ProductionChecklistItem[]>(initialChecklist);

  const hasUnsavedChanges = isDirty;

  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordStatus, setPasswordStatus] = useState<"idle" | "saving" | "error" | "success">("idle");
  const [passwordErrorMsg, setPasswordErrorMsg] = useState("");

  const markDirty = () => setIsDirty(true);

  const handleChange = (key: string, value: any) => {
    markDirty();
    setSettings({ ...settings, [key]: value });
  };

  const sections = [
    {
      title: "General Settings",
      icon: <Palette size={20} />,
      description: "Manage your business information and preferences",
      fields: [
        { label: "Company Name", key: "companyName", type: "text" },
        { label: "Business Address", key: "address", type: "text" },
        {
          label: "Google Review Link",
          key: "googleReviewLink",
          type: "url",
          description:
            "Used in the post-installation feedback WhatsApp/email message instead of the customer portal.",
        },
      ],
    },
    {
      title: "Customer Portal",
      icon: <Calendar size={20} />,
      description: "Control what customers can do in their portal",
      fields: [
        { label: "Site Visit Self-Scheduling", key: "siteVisitSchedulingEnabled", type: "toggle", description: "Allow customers to independently book their site visit slots through the portal." },
        { label: "Installation Self-Scheduling", key: "installationSchedulingEnabled", type: "toggle", description: "Allow customers to independently book their installation slots through the portal." },
      ],
    },
  ];

  const setInvoiceField = (key: keyof InvoiceProfile, value: string) => {
    setInvoiceProfile((prev) => ({ ...prev, [key]: value }));
  };

  const setBankField = (key: keyof NonNullable<InvoiceProfile["bank"]>, value: string) => {
    setInvoiceProfile((prev) => ({
      ...prev,
      bank: { ...(prev.bank || {}), [key]: value },
    }));
  };

  const handleSaveInvoiceProfile = async () => {
    setInvoiceSaveStatus("saving");
    try {
      await updateInvoiceProfile(invoiceProfile);
      setInvoiceSaveStatus("saved");
      setTimeout(() => setInvoiceSaveStatus("idle"), 2500);
    } catch (e) {
      console.error("Failed to save invoice profile", e);
      setInvoiceSaveStatus("error");
      setTimeout(() => setInvoiceSaveStatus("idle"), 3000);
    }
  };

  const setNumberingField = <K extends keyof InvoiceNumberingConfig>(
    key: K,
    value: InvoiceNumberingConfig[K]
  ) => {
    setInvoiceNumbering((prev) => ({ ...prev, [key]: value }));
  };

  const handleSaveInvoiceNumbering = async () => {
    setNumberingSaveStatus("saving");
    try {
      await updateInvoiceNumbering(invoiceNumbering);
      setNumberingSaveStatus("saved");
      setTimeout(() => setNumberingSaveStatus("idle"), 2500);
    } catch (e) {
      console.error("Failed to save invoice numbering", e);
      setNumberingSaveStatus("error");
      setTimeout(() => setNumberingSaveStatus("idle"), 3000);
    }
  };

  const numberingPreview = previewInvoiceNumber(invoiceNumbering);

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px 12px",
    border: "1px solid #e2e8f0",
    borderRadius: "8px",
    fontSize: "13px",
    fontFamily: "inherit",
  };

  const labelStyle: React.CSSProperties = {
    fontSize: "13px",
    fontWeight: 600,
    color: "#0f172a",
    marginBottom: "6px",
    display: "block",
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setPasswordStatus("error");
      setPasswordErrorMsg("Passwords do not match");
      return;
    }
    if (newPassword.length < 6) {
      setPasswordStatus("error");
      setPasswordErrorMsg("Password must be at least 6 characters");
      return;
    }
    
    setPasswordStatus("saving");
    try {
      const res = await updateUserPassword(newPassword);
      if (res.error) {
        setPasswordStatus("error");
        setPasswordErrorMsg(res.error);
      } else {
        setPasswordStatus("success");
        setTimeout(() => {
          setIsPasswordModalOpen(false);
          setNewPassword("");
          setConfirmPassword("");
          setPasswordStatus("idle");
        }, 1500);
      }
    } catch (err: any) {
      setPasswordStatus("error");
      setPasswordErrorMsg(err.message || "An error occurred");
    }
  };

  const updateChecklistItem = (
    index: number,
    patch: Partial<ProductionChecklistItem>
  ) => {
    markDirty();
    setChecklistItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, ...patch } : item))
    );
  };

  const addChecklistItem = () => {
    markDirty();
    const label = `New step ${checklistItems.length + 1}`;
    const id = createProductionChecklistItemId(
      label,
      checklistItems.map((item) => item.id)
    );
    setChecklistItems((prev) => [
      ...prev,
      { id, label, description: "" },
    ]);
  };

  const removeChecklistItem = (index: number) => {
    if (checklistItems.length <= 1) return;
    markDirty();
    setChecklistItems((prev) => prev.filter((_, i) => i !== index));
  };

  const moveChecklistItem = (index: number, direction: -1 | 1) => {
    const next = index + direction;
    if (next < 0 || next >= checklistItems.length) return;
    markDirty();
    setChecklistItems((prev) => {
      const copy = [...prev];
      const [item] = copy.splice(index, 1);
      copy.splice(next, 0, item);
      return copy;
    });
  };

  const persistSettings = async () => {
    setSaveStatus("saving");
    try {
      await Promise.all([
        updateCompanyDetails(settings.companyName, settings.address),
        updateAppSettings({
          siteVisitSchedulingEnabled: settings.siteVisitSchedulingEnabled,
          installationSchedulingEnabled: settings.installationSchedulingEnabled,
          googleReviewLink: settings.googleReviewLink,
          productionChecklistItems: checklistItems,
        }),
      ]);
      setInitialSettings(settings);
      setInitialChecklistItems(checklistItems);
      setIsDirty(false);
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 3000);
    } catch (err) {
      console.error(err);
      setSaveStatus("idle");
    }
  };

  return (
    <div className="p-3 sm:p-4 md:p-8 bg-slate-50 min-h-0 pb-[120px]">
      <div style={{ maxWidth: "900px", margin: "0 auto" }}>
        {/* Header */}
        <div className="mb-5 md:mb-8">
          <h1 className="text-xl sm:text-2xl md:text-[28px] font-extrabold text-slate-900 m-0 mb-1 md:mb-2">
            Settings
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 m-0">
            Configure your account settings and preferences
          </p>
        </div>

        <Link
          href="/admin/settings/notifications"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "white",
            border: "1px solid #e2e8f0",
            borderRadius: "12px",
            padding: "20px 24px",
            marginBottom: "20px",
            textDecoration: "none",
            color: "inherit",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div
              style={{
                width: "40px",
                height: "40px",
                background: "#dcfce7",
                borderRadius: "8px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#16a34a",
              }}
            >
              <MessageCircle size={20} />
            </div>
            <div>
              <div style={{ fontSize: "16px", fontWeight: 700, color: "#0f172a" }}>WhatsApp API Test</div>
              <div style={{ fontSize: "13px", color: "#64748b" }}>
                Send hello_world to verify Meta credentials
              </div>
            </div>
          </div>
          <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--color-primary)" }}>Open →</span>
        </Link>

        {/* Settings Sections */}
        {sections.map((section, idx) => (
          <div
            key={idx}
            style={{
              background: "white",
              border: "1px solid #e2e8f0",
              borderRadius: "12px",
              padding: "24px",
              marginBottom: "20px",
            }}
          >
            {/* Section Header */}
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px", paddingBottom: "16px", borderBottom: "1px solid #e2e8f0" }}>
              <div style={{ width: "40px", height: "40px", background: "#f1f5f9", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-primary)" }}>
                {section.icon}
              </div>
              <div>
                <div style={{ fontSize: "16px", fontWeight: "700", color: "#0f172a" }}>
                  {section.title}
                </div>
                <div style={{ fontSize: "12px", color: "#64748b", marginTop: "2px" }}>
                  {section.description}
                </div>
              </div>
            </div>

            {/* Fields */}
            <div style={{ display: "grid", gap: "16px" }}>
              {section.fields.map((field) => (
                <div key={field.key}>
                  <label style={{ fontSize: "13px", fontWeight: "600", color: "#0f172a", marginBottom: "description" in field && field.description ? "4px" : "6px", display: "block" }}>
                    {field.label}
                  </label>
                  {"description" in field && field.description && (
                    <div style={{ fontSize: "12px", color: "#64748b", marginBottom: "10px", lineHeight: "1.4", maxWidth: "600px" }}>
                      {field.description}
                    </div>
                  )}
                  {field.type === "toggle" ? (
                    <button
                      onClick={() => handleChange(field.key, !settings[field.key as keyof typeof settings])}
                      style={{
                        position: "relative",
                        width: "48px",
                        height: "26px",
                        background: settings[field.key as keyof typeof settings] ? "var(--color-primary)" : "#cbd5e1",
                        border: "none",
                        borderRadius: "9999px",
                        cursor: "pointer",
                        transition: "background 0.3s ease",
                        padding: 0,
                        outline: "none",
                        display: "flex",
                        alignItems: "center"
                      }}
                    >
                      <div
                        style={{
                          position: "absolute",
                          left: settings[field.key as keyof typeof settings] ? "24px" : "2px",
                          width: "22px",
                          height: "22px",
                          background: "white",
                          borderRadius: "50%",
                          transition: "left 0.3s cubic-bezier(0.4, 0.0, 0.2, 1)",
                          boxShadow: "0 1px 3px rgba(0,0,0,0.15), 0 1px 2px rgba(0,0,0,0.1)"
                        }}
                      />
                    </button>
                  ) : field.key === "address" ? (
                    <SettingsAddressInput
                      value={settings.address}
                      onChange={(value) => handleChange("address", value)}
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        border: "1px solid #e2e8f0",
                        borderRadius: "8px",
                        fontSize: "13px",
                        fontFamily: "inherit",
                        transition: "all 0.2s",
                      }}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = "#94a3b8";
                        e.currentTarget.style.boxShadow = "0 0 0 3px rgba(148, 163, 184, 0.1)";
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = "#e2e8f0";
                        e.currentTarget.style.boxShadow = "none";
                      }}
                    />
                  ) : (
                    <input
                      type={field.type}
                      value={settings[field.key as keyof typeof settings] as string}
                      onChange={(e) => handleChange(field.key, e.target.value)}
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        border: "1px solid #e2e8f0",
                        borderRadius: "8px",
                        fontSize: "13px",
                        fontFamily: "inherit",
                        transition: "all 0.2s",
                      }}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = "#94a3b8";
                        e.currentTarget.style.boxShadow = "0 0 0 3px rgba(148, 163, 184, 0.1)";
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = "#e2e8f0";
                        e.currentTarget.style.boxShadow = "none";
                      }}
                    />
                  )}
                </div>
              ))}
            </div>

          </div>
        ))}

        {/* Workshop production checklist */}
        <div
          style={{
            background: "white",
            border: "1px solid #e2e8f0",
            borderRadius: "12px",
            padding: "24px",
            marginBottom: "20px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", marginBottom: "20px", paddingBottom: "16px", borderBottom: "1px solid #e2e8f0" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div style={{ width: "40px", height: "40px", background: "#eff6ff", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", color: "#2563eb" }}>
                <CheckSquare size={20} />
              </div>
              <div>
                <div style={{ fontSize: "16px", fontWeight: "700", color: "#0f172a" }}>
                  Workshop Production Checklist
                </div>
                <div style={{ fontSize: "12px", color: "#64748b", marginTop: "2px" }}>
                  Customize fabrication milestones shown on the Production stage
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={addChecklistItem}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "8px 12px",
                borderRadius: "8px",
                border: "1px solid #bfdbfe",
                background: "#eff6ff",
                color: "#1d4ed8",
                fontSize: "12px",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              <Plus size={14} /> Add step
            </button>
          </div>

          <div style={{ display: "grid", gap: "12px" }}>
            {checklistItems.map((item, index) => (
              <div
                key={item.id}
                style={{
                  border: "1px solid #e2e8f0",
                  borderRadius: "10px",
                  padding: "14px",
                  background: "#f8fafc",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", marginBottom: "10px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#64748b", fontSize: "12px", fontWeight: 700 }}>
                    <GripVertical size={14} />
                    Step {index + 1}
                  </div>
                  <div style={{ display: "flex", gap: "6px" }}>
                    <button
                      type="button"
                      onClick={() => moveChecklistItem(index, -1)}
                      disabled={index === 0}
                      style={{ padding: "4px 8px", fontSize: "11px", fontWeight: 700, borderRadius: "6px", border: "1px solid #e2e8f0", background: "white", cursor: index === 0 ? "not-allowed" : "pointer", opacity: index === 0 ? 0.5 : 1 }}
                    >
                      Up
                    </button>
                    <button
                      type="button"
                      onClick={() => moveChecklistItem(index, 1)}
                      disabled={index === checklistItems.length - 1}
                      style={{ padding: "4px 8px", fontSize: "11px", fontWeight: 700, borderRadius: "6px", border: "1px solid #e2e8f0", background: "white", cursor: index === checklistItems.length - 1 ? "not-allowed" : "pointer", opacity: index === checklistItems.length - 1 ? 0.5 : 1 }}
                    >
                      Down
                    </button>
                    <button
                      type="button"
                      onClick={() => removeChecklistItem(index)}
                      disabled={checklistItems.length <= 1}
                      style={{ padding: "4px 8px", borderRadius: "6px", border: "1px solid #fecaca", background: "#fef2f2", color: "#dc2626", cursor: checklistItems.length <= 1 ? "not-allowed" : "pointer", opacity: checklistItems.length <= 1 ? 0.5 : 1 }}
                      title="Remove step"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
                <div style={{ display: "grid", gap: "10px" }}>
                  <div>
                    <label style={labelStyle}>Title</label>
                    <input
                      style={inputStyle}
                      value={item.label}
                      onChange={(e) => updateChecklistItem(index, { label: e.target.value })}
                      placeholder="e.g. Quality Check"
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Description</label>
                    <input
                      style={inputStyle}
                      value={item.description}
                      onChange={(e) => updateChecklistItem(index, { description: e.target.value })}
                      placeholder="Short helper text for the workshop team"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Invoice / Quotation letterhead */}
        <div
          style={{
            background: "white",
            border: "1px solid #e2e8f0",
            borderRadius: "12px",
            padding: "24px",
            marginBottom: "20px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px", paddingBottom: "16px", borderBottom: "1px solid #e2e8f0" }}>
            <div style={{ width: "40px", height: "40px", background: "#eff6ff", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", color: "#2563eb" }}>
              <FileText size={20} />
            </div>
            <div>
              <div style={{ fontSize: "16px", fontWeight: "700", color: "#0f172a" }}>
                Invoice / Quotation letterhead
              </div>
              <div style={{ fontSize: "12px", color: "#64748b", marginTop: "2px" }}>
                Company details shown on customer portal quotations and printouts
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label style={labelStyle}>Brand name</label>
              <input style={inputStyle} value={invoiceProfile.brandName || ""} onChange={(e) => setInvoiceField("brandName", e.target.value)} placeholder="THE BOARD COMPANY" />
            </div>
            <div>
              <label style={labelStyle}>Legal name</label>
              <input style={inputStyle} value={invoiceProfile.legalName || ""} onChange={(e) => setInvoiceField("legalName", e.target.value)} placeholder="Length X Breadth Marketing Solutions LLP" />
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={labelStyle}>Address</label>
              <textarea
                style={{ ...inputStyle, minHeight: 72, resize: "vertical" }}
                value={invoiceProfile.address || ""}
                onChange={(e) => setInvoiceField("address", e.target.value)}
                placeholder="Business address"
              />
            </div>
            <div>
              <label style={labelStyle}>GSTIN</label>
              <input style={inputStyle} value={invoiceProfile.gstin || ""} onChange={(e) => setInvoiceField("gstin", e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Place of supply (default)</label>
              <input style={inputStyle} value={invoiceProfile.placeOfSupplyDefault || ""} onChange={(e) => setInvoiceField("placeOfSupplyDefault", e.target.value)} placeholder="Karnataka (29)" />
            </div>
            <div>
              <label style={labelStyle}>Email</label>
              <input style={inputStyle} type="email" value={invoiceProfile.email || ""} onChange={(e) => setInvoiceField("email", e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Website</label>
              <input style={inputStyle} value={invoiceProfile.website || ""} onChange={(e) => setInvoiceField("website", e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Logo URL (optional)</label>
              <input style={inputStyle} value={invoiceProfile.logoUrl || ""} onChange={(e) => setInvoiceField("logoUrl", e.target.value)} placeholder="https://..." />
            </div>
            <div>
              <label style={labelStyle}>Tax split on quotes</label>
              <select
                style={inputStyle}
                value={invoiceProfile.taxSplit || "cgst_sgst"}
                onChange={(e) =>
                  setInvoiceProfile((prev) => ({
                    ...prev,
                    taxSplit: e.target.value as InvoiceTaxSplit,
                  }))
                }
              >
                <option value="cgst_sgst">CGST + SGST (intra-state)</option>
                <option value="igst">IGST (inter-state)</option>
              </select>
            </div>
          </div>

          <div style={{ marginTop: 24, marginBottom: 12, fontSize: 13, fontWeight: 700, color: "#0f172a" }}>
            Bank details
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label style={labelStyle}>Account name</label>
              <input style={inputStyle} value={invoiceProfile.bank?.accountName || ""} onChange={(e) => setBankField("accountName", e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Account type</label>
              <input style={inputStyle} value={invoiceProfile.bank?.accountType || ""} onChange={(e) => setBankField("accountType", e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Account number</label>
              <input style={inputStyle} value={invoiceProfile.bank?.accountNumber || ""} onChange={(e) => setBankField("accountNumber", e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>IFSC</label>
              <input style={inputStyle} value={invoiceProfile.bank?.ifsc || ""} onChange={(e) => setBankField("ifsc", e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Bank name</label>
              <input style={inputStyle} value={invoiceProfile.bank?.bankName || ""} onChange={(e) => setBankField("bankName", e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Branch</label>
              <input style={inputStyle} value={invoiceProfile.bank?.branch || ""} onChange={(e) => setBankField("branch", e.target.value)} />
            </div>
          </div>

          <div style={{ marginTop: 24 }}>
            <label style={labelStyle}>Default terms (optional seed for new quotes)</label>
            <textarea
              style={{ ...inputStyle, minHeight: 96, resize: "vertical" }}
              value={invoiceProfile.defaultTerms || ""}
              onChange={(e) => setInvoiceField("defaultTerms", e.target.value)}
              placeholder="1. Warranty...&#10;2. Payment terms..."
            />
          </div>

          <button
            type="button"
            onClick={handleSaveInvoiceProfile}
            disabled={invoiceSaveStatus === "saving"}
            style={{
              marginTop: 20,
              padding: "12px 20px",
              background:
                invoiceSaveStatus === "saved"
                  ? "#10b981"
                  : invoiceSaveStatus === "error"
                    ? "#ef4444"
                    : "var(--color-primary)",
              color: "white",
              border: "none",
              borderRadius: "8px",
              fontSize: "13px",
              fontWeight: 700,
              cursor: invoiceSaveStatus === "saving" ? "not-allowed" : "pointer",
              opacity: invoiceSaveStatus === "saving" ? 0.7 : 1,
            }}
          >
            {invoiceSaveStatus === "saving"
              ? "Saving letterhead..."
              : invoiceSaveStatus === "saved"
                ? "Letterhead saved"
                : invoiceSaveStatus === "error"
                  ? "Save failed — retry"
                  : "Save letterhead"}
          </button>
        </div>

        {/* Invoice numbering (per company) */}
        <div
          style={{
            background: "white",
            border: "1px solid #e2e8f0",
            borderRadius: "12px",
            padding: "24px",
            marginBottom: "20px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px", paddingBottom: "16px", borderBottom: "1px solid #e2e8f0" }}>
            <div style={{ width: "40px", height: "40px", background: "#f0fdf4", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", color: "#16a34a" }}>
              <FileText size={20} />
            </div>
            <div>
              <div style={{ fontSize: "16px", fontWeight: "700", color: "#0f172a" }}>
                Invoice Number
              </div>
              <div style={{ fontSize: "12px", color: "#64748b", marginTop: "2px" }}>
                Configurable numbering for this company — never uses UUIDs. Applies to newly created invoices.
              </div>
              {companyDetails?.id && (
                <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "4px", fontFamily: "ui-monospace, monospace" }}>
                  Company ID: {companyDetails.id}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label style={labelStyle}>Prefix</label>
              <input
                style={inputStyle}
                value={invoiceNumbering.prefix}
                onChange={(e) => setNumberingField("prefix", e.target.value)}
                placeholder="INV or PRT/INV"
              />
            </div>
            <div>
              <label style={labelStyle}>Separator</label>
              <input
                style={inputStyle}
                value={invoiceNumbering.separator}
                onChange={(e) => setNumberingField("separator", e.target.value || "-")}
                placeholder="- or /"
                maxLength={3}
              />
            </div>
            <div>
              <label style={labelStyle}>Year segment</label>
              <select
                style={inputStyle}
                value={invoiceNumbering.yearPart}
                onChange={(e) =>
                  setNumberingField("yearPart", e.target.value as InvoiceYearPart)
                }
              >
                <option value="calendar">Calendar year (2026)</option>
                <option value="financial">Financial year (26-27)</option>
                <option value="none">None</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Financial year starts (month)</label>
              <select
                style={inputStyle}
                value={invoiceNumbering.financialYearStartMonth}
                disabled={invoiceNumbering.yearPart !== "financial" && invoiceNumbering.reset !== "yearly"}
                onChange={(e) =>
                  setNumberingField(
                    "financialYearStartMonth",
                    Number(e.target.value) || 4
                  )
                }
              >
                {[
                  [1, "January"],
                  [2, "February"],
                  [3, "March"],
                  [4, "April"],
                  [5, "May"],
                  [6, "June"],
                  [7, "July"],
                  [8, "August"],
                  [9, "September"],
                  [10, "October"],
                  [11, "November"],
                  [12, "December"],
                ].map(([m, label]) => (
                  <option key={m} value={m}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Starting number</label>
              <input
                style={inputStyle}
                type="number"
                min={1}
                value={invoiceNumbering.startingNumber}
                onChange={(e) =>
                  setNumberingField(
                    "startingNumber",
                    Math.max(1, Number(e.target.value) || 1)
                  )
                }
                placeholder="1001"
              />
            </div>
            <div>
              <label style={labelStyle}>Digit padding</label>
              <input
                style={inputStyle}
                type="number"
                min={1}
                max={12}
                value={invoiceNumbering.padding}
                onChange={(e) =>
                  setNumberingField(
                    "padding",
                    Math.min(12, Math.max(1, Number(e.target.value) || 4))
                  )
                }
                placeholder="4"
              />
            </div>
            <div>
              <label style={labelStyle}>Reset sequence</label>
              <select
                style={inputStyle}
                value={invoiceNumbering.reset}
                onChange={(e) =>
                  setNumberingField("reset", e.target.value as InvoiceNumberReset)
                }
              >
                <option value="yearly">Every Year</option>
                <option value="monthly">Every Month</option>
                <option value="never">Never</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Preview (next style)</label>
              <div
                style={{
                  ...inputStyle,
                  background: "#f8fafc",
                  fontFamily: "ui-monospace, monospace",
                  fontWeight: 700,
                  color: "#0f172a",
                }}
              >
                {numberingPreview}
              </div>
              <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 6 }}>
                Examples: INV-2026-000001 · INV/26-27/0001 · PRT/INV/2026/00001
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleSaveInvoiceNumbering}
            disabled={numberingSaveStatus === "saving"}
            style={{
              marginTop: 20,
              padding: "12px 20px",
              background:
                numberingSaveStatus === "saved"
                  ? "#10b981"
                  : numberingSaveStatus === "error"
                    ? "#ef4444"
                    : "var(--color-primary)",
              color: "white",
              border: "none",
              borderRadius: "8px",
              fontSize: "13px",
              fontWeight: 700,
              cursor: numberingSaveStatus === "saving" ? "not-allowed" : "pointer",
              opacity: numberingSaveStatus === "saving" ? 0.7 : 1,
            }}
          >
            {numberingSaveStatus === "saving"
              ? "Saving numbering..."
              : numberingSaveStatus === "saved"
                ? "Numbering saved"
                : numberingSaveStatus === "error"
                  ? "Save failed — retry"
                  : "Save invoice numbering"}
          </button>
        </div>

        {/* Security Section */}
        <div
          style={{
            background: "white",
            border: "1px solid #e2e8f0",
            borderRadius: "12px",
            padding: "24px",
            marginBottom: "20px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px", paddingBottom: "16px", borderBottom: "1px solid #e2e8f0" }}>
            <div style={{ width: "40px", height: "40px", background: "#fef2f2", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", color: "#ef4444" }}>
              <Key size={20} />
            </div>
            <div>
              <div style={{ fontSize: "16px", fontWeight: "700", color: "#0f172a" }}>
                Security & Login
              </div>
              <div style={{ fontSize: "12px", color: "#64748b", marginTop: "2px" }}>
                Manage your password and authentication settings
              </div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontSize: "14px", fontWeight: "600", color: "#0f172a" }}>Account Password</div>
              <div style={{ fontSize: "13px", color: "#64748b", marginTop: "2px" }}>Change the password you use to log in</div>
            </div>
            <button
              onClick={() => setIsPasswordModalOpen(true)}
              style={{
                padding: "8px 16px",
                background: "white",
                border: "1px solid #e2e8f0",
                borderRadius: "6px",
                fontSize: "13px",
                fontWeight: "600",
                color: "#0f172a",
                cursor: "pointer",
                boxShadow: "0 1px 2px rgba(0,0,0,0.05)"
              }}
            >
              Change Password
            </button>
          </div>
        </div>

        {/* Save Button */}
        <button
          onClick={persistSettings}
          disabled={saveStatus === "saving" || !hasUnsavedChanges}
          style={{
            width: "100%",
            padding: "14px",
            background: saveStatus === "saved" ? "#10b981" : "var(--color-primary)",
            color: "white",
            border: "none",
            borderRadius: "8px",
            fontSize: "14px",
            fontWeight: "700",
            cursor: saveStatus === "saving" ? "not-allowed" : "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            transition: "all 0.3s",
            opacity: saveStatus === "saving" || !hasUnsavedChanges ? 0.7 : 1,
          }}
        >
          {saveStatus === "saving" ? (
            <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>Saving...</span>
          ) : saveStatus === "saved" ? (
            <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>✓ Settings Saved</span>
          ) : (
            <span style={{ display: "flex", alignItems: "center", gap: "8px" }}><Save size={16} /> Save Settings</span>
          )}
        </button>
      </div>

      {/* Unsaved Changes Banner */}
      <div style={{
        position: "fixed",
        bottom: hasUnsavedChanges && saveStatus !== "saved" ? "0" : "-100px",
        left: 0,
        right: 0,
        background: "#ef4444",
        color: "white",
        padding: "16px 32px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "24px",
        boxShadow: "0 -10px 15px -3px rgba(0, 0, 0, 0.1)",
        transition: "bottom 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
        zIndex: 50,
      }}>
        <div style={{ fontSize: "16px", fontWeight: "700" }}>
          You have unsaved changes. Not saved yet!
        </div>
        <button
          onClick={persistSettings}
          disabled={saveStatus === "saving"}
          style={{
            padding: "10px 24px",
            background: "white",
            color: "#ef4444",
            border: "none",
            borderRadius: "9999px",
            fontSize: "14px",
            fontWeight: "800",
            cursor: saveStatus === "saving" ? "not-allowed" : "pointer",
            boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
            transition: "all 0.2s"
          }}
        >
          {saveStatus === "saving" ? "Saving..." : "Save Now"}
        </button>
      </div>

      {/* Enhanced Floating Notification Toast */}
      <div style={{
        position: "fixed",
        bottom: saveStatus === "saved" ? "40px" : "-100px",
        left: "50%",
        transform: "translateX(-50%)",
        background: "rgba(255, 255, 255, 0.9)",
        backdropFilter: "blur(10px)",
        color: "#064e3b",
        padding: "16px 32px",
        borderRadius: "20px",
        fontSize: "15px",
        fontWeight: "700",
        display: "flex",
        alignItems: "center",
        gap: "12px",
        boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04), inset 0 0 0 1px rgba(16, 185, 129, 0.2)",
        transition: "bottom 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)",
        zIndex: 60
      }}>
        <div style={{ 
          width: "28px", 
          height: "28px", 
          background: "#10b981", 
          borderRadius: "50%", 
          display: "flex", 
          alignItems: "center", 
          justifyContent: "center",
          color: "white",
          boxShadow: "0 2px 5px rgba(16, 185, 129, 0.4)"
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
        </div>
        Settings successfully updated
      </div>

      {/* Password Modal */}
      {isPasswordModalOpen && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0,0,0,0.4)", backdropFilter: "blur(2px)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100
        }}>
          <div style={{
            background: "white", borderRadius: "12px", width: "100%", maxWidth: "400px",
            boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)", padding: "24px"
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
              <h2 style={{ fontSize: "18px", fontWeight: "700", margin: 0 }}>Change Password</h2>
              <button onClick={() => setIsPasswordModalOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b" }}>
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handlePasswordChange} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div>
                <label style={{ fontSize: "13px", fontWeight: "600", color: "#0f172a", marginBottom: "6px", display: "block" }}>New Password</label>
                <input 
                  type="password" 
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  style={{
                    width: "100%", padding: "10px 12px", border: "1px solid #e2e8f0", borderRadius: "8px", fontSize: "14px"
                  }}
                  required
                />
              </div>
              <div>
                <label style={{ fontSize: "13px", fontWeight: "600", color: "#0f172a", marginBottom: "6px", display: "block" }}>Confirm New Password</label>
                <input 
                  type="password" 
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  style={{
                    width: "100%", padding: "10px 12px", border: "1px solid #e2e8f0", borderRadius: "8px", fontSize: "14px"
                  }}
                  required
                />
              </div>

              {passwordStatus === "error" && (
                <div style={{ fontSize: "13px", color: "#ef4444", background: "#fef2f2", padding: "8px 12px", borderRadius: "6px" }}>
                  {passwordErrorMsg}
                </div>
              )}
              {passwordStatus === "success" && (
                <div style={{ fontSize: "13px", color: "#10b981", background: "#dcfce7", padding: "8px 12px", borderRadius: "6px" }}>
                  Password updated successfully!
                </div>
              )}

              <button 
                type="submit" 
                disabled={passwordStatus === "saving" || passwordStatus === "success"}
                style={{
                  width: "100%", padding: "12px", background: "var(--color-primary)", color: "white", border: "none",
                  borderRadius: "8px", fontSize: "14px", fontWeight: "600", cursor: "pointer", marginTop: "8px",
                  opacity: (passwordStatus === "saving" || passwordStatus === "success") ? 0.7 : 1
                }}
              >
                {passwordStatus === "saving" ? "Updating..." : "Update Password"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
