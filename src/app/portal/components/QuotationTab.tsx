"use client";

import React from "react";
import { Loader2 } from "lucide-react";
import { isQuotationVisibleToCustomer } from "@/features/quotations/utils/lineAmount";
import { QuotationDocument } from "@/features/quotations/components/QuotationDocument";
import type { InvoiceProfile } from "@/features/quotations/types/invoiceProfile";

export interface PortalQuotationOrder {
  businessName: string;
  clientName: string;
  workflow_type?: string;
  quoteDetails?: {
    quotationId?: string;
    status?: string;
    createdAt?: string;
    updatedAt?: string;
    /** Raw DB keys may appear after realtime merges. */
    created_at?: string;
    updated_at?: string;
    signageOptions?: any[];
    subtotal?: number;
    discount?: number;
    shipping?: number;
    tax?: number;
    grandTotal?: number;
    notes?: string;
    terms?: string;
    rejectionReason?: string | null;
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
  invoiceProfile?: InvoiceProfile | null;
  billingAddress?: string | null;
  customerCity?: string | null;
}

export function QuotationTab({
  order,
  siteVisitItems = [],
  showQuoteDeclineInput,
  setShowQuoteDeclineInput,
  quoteFeedback,
  setQuoteFeedback,
  updatingStatus,
  handleApproveQuote,
  handleDeclineQuote,
  layout = "card",
  invoiceProfile = null,
  billingAddress = null,
  customerCity = null,
}: QuotationTabProps) {
  const qd = order.quoteDetails || {};
  const isDesignFirst = order.workflow_type === "design_first";
  const quoteVisible = isQuotationVisibleToCustomer(qd.status);
  const approveCta = isDesignFirst
    ? "Approve this quotation to proceed to Production"
    : "Approve this quotation to proceed to Design";

  const billToName = [order.businessName, order.clientName]
    .filter(Boolean)
    .join(" - ");

  const content = (
    <>
      {!quoteVisible ? (
        <div className="flex flex-col items-center justify-center py-16 px-4 bg-slate-50 border border-slate-200 border-dashed rounded-2xl text-center">
          {layout === "portal-step" && (
            <div className="w-16 h-16 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mb-4">
              <span className="text-2xl">📊</span>
            </div>
          )}
          <h3 className="text-lg font-bold text-slate-800 mb-2">
            {qd.status === "Draft" && qd.rejectionReason 
              ? "Revising Quotation" 
              : "Quotation is being prepared"}
          </h3>
          <p className="text-sm text-slate-500 max-w-sm">
            {qd.status === "Draft" && qd.rejectionReason 
              ? "We are currently revising your quotation based on your feedback. You will be notified once the updated quotation is ready for your review."
              : "Our team is currently working on your quotation based on the site visit and requirements. You will be notified once it is ready for your review."}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          <QuotationDocument
            quotationId={qd.quotationId}
            quoteDate={
              qd.createdAt ||
              qd.updatedAt ||
              qd.created_at ||
              qd.updated_at ||
              new Date().toISOString()
            }
            showStatus={false}
            billToName={billToName || "—"}
            billToAddress={billingAddress}
            placeOfSupply={
              invoiceProfile?.placeOfSupplyDefault || customerCity || undefined
            }
            sections={qd.signageOptions || []}
            subtotal={qd.subtotal}
            discount={qd.discount}
            shipping={qd.shipping}
            tax={qd.tax}
            grandTotal={qd.grandTotal}
            notes={qd.notes}
            terms={qd.terms}
            invoiceProfile={invoiceProfile}
            siteVisitItems={siteVisitItems}
            showPrintButton
          />

          {qd.status === "Sent" && (
            <div className="quotation-no-print space-y-4 border border-slate-200 rounded-2xl bg-white p-5 shadow-sm">
              <p className="text-sm text-slate-600 font-medium">{approveCta}</p>

              {!showQuoteDeclineInput ? (
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    type="button"
                    onClick={handleApproveQuote}
                    disabled={updatingStatus === "approve"}
                    className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
                  >
                    {updatingStatus === "approve" ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : null}
                    Approve Quotation
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowQuoteDeclineInput(true)}
                    disabled={!!updatingStatus}
                    className="flex-1 inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                  >
                    Request Changes
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <textarea
                    value={quoteFeedback}
                    onChange={(e) => setQuoteFeedback(e.target.value)}
                    rows={4}
                    placeholder="Tell us what you’d like changed…"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-200"
                  />
                  <div className="flex flex-col sm:flex-row gap-3">
                    <button
                      type="button"
                      onClick={handleDeclineQuote}
                      disabled={updatingStatus === "decline" || !quoteFeedback.trim()}
                      className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-amber-600 px-4 py-3 text-sm font-bold text-white hover:bg-amber-700 disabled:opacity-60"
                    >
                      {updatingStatus === "decline" ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : null}
                      Submit Feedback
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowQuoteDeclineInput(false);
                        setQuoteFeedback("");
                      }}
                      disabled={!!updatingStatus}
                      className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-600 hover:bg-slate-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {(qd.status === "Approved" ||
            qd.status === "Rejected" ||
            qd.status === "Negotiation") && (
            <div className="quotation-no-print rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-600">
              {qd.status === "Approved"
                ? "You approved this quotation."
                : "Changes requested — our team will revise and resend."}
            </div>
          )}
        </div>
      )}
    </>
  );

  if (layout === "portal-step") {
    return content;
  }

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-sm">
      {content}
    </div>
  );
}
