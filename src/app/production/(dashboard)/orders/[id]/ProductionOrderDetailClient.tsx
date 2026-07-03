"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { 
  ArrowLeft, CheckSquare, FileText, MapPin, 
  AlertOctagon, Check, Image as ImageIcon, Sparkles, Loader2, Save, Timer
} from "lucide-react";
import { updateProductionDetailsAction } from "@/features/orders/actions/orderActions";

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

interface ProductionOrderDetailClientProps {
  order: any;
  customers: any[];
  employees: any[];
  products: any[];
  quotation: any;
  siteVisitItems?: any[];
}

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

export function ProductionOrderDetailClient({
  order: initialOrder,
  customers,
  employees,
  products,
  quotation,
  siteVisitItems = []
}: ProductionOrderDetailClientProps) {
  const router = useRouter();
  const [order, setOrder] = useState(initialOrder);
  const [saving, setSaving] = useState(false);
  const [alert, setAlert] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const client = customers.find(c => c.id === order.customerId);

  // Fallbacks for sub-objects
  const pd = order.productionDetails || {
    procurementOfMaterials: false,
    acpAndAcrylicCutting: false,
    lightingAndWiring: false,
    qualityCheck: false
  };

  const svDetails = order.siteVisitDetails || {};
  const locations: LocationMeasurement[] = svDetails.locations || [];
  
  const dd = order.design || { proofUrl: "", status: "Draft" };
  const mockImage = order.imageMockup || dd.proofUrl;

  const handleCheckboxChange = async (key: "procurementOfMaterials" | "acpAndAcrylicCutting" | "lightingAndWiring" | "qualityCheck") => {
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
      await updateProductionDetailsAction(order.id, updatedPd);
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
    <div className="p-8 bg-slate-50/50 min-h-screen">
      {/* Top Navigation */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => router.push("/production/orders")}
          className="inline-flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-slate-600 text-xs font-bold shadow-xs hover:bg-slate-50 transition-colors"
        >
          <ArrowLeft size={14} /> Back to Queue
        </button>
        <span className="text-slate-300">/</span>
        <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">{order.orderCode}</span>
      </div>

      {/* Title block */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              {order.projectName}
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

          {/* DEADLINE PLACEHOLDER */}
          <div className="flex flex-col items-end">
            <span className="text-[10px] font-black text-rose-500 uppercase tracking-widest mb-1.5 flex items-center gap-1">
              Production Deadline
            </span>
            <div className="bg-gradient-to-r from-rose-500 to-rose-600 text-white px-4 py-2 rounded-xl text-xs font-black shadow-md flex items-center gap-2 border-b-2 border-rose-700">
              <Timer size={16} className="text-rose-100 animate-pulse" />
              24 Oct 2026
            </div>
          </div>
        </div>
      </div>

      <div className="mb-6 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider mb-4 border-b border-slate-100 pb-3 flex items-center gap-2">
          <FileText size={18} className="text-blue-600" /> Basic Information
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-6 text-xs">
          <div>
            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Order No</div>
            <div className="font-bold text-slate-800">{order.orderCode}</div>
          </div>
          <div>
            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Customer Name</div>
            <div className="font-bold text-slate-800">{client?.name || order.customerName || "—"}</div>
          </div>
          <div>
            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Project Name</div>
            <div className="font-bold text-slate-800">{order.projectName}</div>
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

      {/* CUSTOMER DETAIL CARD */}
      {client && (
        <div className="mb-6 bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm">
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

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        
        {/* LEFT COLUMN: Stage Outputs & Details (2/3 width) */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* SITE VISIT DETAILS */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
              <MapPin size={18} className="text-indigo-600" />
              <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider">
                Measurements
              </h2>
            </div>

            {siteVisitItems.length > 0 ? (
              <div className="space-y-4">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider">
                        <th className="py-2.5 px-4">Location / Name</th>
                        <th className="py-2.5 px-4">Dimensions (W × H)</th>
                        <th className="py-2.5 px-4">Depth</th>
                        <th className="py-2.5 px-4">Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {siteVisitItems.map((loc, idx) => (
                        <tr key={loc.id || idx}>
                          <td className="py-3 px-4 font-bold text-slate-800">{loc.name}</td>
                          <td className="py-3 px-4 font-medium text-slate-600">
                            {loc.width && loc.height ? `${loc.width}ft × ${loc.height}ft` : "—"}
                          </td>
                          <td className="py-3 px-4 font-medium text-slate-600">{loc.depth ? `${loc.depth}in` : "—"}</td>
                          <td className="py-3 px-4 font-medium text-slate-600">{loc.notes || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="py-6 text-center text-xs text-slate-400 font-semibold">
                No site visit locations or measurements specified. Default dimensions: {order.dimensions || "TBD"}
              </div>
            )}
          </div>

          {/* QUOTATION DETAILS */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <CheckSquare size={18} className="text-amber-600" />
                <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider">
                  Material Requirements (From Quotation)
                </h2>
              </div>
            </div>

            {signageOptions.length > 0 ? (
              <div className="space-y-5">
                <div className="overflow-x-auto space-y-6">
                  {signageOptions.map((section: any, sIdx: number) => {
                    const svItem = siteVisitItems.find(sv => sv.id === section.siteVisitItemId);
                    return (
                      <div key={sIdx} className="border border-slate-200 rounded-xl overflow-hidden">
                        <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 font-bold text-slate-800">
                          {svItem ? svItem.name : section.itemLabel}
                        </div>
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="bg-white border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider">
                              <th className="py-2.5 px-4 w-1/2">Material Description</th>
                              <th className="py-2.5 px-4">Required Quantity</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 bg-white">
                            {(section.lines || []).map((item: any, idx: number) => {
                              const qty = item.pricingType === "per_sqft" ? (item.quantity * (item.totalSqFt || 1)) : item.quantity;
                              return (
                                <tr key={item.id || idx}>
                                  <td className="py-3 px-4 font-bold text-slate-800">{item.description}</td>
                                  <td className="py-3 px-4 font-semibold text-slate-700">
                                    {qty} {item.pricingType === "per_sqft" ? "Sq Ft" : item.unit || "Nos"}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="py-6 text-center text-xs text-slate-400 font-semibold">
                No detailed quotation entries found for this order. Project Budget: ₹{order.budget?.toLocaleString("en-IN")}
              </div>
            )}
          </div>

          {/* FINAL PRODUCTION FILES (Per Item) */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm">
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
          <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm">
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
          <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm sticky top-6">
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
                    onClick={() => !saving && handleCheckboxChange(step.key as any)}
                    className={`p-4 border rounded-xl flex items-start gap-3 cursor-pointer select-none transition-all duration-200 ${
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
