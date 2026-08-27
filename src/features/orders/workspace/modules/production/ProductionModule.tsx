"use client";

import React, { useEffect, useState } from "react";
import {
  ArrowLeft, CheckSquare, FileText,
  AlertOctagon, Check, Sparkles, Loader2, Save, Timer, Shield, Plus, X
} from "lucide-react";
import type { StageModuleProps } from "../../shared/types";
import { getAppSettings } from "@/features/settings/actions/settingsActions";
import {
  buildProductionChecklistUpdate,
  createCustomProductionChecklistItemId,
  DEFAULT_PRODUCTION_CHECKLIST_ITEMS,
  getChecklistForBusinessOp,
  readCustomProductionChecklistItems,
  resolveChecklistProgress,
  type ProductionChecklistItem,
} from "@/features/settings/productionChecklist";
import { resolveSiteVisitInstallationAddress } from "@/features/orders/actions/siteVisitMapper";
import { ProductionMaterialsPanel } from "@/features/inventory/components/ProductionMaterialsPanel";
import { getInstallationDeadlineCountdown } from "./installationDeadlineUi";
import { productionStageFileItems } from "./productionFilesUi";
import { StageFileCard, StageFileUsageBar } from "./StageFileCard";
import { STAGE_FILE_SECTION_HINT, STAGE_FILE_ZIP_PREFERRED_NOTE, sumStageFileBytes, type StageFileEntry } from "@/utils/supabase/storageConfig";

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

type StageFile = StageFileEntry;

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

  const isProductionStage = ["Production In Progress", "Production Pending", "Production"].includes(order.stage);
  const baseFrozen = !isProductionStage;
  const canEdit = (permission?.canEdit ?? true) && (!baseFrozen || adminOverrideUnlocked);
  // Installation deadline is admin-only (staff can view, not edit).
  const canEditDeadline = currentUserRole === "Admin";

  const [saving, setSaving] = useState(false);
  const [alert, setAlert] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [newCustomLabel, setNewCustomLabel] = useState("");
  const [checklistItems, setChecklistItems] = useState<ProductionChecklistItem[]>(
    DEFAULT_PRODUCTION_CHECKLIST_ITEMS
  );

  useEffect(() => {
    getAppSettings()
      .then((settings) => {
        const items = getChecklistForBusinessOp(
          settings?.productionChecklistsByOp ?? settings?.productionChecklistItems,
          initialOrder?.business_operation
        );
        if (items.length) setChecklistItems(items);
      })
      .catch(console.error);
  }, [initialOrder?.business_operation]);

  const pd = order.productionDetails || {
    stage1: false,
    stage2: false,
    stage3: false,
    stage4: false,
    checklist: {},
    installation_deadline: null,
  };
  const checklistProgress = resolveChecklistProgress(pd, checklistItems);
  const customChecklistItems = readCustomProductionChecklistItems(pd);
  const customItemMeta = customChecklistItems.map(({ id, label }) => ({ id, label }));
  const deadlineIso = pd.installation_deadline ?? pd.deadline ?? null;
  const deadlineCountdown = getInstallationDeadlineCountdown(deadlineIso);

  const persistChecklist = async (
    nextProgress: Record<string, boolean>,
    nextCustomMeta: Array<{ id: string; label: string }>,
    successMessage: string
  ) => {
    if (!canEdit || saving) return;
    setAlert(null);

    const payload = buildProductionChecklistUpdate(
      nextProgress,
      checklistItems,
      {},
      nextCustomMeta
    );
    const updatedPd = { ...pd, ...payload };

    setOrder((prev: any) => ({
      ...prev,
      productionDetails: updatedPd,
    }));
    setSaving(true);

    try {
      await updateProductionDetails(order.id, payload);
      setAlert({ message: successMessage, type: "success" });
    } catch (err: any) {
      console.error(err);
      setOrder((prev: any) => ({
        ...prev,
        productionDetails: pd,
      }));
      setAlert({ message: err.message || "Failed to update checklist.", type: "error" });
    } finally {
      setSaving(false);
      setTimeout(() => setAlert(null), 3000);
    }
  };

  const [editingDeadline, setEditingDeadline] = useState(false);
  const [deadlineValue, setDeadlineValue] = useState(
    deadlineIso ? new Date(deadlineIso).toISOString().split("T")[0] : ""
  );

  const handleDeadlineSave = async () => {
    if (!canEditDeadline) return;
    setSaving(true);
    setAlert(null);
    try {
      const nextDeadline = deadlineValue || null;
      const updatedPd = {
        ...pd,
        installation_deadline: nextDeadline,
        deadline: nextDeadline,
      };
      await updateProductionDetails(order.id, { installation_deadline: nextDeadline });
      setOrder((prev: any) => ({
        ...prev,
        productionDetails: updatedPd
      }));
      setAlert({ message: "Installation deadline updated.", type: "success" });
      setEditingDeadline(false);
    } catch (err: any) {
      console.error(err);
      setAlert({ message: err.message || "Failed to update installation deadline.", type: "error" });
    } finally {
      setSaving(false);
      setTimeout(() => setAlert(null), 3000);
    }
  };

  const client = customers.find(c => c.id === order.customerId);
  const installationSiteAddress = resolveSiteVisitInstallationAddress(
    order.siteVisitDetails,
    client?.shippingAddress
  );

  const svDetails = order.siteVisitDetails || {};
  const locations: LocationMeasurement[] = svDetails.locations || [];

  const dd = initialOrder.designDetails || initialOrder.design || order.designDetails || order.design || { items: [] };
  const designItems = productionStageFileItems(dd.items || []);

  const progressWithCustom = () => {
    const next: Record<string, boolean> = { ...checklistProgress };
    for (const item of customChecklistItems) {
      next[item.id] = item.checked;
    }
    return next;
  };

  const handleCheckboxChange = async (key: string) => {
    const base = progressWithCustom();
    await persistChecklist(
      { ...base, [key]: !base[key] },
      customItemMeta,
      "Fabrication milestone updated successfully."
    );
  };

  const handleAddCustomCheck = async () => {
    const label = newCustomLabel.trim();
    if (!label || !canEdit || saving) return;
    const id = createCustomProductionChecklistItemId([
      ...checklistItems.map((item) => item.id),
      ...customChecklistItems.map((item) => item.id),
    ]);
    const base = progressWithCustom();
    await persistChecklist(
      { ...base, [id]: false },
      [...customItemMeta, { id, label }],
      "Custom check added."
    );
    setNewCustomLabel("");
  };

  const handleRemoveCustomCheck = async (id: string) => {
    if (!canEdit || saving) return;
    const base = progressWithCustom();
    delete base[id];
    await persistChecklist(
      base,
      customItemMeta.filter((item) => item.id !== id),
      "Custom check removed."
    );
  };

  const signageOptions = quotation?.signage_options || [];

  return (
    <div className={embedded ? "space-y-6" : "p-8 bg-slate-50/50 min-h-screen"}>
      {/* Top Navigation portal only */}
      {!embedded && (
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-slate-600 text-xs font-bold shadow-xs hover:bg-slate-50 transition-colors"
          >
            <ArrowLeft size={14} /> Back to Queue
          </button>
          <span className="text-slate-300">/</span>
          <span className="text-slate-400 text-xs font-medium">{order.orderCode}</span>
        </div>
      )}

      {/* ── ADMIN OVERRIDE BANNER ── */}
      {baseFrozen && currentUserRole === "Admin" && setAdminOverrideUnlocked && (
        <div className={`mb-6 p-4 rounded-xl border flex flex-col md:flex-row md:items-center gap-3 md:justify-between transition-colors ${adminOverrideUnlocked ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200'}`}>
          <div className="flex items-start md:items-center gap-3 min-w-0">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${adminOverrideUnlocked ? 'bg-amber-100 text-amber-600' : 'bg-slate-200 text-slate-500'}`}>
              <Shield size={16} />
            </div>
            <div className="min-w-0">
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

      {/* Embedded: only date started + deadline. Portal: full header + info cards. */}
      {embedded ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50">
              <span className="text-[9px] font-medium text-slate-500 whitespace-nowrap">
                Date Started
              </span>
              <span className="text-xs font-bold text-slate-800 whitespace-nowrap">
                {order.dateCreated
                  ? new Date(order.dateCreated).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })
                  : "TBD"}
              </span>
            </div>

            {alert && (
              <div className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-all ${
                alert.type === "success"
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : "bg-rose-50 text-rose-700 border-rose-200"
              }`}>
                {alert.message}
              </div>
            )}
          </div>

          {editingDeadline ? (
            <div className="inline-flex items-center gap-1.5">
              <input
                type="date"
                value={deadlineValue}
                onChange={(e) => setDeadlineValue(e.target.value)}
                className="px-2 py-1 text-xs border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-300"
              />
              <button
                onClick={handleDeadlineSave}
                disabled={saving}
                className="p-1.5 bg-slate-800 text-white rounded-lg hover:bg-slate-900 transition-colors"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              </button>
              <button
                onClick={() => {
                  setEditingDeadline(false);
                  setDeadlineValue(deadlineIso ? new Date(deadlineIso).toISOString().split("T")[0] : "");
                }}
                className="p-1.5 bg-slate-100 text-slate-500 rounded-lg hover:bg-slate-200 transition-colors"
              >
                <ArrowLeft size={14} />
              </button>
            </div>
          ) : (
            <div
              className={`inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg border shadow-sm ${deadlineCountdown.badgeClass} ${canEditDeadline ? "cursor-pointer hover:shadow-md transition-all" : ""}`}
              onClick={() => canEditDeadline && setEditingDeadline(true)}
              title={canEditDeadline ? "Click to edit installation deadline" : "Admin only"}
            >
              <Timer size={13} className={deadlineCountdown.iconClass} />
              <span className={`text-[9px] font-medium whitespace-nowrap ${deadlineCountdown.labelClass}`}>
                Installation Deadline
              </span>
              <span className={`text-xs font-bold whitespace-nowrap ${deadlineCountdown.valueClass}`}>
                {deadlineCountdown.countdownLabel}
              </span>
              {deadlineCountdown.dateLabel ? (
                <span className={`text-[10px] font-semibold whitespace-nowrap opacity-80 ${deadlineCountdown.valueClass}`}>
                  · {deadlineCountdown.dateLabel}
                </span>
              ) : null}
            </div>
          )}
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
              {editingDeadline ? (
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={deadlineValue}
                    onChange={(e) => setDeadlineValue(e.target.value)}
                    className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-300"
                  />
                  <button
                    onClick={handleDeadlineSave}
                    disabled={saving}
                    className="p-1.5 bg-slate-800 text-white rounded-lg hover:bg-slate-900 transition-colors"
                  >
                    {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  </button>
                  <button
                    onClick={() => {
                      setEditingDeadline(false);
                      setDeadlineValue(deadlineIso ? new Date(deadlineIso).toISOString().split("T")[0] : "");
                    }}
                    className="p-1.5 bg-slate-100 text-slate-500 rounded-lg hover:bg-slate-200 transition-colors"
                  >
                    <ArrowLeft size={14} />
                  </button>
                </div>
              ) : (
                <div
                  className={`flex items-center gap-2.5 px-4 py-2 rounded-xl border shadow-sm ${deadlineCountdown.badgeClass} ${canEditDeadline ? 'cursor-pointer hover:shadow-md transition-all' : ''}`}
                  onClick={() => canEditDeadline && setEditingDeadline(true)}
                  title={canEditDeadline ? "Click to edit installation deadline" : "Admin only"}
                >
                  <Timer size={14} className={deadlineCountdown.iconClass} />
                  <div className="flex flex-col min-w-0">
                    <span className={`text-[9px] font-medium leading-none ${deadlineCountdown.labelClass}`}>
                      Installation Deadline
                    </span>
                    <span className={`text-xs font-bold leading-tight mt-0.5 ${deadlineCountdown.valueClass}`}>
                      {deadlineCountdown.countdownLabel}
                    </span>
                    {deadlineCountdown.dateLabel ? (
                      <span className={`text-[10px] font-semibold leading-tight mt-0.5 opacity-80 ${deadlineCountdown.valueClass}`}>
                        {deadlineCountdown.dateLabel}
                      </span>
                    ) : null}
                  </div>
                </div>
              )}
            </div>
            </div>
          </div>

          <div className="mb-6 prt-card p-6">
            <h2 className="text-sm font-bold text-slate-800 mb-4 border-b border-slate-100 pb-3 flex items-center gap-2">
              <FileText size={18} className="text-blue-600" /> Basic Information
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 md:gap-6 text-xs">
              <div>
                <div className="text-[10px] text-slate-500 font-medium mb-1">Order No</div>
                <div className="font-bold text-slate-800">{order.orderCode}</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-500 font-medium mb-1">Client Name</div>
                <div className="font-bold text-slate-800">{order.clientName || ""}</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-500 font-medium mb-1">Business Name</div>
                <div className="font-bold text-slate-800">{order.businessName || ""}</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-500 font-medium mb-1">Priority</div>
                <div className="font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded inline-block">{order.priority || "High"}</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-500 font-medium mb-1">Expected Completion Date</div>
                <div className="font-bold text-slate-800">{order.expected_completion_date ? new Date(order.expected_completion_date).toLocaleDateString("en-IN") : "TBD"}</div>
              </div>
            </div>
          </div>

          {client && (
            <div className="mb-6 prt-card p-6">
              <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
                <Sparkles size={18} className="text-rose-600" />
                <h2 className="text-sm font-bold text-slate-800">
                  Client Contact
                </h2>
              </div>
              <div className="flex flex-wrap gap-8 text-xs">
                <div>
                  <div className="text-[10px] text-slate-500 font-medium mb-1">Client Name</div>
                  <div className="font-bold text-slate-800">{client.name}</div>
                </div>
                {client.phone && (
                  <div>
                    <div className="text-[10px] text-slate-500 font-medium mb-1">Phone</div>
                    <div className="font-semibold text-slate-700">📞 {maskPhone(client.phone)}</div>
                  </div>
                )}
                {client.email && (
                  <div>
                    <div className="text-[10px] text-slate-500 font-medium mb-1">Email Address</div>
                    <div className="font-semibold text-slate-700">{maskEmail(client.email)}</div>
                  </div>
                )}
                {installationSiteAddress && (
                  <div className="flex-1 min-w-[200px]">
                    <div className="text-[10px] text-slate-500 font-medium mb-1">Installation Site Address</div>
                    <div className="font-medium text-slate-600 leading-relaxed">{installationSiteAddress}</div>
                  </div>
                )}
                {(order.requirements || order.notes || quotation?.notes) && (
                  <div className="flex-1 min-w-[200px]">
                    <div className="text-[10px] text-slate-500 font-medium mb-1">Requirements / Notes</div>
                    <div className="font-medium text-slate-600 leading-relaxed whitespace-pre-wrap">
                      {order.requirements || order.notes || quotation?.notes}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* View-Only Site Visit Banner staff portals only (admins already have full Site Visit access) */}
      {currentUserRole !== "Admin" && (
        <div className="mb-6 bg-indigo-50/80 border border-indigo-100 text-indigo-700 p-4 rounded-xl text-xs font-semibold flex items-center gap-3 shadow-sm">
          <Sparkles size={16} className="text-indigo-600 flex-shrink-0" />
          You now have view-only access to the Site Visit stage. Click the 'Site Visit' tab in the timeline above to view full location photos and measurement details!
        </div>
      )}

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">

        {/* LEFT COLUMN: Stage Outputs & Details (2/3 width) */}
        <div className="lg:col-span-2 space-y-8">






          {/* DESIGN + PRODUCTION FILES (Per Item) */}
          <div className="prt-card p-6">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
              <FileText size={18} className="text-emerald-600" />
              <h2 className="text-sm font-bold text-slate-800">
                Design &amp; Production Files
              </h2>
            </div>

            <p className="text-[11px] text-amber-800 font-semibold bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5 mb-2">
              {STAGE_FILE_ZIP_PREFERRED_NOTE}
            </p>
            <p className="text-[11px] text-slate-500 font-medium mb-4">{STAGE_FILE_SECTION_HINT}</p>

            {designItems.length > 0 ? (
              <div className="space-y-6">
                {designItems.map((item: any) => {
                  const designFiles: StageFile[] = item.designFiles || [];
                  const productionFiles: StageFile[] = item.productionFiles || [];
                  return (
                    <div key={item.id} className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-5">
                      <h3 className="font-bold text-slate-800 text-sm">{item.name}</h3>
                      <StageFileUsageBar usedBytes={sumStageFileBytes(item)} />

                      <div>
                        <h4 className="text-[11px] font-bold text-violet-700 uppercase tracking-wide mb-3">
                          Design Source Files
                        </h4>
                        {designFiles.length > 0 ? (
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            {designFiles.map((file) => (
                              <StageFileCard
                                key={file.id}
                                file={file}
                                accent="violet"
                                orderId={order.id}
                                kind="design"
                              />
                            ))}
                          </div>
                        ) : (
                          <div className="py-6 text-center text-xs text-slate-400 font-semibold flex flex-col items-center justify-center gap-2 border-2 border-dashed border-slate-200 rounded-xl bg-white">
                            <FileText size={20} className="text-slate-300" />
                            <span>No design source files for this item.</span>
                          </div>
                        )}
                      </div>

                      <div>
                        <h4 className="text-[11px] font-bold text-blue-700 uppercase tracking-wide mb-3">
                          Production Files
                        </h4>
                        {productionFiles.length > 0 ? (
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            {productionFiles.map((file) => (
                              <StageFileCard
                                key={file.id}
                                file={file}
                                accent="blue"
                                orderId={order.id}
                                kind="production"
                              />
                            ))}
                          </div>
                        ) : (
                          <div className="py-6 text-center text-xs text-slate-400 font-semibold flex flex-col items-center justify-center gap-2 border-2 border-dashed border-slate-200 rounded-xl bg-white">
                            <FileText size={20} className="text-slate-300" />
                            <span>No production files for this item.</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-12 text-center text-xs text-slate-400 font-semibold flex flex-col items-center justify-center gap-2 border-2 border-dashed border-slate-200 rounded-xl">
                <FileText size={24} className="text-slate-300" />
                <span>No design or production files uploaded yet.</span>
              </div>
            )}
          </div>

          {/* PRODUCTION NOTES */}
          <div className="prt-card p-6">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
              <AlertOctagon size={18} className="text-rose-600" />
              <h2 className="text-sm font-bold text-slate-800">
                Production Notes
              </h2>
            </div>
            {quotation?.notes || quotation?.terms ? (
              <div className="space-y-4">
                {quotation.notes && (
                  <div>
                    <h3 className="text-[10px] text-slate-500 font-medium mb-1.5">General Notes</h3>
                    <div className="text-xs text-slate-700 font-medium whitespace-pre-wrap bg-slate-50 p-4 rounded-xl border border-slate-100">
                      {quotation.notes}
                    </div>
                  </div>
                )}
                {quotation.terms && (
                  <div>
                    <h3 className="text-[10px] text-slate-500 font-medium mb-1.5">Terms & Conditions</h3>
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

          {/* MATERIALS CONSUMED + FINAL YIELD */}
          <ProductionMaterialsPanel orderId={order.id} canEdit={!!canEdit} />

        </div>

        {/* RIGHT COLUMN: Interactive Fabrication Checklist & Customer Info (1/3 width) */}
        <div className="space-y-8">

          {/* WORKSHOP PRODUCTION QUEUE CHECKLIST */}
          <div className="prt-card p-4 md:p-6 lg:sticky lg:top-6">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
              <CheckSquare size={18} className="text-blue-600" />
              <h2 className="text-sm font-bold text-slate-800">
                Workshop Production
              </h2>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed mb-5">
              Check off fabrication milestones as ACP structures and lettering progress.
            </p>

            <div className="space-y-3.5">
              {checklistItems.map((step, index) => {
                const isChecked = !!checklistProgress[step.id];
                return (
                  <div
                    key={step.id}
                    onClick={() => canEdit && handleCheckboxChange(step.id)}
                    className={`p-4 border rounded-xl flex items-start gap-3 select-none transition-all duration-200 touch-manipulation ${
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
                      <div className="text-xs font-bold leading-none mb-1 flex items-center gap-2 flex-wrap">
                        <span>{index + 1}. {step.label}</span>
                        {step.required === false && (
                          <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200">
                            Optional
                          </span>
                        )}
                      </div>
                      {step.description ? (
                        <div className="text-[10px] text-slate-500 font-semibold">{step.description}</div>
                      ) : null}
                    </div>
                  </div>
                );
              })}

              {customChecklistItems.map((step, index) => {
                const isChecked = step.checked;
                const displayIndex = checklistItems.length + index + 1;
                return (
                  <div
                    key={step.id}
                    onClick={() => canEdit && handleCheckboxChange(step.id)}
                    className={`p-4 border rounded-xl flex items-start gap-3 select-none transition-all duration-200 touch-manipulation ${
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
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold leading-none mb-1 flex items-center gap-2 flex-wrap">
                        <span>{displayIndex}. {step.label}</span>
                        <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200">
                          Extra
                        </span>
                      </div>
                    </div>
                    {canEdit && (
                      <button
                        type="button"
                        title="Remove this check"
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleRemoveCustomCheck(step.id);
                        }}
                        className="mt-0.5 p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {canEdit && (
              <div className="mt-4 pt-4 border-t border-slate-100 space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                  Add extra check
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newCustomLabel}
                    onChange={(e) => setNewCustomLabel(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void handleAddCustomCheck();
                      }
                    }}
                    placeholder="e.g. Touch up paint on edges"
                    disabled={saving}
                    className="flex-1 min-w-0 text-xs px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
                  />
                  <button
                    type="button"
                    onClick={() => void handleAddCustomCheck()}
                    disabled={saving || !newCustomLabel.trim()}
                    className="inline-flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Plus size={14} />
                    Add
                  </button>
                </div>
              </div>
            )}

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
