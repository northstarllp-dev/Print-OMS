"use client";

import React, { useState } from "react";
import {
  ArrowLeft, CheckSquare, FileText,
  AlertOctagon, Check, Image as ImageIcon, Sparkles, Loader2, Save, Timer, Shield
} from "lucide-react";
import type { StageModuleProps } from "../../shared/types";

interface LocationMeasurement {
  id: string;
  name: string;
  width: string;
  height: string;
  depth: string;
  ground_clearance?: string;
  notes?: string;
  photos?: string[];
}

interface QuoteItem {
  id: string;
  description: string;
  quantity: number;
  unit?: string;
  unitPrice: number;
  costPerSqFt?: number;
  totalSqFt?: number;
  gstRate: number;
  pricingType?: "per_unit" | "per_sqft";
}

export interface ProductionModuleData {
  order: any;
  customers: any[];
  employees: any[];
  products: any[];
  quotation: any;
  siteVisitItems?: any[];
}

export interface ProductionModuleCallbacks {
  updateProductionDetails: (orderId: string, details: any) => Promise<any>;
  onBack: () => void;
}

type ProductionModuleProps = StageModuleProps<
  ProductionModuleData,
  ProductionModuleCallbacks
> & {
  /** When true, hide portal chrome (back button) and fit inside order detail panel. */
  embedded?: boolean;
  adminOverrideUnlocked?: boolean;
  setAdminOverrideUnlocked?: (val: boolean) => void;
  currentUserRole?: string;
};

function maskPhone(phone: string) {
  if (!phone) return "";
  // Keep first 3 characters (e.g., +91) and last 4, mask the rest
  const cleanPhone = phone.trim();
  if (cleanPhone.length > 7) {
    return cleanPhone.substring(0, 3) + "******" + cleanPhone.slice(-4);
  }
  return cleanPhone.replace(/./g, "*");
}

function maskEmail(email: string) {
  if (!email || !email.includes("@")) return email;
  const [name, domain] = email.split("@");
  if (name.length <= 2) return `${name[0]}***@${domain}`;
  return `${name[0]}***${name[name.length - 1]}@${domain}`;
}

export function ProductionModule({ 
  data, 
  permission, 
  callbacks, 
  embedded = false, 
  adminOverrideUnlocked, 
  setAdminOverrideUnlocked, 
  currentUserRole 
}: ProductionModuleProps) {
  const {
    order: initialOrder,
    customers,
    quotation,
    siteVisitItems = []
  } = data;
  const { updateProductionDetails, onBack } = callbacks;
  const [order, setOrder] = useState(initialOrder);

  const isProductionStage = ["Production In Progress", "Production Pending", "Production", "Ready For Installation"].includes(order.stage);
  const baseFrozen = !isProductionStage;
  const canEdit = (permission?.canEdit ?? true) && (!baseFrozen || adminOverrideUnlocked);
  const canEditDeadline = canEdit;

  const [saving, setSaving] = useState(false);
  const [alert, setAlert] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const pd = order.productionDetails || {
    procurementOfMaterials: false,
    acpAndAcrylicCutting: false,
    lightingAndWiring: false,
    qualityCheck: false,
    deadline: null
  };

  const [editingDeadline, setEditingDeadline] = useState(false);
  const [deadlineValue, setDeadlineValue] = useState(
    pd.deadline ? new Date(pd.deadline).toISOString().split("T")[0] : ""
  );

  const handleDeadlineSave = async () => {
    if (!canEdit) return;
    setSaving(true);
    setAlert(null);
    try {
      const updatedPd = { ...pd, deadline: deadlineValue || null };
      await updateProductionDetails(order.id, { deadline: deadlineValue || null });
      setOrder((prev: any) => ({
        ...prev,
        productionDetails: updatedPd
      }));
      setAlert({ message: "Deadline updated successfully.", type: "success" });
      setEditingDeadline(false);
    } catch (err: any) {
      console.error(err);
      setAlert({ message: err.message || "Failed to update deadline.", type: "error" });
    } finally {
      setSaving(false);
      setTimeout(() => setAlert(null), 3000);
    }
  };

  const client = customers.find(c => c.id === order.customerId);


  const svDetails = order.siteVisitDetails || {};
  const locations: LocationMeasurement[] = svDetails.locations || [];

  const dd = order.designDetails || order.design || { proofUrl: "", status: "Draft" };
  const mockImage = order.imageMockup || dd.proofUrl;

  const handleCheckboxChange = async (key: "procurementOfMaterials" | "acpAndAcrylicCutting" | "lightingAndWiring" | "qualityCheck") => {
    if (!canEdit) return;
    setSaving(true);
    setAlert(null);

    const updatedPd = {
      ...pd,
      [key]: !pd[key]
    };

    // Optimistically update local state
    setOrder((prev: any) => ({
      ...prev,
      productionDetails: updatedPd
    }));

    try {
      await updateProductionDetails(order.id, updatedPd);
      setAlert({ message: "Fabrication milestone updated successfully.", type: "success" });
    } catch (err: any) {
      console.error(err);
      // Revert local state
      setOrder((prev: any) => ({
        ...prev,
        productionDetails: pd
      }));
      setAlert({ message: err.message || "Failed to update milestone.", type: "error" });
    } finally {
      setSaving(false);
      setTimeout(() => setAlert(null), 3000);
    }
  };

  const signageOptions = quotation?.signage_options || [];
  const designItems = dd.items || [];

  return (
    <div className={embedded ? "space-y-6" : "p-8 bg-slate-50/50 min-h-screen"}>
      {/* Top Navigation — portal only */}
      {!embedded && (
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-slate-600 text-xs font-bold shadow-xs hover:bg-slate-50 transition-colors"
          >
            <ArrowLeft size={14} /> Back to Queue
          </button>
          <span className="text-slate-300">/</span>
          <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">{order.orderCode}</span>
        </div>
      )}

      {/* ── ADMIN OVERRIDE BANNER ── */}
      {baseFrozen && currentUserRole === "Admin" && setAdminOverrideUnlocked && (
        <div className={`mb-6 p-4 rounded-xl border flex items-center justify-between transition-colors ${adminOverrideUnlocked ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200'}`}>
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${adminOverrideUnlocked ? 'bg-amber-100 text-amber-600' : 'bg-slate-200 text-slate-500'}`}>
              <Shield size={16} />
            </div>
            <div>
              <h4 className={`text-sm font-bold ${adminOverrideUnlocked ? 'text-amber-900' : 'text-slate-700'}`}>Admin God Mode</h4>
              <p className={`text-xs ${adminOverrideUnlocked ? 'text-amber-700' : 'text-slate-500'}`}>
                {adminOverrideUnlocked 
                  ? "Module is currently unlocked. You can edit all details and check off milestones." 
                  : "This module is locked because it is not the active phase. Unlock it to forcefully edit details."}
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

      {/* Embedded: only date started + deadline. Portal: full header + info cards. */}
      {embedded ? (
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
              Date Started
            </div>
            <div className="text-sm font-bold text-slate-800">
              {order.dateCreated
                ? new Date(order.dateCreated).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })
                : "TBD"}
            </div>
          </div>

          <div className="flex items-center gap-4">
            {alert && (
              <div className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${
                alert.type === "success"
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : "bg-rose-50 text-rose-700 border-rose-200"
              }`}>
                {alert.message}
              </div>
            )}
            <div className="flex flex-col items-end">
              <span className="text-[10px] font-black text-rose-500 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                Production Deadline
              </span>
              {editingDeadline ? (
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={deadlineValue}
                    onChange={(e) => setDeadlineValue(e.target.value)}
                    className="px-2 py-1 text-xs border border-rose-300 rounded text-slate-800"
                  />
                  <button
                    onClick={handleDeadlineSave}
                    disabled={saving}
                    className="p-1.5 bg-emerald-600 text-white rounded hover:bg-emerald-700"
                  >
                    {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  </button>
                  <button
                    onClick={() => {
                      setEditingDeadline(false);
                      setDeadlineValue(pd.deadline ? new Date(pd.deadline).toISOString().split("T")[0] : "");
                    }}
                    className="p-1.5 bg-slate-200 text-slate-700 rounded hover:bg-slate-300"
                  >
                    <ArrowLeft size={14} />
                  </button>
                </div>
              ) : (
                <div
                  className={`bg-gradient-to-r from-rose-500 to-rose-600 text-white px-4 py-2 rounded-xl text-xs font-black shadow-md flex items-center gap-2 border-b-2 border-rose-700 ${canEditDeadline ? 'cursor-pointer hover:from-rose-600 hover:to-rose-700' : ''}`}
                  onClick={() => canEditDeadline && setEditingDeadline(true)}
                  title={canEditDeadline ? "Click to edit deadline" : ""}
                >
                  <Timer size={16} className="text-rose-100 animate-pulse" />
                  {pd.deadline
                    ? new Date(pd.deadline).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })
                    : "Not Set"}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                  {order.businessName} - {order.clientName}
                </h1>
              </div>
              <p className="text-xs text-slate-500 font-semibold">
                Status: <span className="text-blue-600 font-bold">{order.stage}</span>
              </p>
            </div>

            <div className="flex items-center gap-4">
              {alert && (
                <div className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${
                  alert.type === "success"
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : "bg-rose-50 text-rose-700 border-rose-200"
                }`}>
                  {alert.message}
                </div>
              )}

            <div className="flex flex-col items-end">
              <span className="text-[10px] font-black text-rose-500 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                Production Deadline
              </span>
              {editingDeadline ? (
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={deadlineValue}
                    onChange={(e) => setDeadlineValue(e.target.value)}
                    className="px-2 py-1 text-xs border border-rose-300 rounded text-slate-800"
                  />
                  <button
                    onClick={handleDeadlineSave}
                    disabled={saving}
                    className="p-1.5 bg-emerald-600 text-white rounded hover:bg-emerald-700"
                  >
                    {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  </button>
                  <button
                    onClick={() => {
                      setEditingDeadline(false);
                      setDeadlineValue(pd.deadline ? new Date(pd.deadline).toISOString().split("T")[0] : "");
                    }}
                    className="p-1.5 bg-slate-200 text-slate-700 rounded hover:bg-slate-300"
                  >
                    <ArrowLeft size={14} />
                  </button>
                </div>
              ) : (
                <div
                  className={`bg-gradient-to-r from-rose-500 to-rose-600 text-white px-4 py-2 rounded-xl text-xs font-black shadow-md flex items-center gap-2 border-b-2 border-rose-700 ${canEditDeadline ? 'cursor-pointer hover:from-rose-600 hover:to-rose-700' : ''}`}
                  onClick={() => canEditDeadline && setEditingDeadline(true)}
                  title={canEditDeadline ? "Click to edit deadline" : ""}
                >
                  <Timer size={16} className="text-rose-100 animate-pulse" />
                  {pd.deadline
                    ? new Date(pd.deadline).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })
                    : "Not Set"}
                </div>
              )}
            </div>
            </div>
          </div>

          <div className="mb-6 prt-card p-6">
            <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider mb-4 border-b border-slate-100 pb-3 flex items-center gap-2">
              <FileText size={18} className="text-blue-600" /> Basic Information
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-6 text-xs">
              <div>
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Order No</div>
                <div className="font-bold text-slate-800">{order.orderCode}</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Client Name</div>
                <div className="font-bold text-slate-800">{order.clientName || "—"}</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Business Name</div>
                <div className="font-bold text-slate-800">{order.businessName || "—"}</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Priority</div>
                <div className="font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded inline-block">{order.priority || "High"}</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Expected Completion Date</div>
                <div className="font-bold text-slate-800">{order.expected_completion_date ? new Date(order.expected_completion_date).toLocaleDateString("en-IN") : "TBD"}</div>
              </div>
            </div>
          </div>

          {client && (
            <div className="mb-6 prt-card p-6">
              <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
                <Sparkles size={18} className="text-rose-600" />
                <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider">
                  Client Contact
                </h2>
              </div>
              <div className="flex flex-wrap gap-8 text-xs">
                <div>
                  <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Client Name</div>
                  <div className="font-bold text-slate-800">{client.name}</div>
                </div>
                {client.phone && (
                  <div>
                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Phone</div>
                    <div className="font-semibold text-slate-700">📞 {maskPhone(client.phone)}</div>
                  </div>
                )}
                {client.email && (
                  <div>
                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Email Address</div>
                    <div className="font-semibold text-slate-700">{maskEmail(client.email)}</div>
                  </div>
                )}
                {client.shippingAddress && (
                  <div className="flex-1 min-w-[200px]">
                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Installation Site Address</div>
                    <div className="font-medium text-slate-600 leading-relaxed">{client.shippingAddress}</div>
                  </div>
                )}
                {(order.notes || quotation?.notes) && (
                  <div className="flex-1 min-w-[200px]">
                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Requirements / Notes</div>
                    <div className="font-medium text-slate-600 leading-relaxed">{order.notes || quotation?.notes}</div>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* View-Only Site Visit Banner */}
      <div className="mb-6 bg-indigo-50/80 border border-indigo-100 text-indigo-700 p-4 rounded-xl text-xs font-semibold flex items-center gap-3 shadow-sm">
        <Sparkles size={16} className="text-indigo-600 flex-shrink-0" />
        You now have view-only access to the Site Visit stage. Click the 'Site Visit' tab in the timeline above to view full location photos and measurement details!
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">

        {/* LEFT COLUMN: Stage Outputs & Details (2/3 width) */}
        <div className="lg:col-span-2 space-y-8">






          {/* FINAL PRODUCTION FILES (Per Item) */}
          <div className="prt-card p-6">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
              <ImageIcon size={18} className="text-emerald-600" />
              <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider">
                Design Files
              </h2>
            </div>

            {designItems.filter((item: any) => item.productionFiles && item.productionFiles.length > 0).length > 0 ? (
              <div className="space-y-6">
                {designItems.filter((item: any) => item.productionFiles && item.productionFiles.length > 0).map((item: any) => (
                  <div key={item.id} className="border border-slate-200 rounded-xl p-4 bg-slate-50/50">
                    <h3 className="font-bold text-slate-800 mb-3 text-sm">{item.name}</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {item.productionFiles.map((file: any) => {
                        const fileExt = file.name.split('.').pop()?.toUpperCase() || 'FILE';
                        return (
                          <div key={file.id} className="border border-slate-200 rounded-xl p-4 flex flex-col items-center justify-center bg-white relative group shadow-sm text-center gap-2 hover:border-blue-300 transition-colors">
                            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center font-black text-xs mb-1">
                              {fileExt}
                            </div>
                            <span className="text-xs font-bold text-slate-700 truncate w-full" title={file.name}>
                              {file.name}
                            </span>
                            <a href={file.url} target="_blank" rel="noreferrer" className="mt-1 px-4 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition-colors w-full shadow-sm">
                              Download
                            </a>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-12 text-center text-xs text-slate-400 font-semibold flex flex-col items-center justify-center gap-2 border-2 border-dashed border-slate-200 rounded-xl">
                <FileText size={24} className="text-slate-300" />
                <span>No production files uploaded yet.</span>
              </div>
            )}
          </div>

          {/* PRODUCTION NOTES */}
          <div className="prt-card p-6">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
              <AlertOctagon size={18} className="text-rose-600" />
              <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider">
                Production Notes
              </h2>
            </div>
            {quotation?.notes || quotation?.terms ? (
              <div className="space-y-4">
                {quotation.notes && (
                  <div>
                    <h3 className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1.5">General Notes</h3>
                    <div className="text-xs text-slate-700 font-medium whitespace-pre-wrap bg-slate-50 p-4 rounded-xl border border-slate-100">
                      {quotation.notes}
                    </div>
                  </div>
                )}
                {quotation.terms && (
                  <div>
                    <h3 className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1.5">Terms & Conditions</h3>
                    <div className="text-xs text-slate-700 font-medium whitespace-pre-wrap bg-slate-50 p-4 rounded-xl border border-slate-100">
                      {quotation.terms}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="py-6 text-center text-xs text-slate-400 font-semibold">
                No special production notes provided.
              </div>
            )}
          </div>

        </div>

        {/* RIGHT COLUMN: Interactive Fabrication Checklist & Customer Info (1/3 width) */}
        <div className="space-y-8">

          {/* WORKSHOP PRODUCTION QUEUE CHECKLIST */}
          <div className="prt-card p-6 sticky top-6">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
              <CheckSquare size={18} className="text-blue-600" />
              <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider">
                Workshop Production
              </h2>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed mb-5">
              Check off fabrication milestones as ACP structures and lettering progress.
            </p>

            <div className="space-y-3.5">
              {[
                { key: "procurementOfMaterials", label: "1. Procurement of Materials", desc: "Sourcing and procuring all required raw materials" },
                { key: "acpAndAcrylicCutting", label: "2. ACP & Acrylic Cutting", desc: "Precision cutting of ACP and acrylic sheets" },
                { key: "lightingAndWiring", label: "3. Lighting & Wiring", desc: "Installing LED modules and electrical wiring" },
                { key: "qualityCheck", label: "4. Quality Check", desc: "Final inspection and quality assurance" },
              ].map(step => {
                const isChecked = !!pd[step.key as keyof typeof pd];
                return (
                  <div
                    key={step.key}
                    onClick={() => canEdit && !saving && handleCheckboxChange(step.key as any)}
                    className={`p-4 border rounded-xl flex items-start gap-3 select-none transition-all duration-200 ${
                      canEdit ? "cursor-pointer" : "cursor-not-allowed opacity-70"
                    } ${
                      isChecked
                        ? "bg-emerald-50/50 border-emerald-200 text-emerald-950"
                        : "bg-white border-slate-200 hover:border-slate-300 text-slate-800"
                    }`}
                  >
                    <div className="mt-0.5">
                      <div className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all ${
                        isChecked
                          ? "bg-emerald-600 border-emerald-600 text-white"
                          : "border-slate-300 bg-white"
                      }`}>
                        {isChecked && <Check size={12} strokeWidth={3} />}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-bold leading-none mb-1">{step.label}</div>
                      <div className="text-[10px] text-slate-500 font-semibold">{step.desc}</div>
                    </div>
                  </div>
                );
              })}
            </div>

            {saving && (
              <div className="flex items-center justify-center gap-2 text-xs text-slate-400 font-bold mt-4">
                <Loader2 size={12} className="animate-spin text-blue-600" />
                <span>Updating database...</span>
              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  );
}
