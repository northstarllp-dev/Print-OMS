"use client";

import React from "react";
import { Check, Info, Loader2 } from "lucide-react";
import { formatSiteMeasurementLabel } from "@/features/orders/actions/siteVisitMapper";
import {
  calcLineAmount,
  getLineMeasurement,
  isQuotationVisibleToCustomer,
  normalizePricingType,
} from "@/features/quotations/utils/lineAmount";

export interface PortalQuotationOrder {
  businessName: string;
  clientName: string;
  workflow_type?: string;
  quoteDetails?: {
    quotationId?: string;
    status?: string;
    signageOptions?: any[];
    subtotal?: number;
    discount?: number;
    shipping?: number;
    tax?: number;
    grandTotal?: number;
    notes?: string;
    terms?: string;
  } | null;
}

export interface QuotationTabProps {
  order: PortalQuotationOrder;
  products: any[];
  siteVisitItems?: any[];
  setSelectedProductInfo: (prod: any) => void;
  showQuoteDeclineInput: boolean;
  setShowQuoteDeclineInput: (show: boolean) => void;
  quoteFeedback: string;
  setQuoteFeedback: (val: string) => void;
  updatingStatus: string | null;
  handleApproveQuote: () => Promise<void>;
  handleDeclineQuote: () => Promise<void>;
  /** portal-step = multi-order wizard; card = single-order detail tab */
  layout?: "portal-step" | "card";
}

function statusBadgeClass(status?: string) {
  if (status === "Approved") return "bg-emerald-50 border-emerald-200 text-emerald-700";
  if (status === "Rejected" || status === "Negotiation") return "bg-amber-50 border-amber-200 text-amber-700";
  if (status === "Sent") return "bg-blue-50 border-blue-200 text-blue-700";
  return "bg-slate-100 border-slate-200 text-slate-600";
}

function statusLabel(status?: string) {
  if (status === "Rejected" || status === "Negotiation") return "Sent for Revision";
  return status || "Pending";
}

export function QuotationTab({
  order,
  products,
  siteVisitItems = [],
  setSelectedProductInfo,
  showQuoteDeclineInput,
  setShowQuoteDeclineInput,
  quoteFeedback,
  setQuoteFeedback,
  updatingStatus,
  handleApproveQuote,
  handleDeclineQuote,
  layout = "card",
}: QuotationTabProps) {
  const qd = order.quoteDetails || {};
  const isDesignFirst = order.workflow_type === "design_first";
  const quoteVisible = isQuotationVisibleToCustomer(qd.status);
  const approveCta = isDesignFirst
    ? "Approve this quotation to proceed to Production"
    : "Approve this quotation to proceed to Design";

  const content = (
    <>
      {!quoteVisible ? (
        <div className="flex flex-col items-center justify-center py-16 px-4 bg-slate-50 border border-slate-200 border-dashed rounded-2xl text-center">
          {layout === "portal-step" && (
            <div className="w-16 h-16 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mb-4">
              <span className="text-2xl">📊</span>
            </div>
          )}
          <h3 className="text-lg font-bold text-slate-800 mb-2">Quotation is being prepared</h3>
          <p className="text-sm text-slate-500 max-w-sm">
            Our team is currently working on your quotation based on the site visit and requirements.
            You will be notified once it is ready for your review.
          </p>
        </div>
      ) : qd.signageOptions && qd.signageOptions.length > 0 ? (
        <div className="space-y-6">
          <div
            className={`bg-slate-50 border border-slate-200 rounded-2xl p-4 grid gap-4 text-xs ${
              layout === "portal-step" ? "grid-cols-2 md:grid-cols-4" : "grid-cols-2 md:grid-cols-3"
            }`}
          >
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase block">Quote ID</span>
              <span className="font-mono font-bold text-slate-800">{qd.quotationId || "—"}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase block">Client & Business</span>
              <span className="font-bold text-slate-800">
                {order.businessName} - {order.clientName}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase block">Status</span>
              <span
                className={`inline-block text-[9px] font-black uppercase px-2 py-0.5 rounded-md border ${statusBadgeClass(qd.status)}`}
              >
                {statusLabel(qd.status)}
              </span>
            </div>
          </div>

          <div className="space-y-5">
            {qd.signageOptions.map((section: any, sIdx: number) => {
              const itemTotal = (section.lines || []).reduce((sum: number, line: any) => {
                return sum + calcLineAmount(line) * (1 + (line.gstRate || 0) / 100);
              }, 0);
              const svItem = siteVisitItems.find((sv: any) => sv.id === section.siteVisitItemId);
              const measurementLabel = formatSiteMeasurementLabel(svItem);

              return (
                <div
                  key={sIdx}
                  className="border border-slate-200 rounded-2xl bg-white overflow-hidden shadow-sm"
                >
                  <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs font-black text-slate-800 uppercase tracking-wider">
                        {section.itemLabel}
                      </span>
                      {measurementLabel && (
                        <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                          {measurementLabel}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-slate-400 font-black uppercase">
                        Total (incl. GST):
                      </span>
                      <span className="text-xs font-black text-blue-700 font-mono">
                        ₹{itemTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead>
                        <tr className="bg-slate-50/50 border-b border-slate-200 text-[10px] text-slate-400 font-black uppercase tracking-wider">
                          <th className="px-4 py-2.5">Item Description</th>
                          <th className="text-center px-4 py-2.5">Unit</th>
                          <th className="text-center px-4 py-2.5">Measurement/Qty</th>
                          <th className="text-right px-4 py-2.5">Rate</th>
                          <th className="text-center px-4 py-2.5">GST</th>
                          <th className="text-right px-4 py-2.5">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium text-slate-600">
                        {(section.lines || []).map((line: any, lIdx: number) => {
                          const lineAmt = calcLineAmount(line) * (1 + (line.gstRate || 0) / 100);
                          const measurement = getLineMeasurement(line);
                          const pricingType = normalizePricingType(line.pricingType);

                          return (
                            <tr key={lIdx} className="hover:bg-slate-50/30">
                              <td className="px-4 py-3 text-slate-800 font-bold">
                                <div className="flex items-center gap-1.5">
                                  <span>{line.description}</span>
                                  {line.productId && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const prod = products.find((p: any) => p.id === line.productId);
                                        if (prod) setSelectedProductInfo(prod);
                                      }}
                                      className="p-0.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors shrink-0"
                                      title="Product Details"
                                    >
                                      <Info size={12} className="stroke-[2.5]" />
                                    </button>
                                  )}
                                </div>
                              </td>
                              <td className="text-center px-4 py-3 capitalize">
                                {pricingType.replace("per_", "")}
                              </td>
                              <td className="text-center px-4 py-3 font-mono">
                                {measurement}{" "}
                                {pricingType === "per_sqft" ? line.unit || "sqft" : line.unit || "nos"}
                              </td>
                              <td className="text-right px-4 py-3 font-mono">
                                ₹{line.unitPrice.toLocaleString("en-IN")}
                              </td>
                              <td className="text-center px-4 py-3 font-mono">{line.gstRate}%</td>
                              <td className="text-right px-4 py-3 font-mono text-slate-800 font-bold">
                                ₹{lineAmt.toLocaleString("en-IN", {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="bg-[#f8fafc] border border-slate-200 rounded-3xl p-6 space-y-4 max-w-md ml-auto">
            <div className="flex justify-between items-center text-xs font-bold text-slate-500 uppercase tracking-wider pb-3 border-b border-slate-200/50">
              <span>Subtotal</span>
              <span className="font-mono text-slate-800">
                ₹{(qd.subtotal || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </span>
            </div>
            {(qd.discount || 0) > 0 && (
              <div className="flex justify-between items-center text-xs font-bold text-slate-500 uppercase tracking-wider pb-3 border-b border-slate-200/50">
                <span>Discount</span>
                <span className="font-mono text-rose-600">
                  - ₹{(qd.discount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </span>
              </div>
            )}
            {(qd.shipping || 0) > 0 && (
              <div className="flex justify-between items-center text-xs font-bold text-slate-500 uppercase tracking-wider pb-3 border-b border-slate-200/50">
                <span>Shipping</span>
                <span className="font-mono text-slate-800">
                  ₹{(qd.shipping || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </span>
              </div>
            )}
            <div className="flex justify-between items-center text-xs font-bold text-slate-500 uppercase tracking-wider pb-3 border-b border-slate-200/50">
              <span>Tax Amount</span>
              <span className="font-mono text-slate-800">
                ₹{(qd.tax || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-slate-200">
              <span className="font-black text-slate-900 text-sm uppercase tracking-wider">Total</span>
              <span className="font-black text-[#0f172a] text-lg font-mono">
                ₹{(qd.grandTotal || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {(qd.notes || qd.terms) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-200 text-xs text-slate-500 text-left">
              {qd.notes && (
                <div>
                  <span className="font-bold text-slate-700 block mb-1">Notes</span>
                  <p className="bg-slate-50 border border-slate-100 rounded-xl p-3 leading-relaxed">
                    {qd.notes}
                  </p>
                </div>
              )}
              {qd.terms && (
                <div>
                  <span className="font-bold text-slate-700 block mb-1">Terms & Conditions</span>
                  <p className="bg-slate-50 border border-slate-100 rounded-xl p-3 leading-relaxed">
                    {qd.terms}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-12 text-gray-500">
          <p className="text-lg">Quotation is being prepared.</p>
          <p className="text-sm mt-2">Check back later for updates!</p>
        </div>
      )}

      {qd.status === "Rejected" || qd.status === "Negotiation" ? (
        <div className="mt-8 bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
          <div className="text-xs text-amber-850">
            <span className="font-bold">Sent for Revision:</span> We have received your feedback and are
            revising the quotation. We will notify you once the revised quotation is ready for your review.
          </div>
        </div>
      ) : qd.status === "Sent" ? (
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
          <p className="text-xs font-bold text-[#1E40AF]">{approveCta}</p>
          {showQuoteDeclineInput ? (
            <div className="space-y-2">
              <textarea
                rows={3}
                value={quoteFeedback}
                onChange={(e) => setQuoteFeedback(e.target.value)}
                placeholder="Your revision feedback..."
                className="w-full p-2.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-red-500 bg-white"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => setShowQuoteDeclineInput(false)}
                  className="px-3 py-1.5 border border-slate-200 text-slate-500 rounded-lg text-xs font-bold bg-white"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeclineQuote}
                  disabled={!quoteFeedback.trim() || !!updatingStatus}
                  className="px-3.5 py-1.5 bg-red-600 text-white rounded-lg text-xs font-bold disabled:opacity-50"
                >
                  Submit
                </button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={() => setShowQuoteDeclineInput(true)}
                className="px-4 py-2 border border-slate-300 bg-white text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-50"
              >
                Decline / Revise
              </button>
              <button
                onClick={handleApproveQuote}
                disabled={!!updatingStatus}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 flex items-center gap-1.5 disabled:opacity-50"
              >
                {updatingStatus === "quote-approve" ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <Check size={13} />
                )}{" "}
                Approve Quotation
              </button>
            </div>
          )}
        </div>
      ) : null}

      {qd.status === "Approved" && (
        <div className="mt-8 bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center gap-2">
          <Check size={16} className="text-emerald-600 stroke-[2.5]" />
          <span className="text-sm font-bold text-emerald-700">Quotation Approved</span>
        </div>
      )}
    </>
  );

  if (layout === "portal-step") {
    return <div className="space-y-6">{content}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-gray-200 p-8 shadow-sm">
        <div className="flex items-start justify-between mb-8">
          <div>
            <h2 className="text-2xl font-extrabold text-gray-900">Quotation</h2>
            <p className="text-sm text-gray-500 mt-2">Review pricing and approve to proceed.</p>
          </div>
          <span className={`px-3 py-1 rounded-full text-xs font-bold border ${statusBadgeClass(qd.status)}`}>
            {statusLabel(qd.status)}
          </span>
        </div>
        {content}
      </div>
    </div>
  );
}
