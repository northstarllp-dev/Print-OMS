"use client";

import React from "react";
import { FileText } from "lucide-react";
import { isInvoiceVisibleToCustomer } from "@/features/invoices/utils/invoiceSecurity";
import { InvoiceDocument } from "@/features/invoices/components/InvoiceDocument";
import type { InvoiceProfile } from "@/features/quotations/types/invoiceProfile";

export interface PortalInvoiceDetails {
  invoiceId?: string;
  status?: string;
  invoiceDate?: string | null;
  dueDate?: string | null;
  signageOptions?: any[];
  subtotal?: number;
  discount?: number;
  shipping?: number;
  tax?: number;
  grandTotal?: number;
  notes?: string | null;
  terms?: string | null;
}

export interface InvoiceTabProps {
  order: {
    businessName: string;
    clientName: string;
  };
  invoiceDetails?: PortalInvoiceDetails | null;
  invoiceProfile?: InvoiceProfile | null;
  billingAddress?: string | null;
  customerCity?: string | null;
  layout?: "portal-step" | "card";
}

export function InvoiceTab({
  order,
  invoiceDetails = null,
  invoiceProfile = null,
  billingAddress = null,
  customerCity = null,
  layout = "card",
}: InvoiceTabProps) {
  const inv = invoiceDetails || {};
  const visible = isInvoiceVisibleToCustomer(inv.status);
  const billToName = [order.businessName, order.clientName]
    .filter(Boolean)
    .join(" - ");

  if (!visible) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 bg-slate-50 border border-slate-200 border-dashed rounded-2xl text-center">
        {layout === "portal-step" && (
          <div className="w-16 h-16 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mb-4">
            <FileText className="w-7 h-7" />
          </div>
        )}
        <h3 className="text-lg font-bold text-slate-800 mb-2">
          {inv.status === "Draft"
            ? "Invoice is being prepared"
            : "No invoice available yet"}
        </h3>
        <p className="text-sm text-slate-500 max-w-sm">
          {inv.status === "Draft"
            ? "Your invoice has been drafted and will appear here once our team sends it."
            : "An invoice will appear here after your quotation is approved and the invoice is issued."}
        </p>
      </div>
    );
  }

  return (
    <InvoiceDocument
      invoiceId={inv.invoiceId}
      invoiceDate={inv.invoiceDate}
      dueDate={inv.dueDate}
      status={inv.status}
      showStatus={false}
      billToName={billToName}
      billToAddress={billingAddress}
      placeOfSupply={invoiceProfile?.placeOfSupplyDefault || customerCity}
      sections={(inv.signageOptions || []) as any}
      subtotal={inv.subtotal}
      discount={inv.discount}
      shipping={inv.shipping}
      tax={inv.tax}
      grandTotal={inv.grandTotal}
      notes={inv.notes}
      terms={inv.terms}
      invoiceProfile={invoiceProfile}
      showPrintButton
    />
  );
}
