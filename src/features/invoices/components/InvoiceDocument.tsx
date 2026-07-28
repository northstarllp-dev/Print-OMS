"use client";

import React from "react";
import {
  QuotationDocument,
  type QuotationDocumentProps,
} from "@/features/quotations/components/QuotationDocument";

export type InvoiceDocumentProps = Omit<
  QuotationDocumentProps,
  "quotationId" | "quoteDate" | "documentTitle" | "dateLabel"
> & {
  invoiceId?: string | null;
  invoiceDate?: string | Date | null;
};

/** Printable tax invoice — same layout as QuotationDocument with invoice labels. */
export function InvoiceDocument({
  invoiceId,
  invoiceDate,
  dueDate,
  showPrintButton = true,
  ...rest
}: InvoiceDocumentProps) {
  return (
    <QuotationDocument
      {...rest}
      quotationId={invoiceId}
      quoteDate={invoiceDate}
      dueDate={dueDate}
      documentTitle="INVOICE"
      dateLabel="Invoice Date"
      showPrintButton={showPrintButton}
      printButtonMode="split"
    />
  );
}
