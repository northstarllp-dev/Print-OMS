"use client";

import React from "react";
import { Download, Printer } from "lucide-react";
import {
  hasBankDetails,
  type InvoiceProfile,
} from "@/features/quotations/types/invoiceProfile";
import {
  amountToIndianWords,
  formatInr,
  formatQuoteDate,
  parseTermsLines,
} from "@/features/quotations/utils/amountInWords";
import {
  buildTaxSummaryRows,
  flattenQuotationLines,
  type QuotationDocSection,
} from "@/features/quotations/utils/quotationDocumentMath";
import { getLineMeasurement } from "@/features/quotations/utils/lineAmount";
import { Logo } from "@/components/ui/Logo";

export interface QuotationDocumentProps {
  quotationId?: string | null;
  quoteDate?: string | Date | null;
  /** Optional due date (shown on invoices). */
  dueDate?: string | Date | null;
  status?: string | null;
  /** When false, omit status line (customer PDF look). Default true for builder preview. */
  showStatus?: boolean;
  /** Document heading. Default "QUOTATION". */
  documentTitle?: string;
  /** Label above the date. Default "Quote Date". */
  dateLabel?: string;
  billToName: string;
  billToAddress?: string | null;
  placeOfSupply?: string | null;
  sections: QuotationDocSection[];
  subtotal?: number;
  discount?: number;
  shipping?: number;
  installationCharges?: number;
  tax?: number;
  grandTotal?: number;
  notes?: string | null;
  terms?: string | null;
  invoiceProfile?: InvoiceProfile | null;
  siteVisitItems?: any[];
  /** Show print button (hidden in print media). */
  showPrintButton?: boolean;
  /**
   * combined = one "Print / Save as PDF" button (default).
   * split = separate Print + Download PDF buttons (invoice UX).
   */
  printButtonMode?: "combined" | "split";
  className?: string;
}

export function QuotationDocument({
  quotationId,
  quoteDate,
  dueDate,
  status,
  showStatus = true,
  documentTitle = "QUOTATION",
  dateLabel = "Quote Date",
  billToName,
  billToAddress,
  placeOfSupply,
  sections,
  subtotal = 0,
  discount = 0,
  shipping = 0,
  installationCharges = 0,
  tax = 0,
  grandTotal = 0,
  notes,
  terms,
  invoiceProfile,
  siteVisitItems = [],
  showPrintButton = true,
  printButtonMode = "combined",
  className = "",
}: QuotationDocumentProps) {
  const taxSplit = invoiceProfile?.taxSplit || "cgst_sgst";
  const lines = flattenQuotationLines(sections, taxSplit, siteVisitItems);

  const rawGst = lines.reduce((s, l) => {
    return s + (taxSplit === "igst" ? l.igstAmount : l.cgstAmount + l.sgstAmount);
  }, 0);
  const taxScale = rawGst > 0 ? tax / rawGst : 1;
  const taxRows = buildTaxSummaryRows(lines, taxSplit, taxScale);

  // Prefer stored aggregates when present; recompute display subtotal from visible lines
  // so blank zero-rows don't distort the printed table vs summary.
  const displaySubtotal =
    lines.length > 0
      ? Math.round(lines.reduce((s, l) => s + l.preTax, 0) * 100) / 100
      : subtotal;
  const taxTotalFromRows = Math.round(
    taxRows.reduce((s, r) => s + r.amount, 0) * 100
  ) / 100;
  const displayGrandTotal =
    Math.round(
      (displaySubtotal -
        Math.max(0, discount) +
        (taxRows.length > 0 ? taxTotalFromRows : tax) +
        Math.max(0, installationCharges) +
        Math.max(0, shipping)) *
      100
    ) / 100;
  // Prefer server grand_total when it matches visible math; else use recomputed.
  const totalForWords =
    Math.abs((grandTotal || 0) - displayGrandTotal) < 0.02
      ? grandTotal || displayGrandTotal
      : displayGrandTotal;

  const resolvedPlace =
    placeOfSupply || invoiceProfile?.placeOfSupplyDefault || "";

  const brand =
    invoiceProfile?.brandName || invoiceProfile?.legalName || "Quotation";
  const legalName = invoiceProfile?.legalName;
  const bank = invoiceProfile?.bank;
  const termsLines = parseTermsLines(terms);
  const colCount = taxSplit === "cgst_sgst" ? 8 : 7;
  const printTargetRef = React.useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    const printRoot = printTargetRef.current;
    if (!printRoot || typeof document === "undefined") return;

    const iframe = document.createElement("iframe");
    iframe.setAttribute("aria-hidden", "true");
    iframe.style.cssText =
      "position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;pointer-events:none";
    document.body.appendChild(iframe);

    const doc = iframe.contentDocument;
    const win = iframe.contentWindow;
    if (!doc || !win) {
      iframe.remove();
      return;
    }

    const stylesheetTags = Array.from(
      document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')
    )
      .map((link) => link.outerHTML)
      .join("\n");

    const inlineStyleTags = Array.from(document.querySelectorAll("style"))
      .map((style) => style.outerHTML)
      .join("\n");

    const htmlClass = document.documentElement.className;
    const bodyClass = document.body.className;

    const printTitle = [documentTitle, quotationId].filter(Boolean).join(" ");

    doc.open();
    doc.write(`<!DOCTYPE html>
<html lang="en" class="${htmlClass}">
<head>
  <meta charset="utf-8" />
  <title>${printTitle.replace(/</g, "")}</title>
  ${stylesheetTags}
  ${inlineStyleTags}
  <style>${QUOTATION_IFRAME_PRINT_CSS}</style>
</head>
<body class="${bodyClass}">
  <div class="quotation-document-root">${printRoot.innerHTML}</div>
</body>
</html>`);
    doc.close();

    const cleanup = () => {
      iframe.remove();
    };
    win.onafterprint = cleanup;

    const runPrint = async () => {
      try {
        await doc.fonts.ready;
      } catch {
        /* fonts API unavailable */
      }
      win.focus();
      win.print();
      setTimeout(cleanup, 2000);
    };

    setTimeout(() => {
      void runPrint();
    }, 400);
  };

  return (
    <div className={`quotation-document-root min-w-0 max-w-full ${className}`}>
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 4mm;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            width: 210mm !important;
            background: white !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          /* Hide everything except the quotation sheet */
          body * { visibility: hidden !important; }
          .quotation-document-root,
          .quotation-document-root * { visibility: visible !important; }
          .quotation-document-root {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            /* Lock to A4 content width so phone/tablet print matches laptop */
            width: 202mm !important;
            max-width: 202mm !important;
            min-width: 202mm !important;
            margin: 0 !important;
            padding: 0 !important;
            box-sizing: border-box !important;
            overflow: visible !important;
            background: white !important;
          }
          .quotation-sheet {
            border: none !important;
            box-shadow: none !important;
            overflow: visible !important;
            width: 100% !important;
          }
          .quotation-no-print { display: none !important; }
          .quotation-mobile-only { display: none !important; }
          .quotation-print-table {
            display: block !important;
            overflow: visible !important;
            width: 100% !important;
          }
          .quotation-print-table > table {
            width: 100% !important;
            min-width: 0 !important;
          }
          .quotation-logo-mobile { display: none !important; }
          .quotation-logo-desktop { display: block !important; }

          /* Force laptop/desktop layout regardless of device viewport */
          .quotation-sheet-header {
            display: flex !important;
            flex-direction: row !important;
            justify-content: space-between !important;
            align-items: flex-start !important;
            gap: 1.5rem !important;
            padding: 1rem 1.25rem !important;
          }
          .quotation-sheet-title {
            font-size: 1.875rem !important;
            line-height: 2.25rem !important;
            text-align: right !important;
          }
          .quotation-sheet-meta {
            display: grid !important;
            grid-template-columns: 1fr 1fr !important;
            gap: 1rem !important;
            padding: 0.75rem 1.25rem !important;
          }
          .quotation-sheet-meta-right {
            text-align: right !important;
          }
          .quotation-sheet-section {
            padding: 0.75rem 1.25rem !important;
          }
          .quotation-sheet-bank-grid {
            display: grid !important;
            grid-template-columns: 1fr 1fr !important;
            column-gap: 2rem !important;
          }
        }
      `}</style>
      {showPrintButton && (
        <div className="quotation-no-print mb-3 flex flex-col sm:flex-row justify-stretch sm:justify-end gap-2">
          {printButtonMode === "split" ? (
            <>
              <button
                type="button"
                onClick={handlePrint}
                className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50"
              >
                <Printer size={14} />
                Print
              </button>
              <button
                type="button"
                onClick={handlePrint}
                className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-lg border border-slate-800 bg-slate-900 px-3 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-slate-800"
                title="Opens print dialog choose Save as PDF"
              >
                <Download size={14} />
                Download PDF
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50"
            >
              <Printer size={14} />
              Print / Save as PDF
            </button>
          )}
        </div>
      )}

      <div ref={printTargetRef}>
      <table className="w-full border-collapse min-w-0">
        <tbody>
          <tr>
            <td className="p-0 align-top min-w-0">
              <article className="quotation-sheet bg-white text-[#1a1a1a] border border-slate-200 shadow-sm overflow-hidden min-w-0">
                {/* Header */}
                <header className="quotation-sheet-header flex flex-col sm:flex-row gap-4 sm:gap-6 justify-between p-4 sm:p-6 lg:p-8 border-b border-slate-200">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="flex flex-col min-w-0">
                        <div className="mb-2 overflow-visible">
                          <div className="quotation-logo-mobile sm:hidden">
                            <Logo width={200} height={48} align="left" applyScale={false} />
                          </div>
                          <div className="quotation-logo-desktop hidden sm:block">
                            <Logo width={320} height={72} align="left" applyScale={false} />
                          </div>
                        </div>
                        {legalName && legalName !== brand && (
                          <p className="text-xs font-semibold text-slate-600 mt-0.5 break-words">
                            {legalName}
                          </p>
                        )}
                      </div>
                    </div>
                    {invoiceProfile?.address && (
                      <p className="mt-3 text-[11px] leading-relaxed text-slate-600 whitespace-pre-line max-w-md break-words">
                        {invoiceProfile.address}
                      </p>
                    )}
                    <div className="mt-2 space-y-0.5 text-[11px] text-slate-600 break-words">
                      {invoiceProfile?.gstin && (
                        <p>
                          <span className="font-semibold text-slate-800">GSTIN</span>{" "}
                          {invoiceProfile.gstin}
                        </p>
                      )}
                      {invoiceProfile?.email && <p className="break-all">{invoiceProfile.email}</p>}
                      {invoiceProfile?.website && <p className="break-all">{invoiceProfile.website}</p>}
                    </div>
                  </div>

                  <div className="quotation-sheet-meta-right sm:text-right shrink-0">
                    <p className="quotation-sheet-title text-xl sm:text-2xl lg:text-3xl font-black tracking-wide text-[#1e293b]">
                      {documentTitle}
                    </p>
                    <p className="mt-1 text-sm font-mono font-bold text-slate-700 break-all">
                      {quotationId || ""}
                    </p>
                    {showStatus && status && (
                      <p className="mt-2 text-[10px] font-bold uppercase tracking-wider text-slate-500 quotation-no-print">
                        Status: {status}
                      </p>
                    )}
                  </div>
                </header>

                {/* Meta */}
                <section className="quotation-sheet-meta grid grid-cols-1 sm:grid-cols-2 gap-4 px-4 sm:px-6 lg:px-8 py-4 sm:py-5 border-b border-slate-200">
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Bill To
                    </p>
                    <p className="mt-1 text-sm font-bold text-slate-900 break-words">{billToName}</p>
                    {billToAddress && (
                      <p className="mt-1 text-xs text-slate-600 whitespace-pre-line break-words">
                        {billToAddress}
                      </p>
                    )}
                  </div>
                  <div className="quotation-sheet-meta-right sm:text-right space-y-2">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        {dateLabel}
                      </p>
                      <p
                        className="mt-0.5 text-sm font-semibold text-slate-800"
                        suppressHydrationWarning
                      >
                        {formatQuoteDate(quoteDate)}
                      </p>
                    </div>
                    {dueDate && (
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Due Date
                        </p>
                        <p
                          className="mt-0.5 text-sm font-semibold text-slate-800"
                          suppressHydrationWarning
                        >
                          {formatQuoteDate(dueDate)}
                        </p>
                      </div>
                    )}
                    {resolvedPlace && (
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Place of Supply
                        </p>
                        <p className="mt-0.5 text-sm font-semibold text-slate-800">
                          {resolvedPlace}
                        </p>
                      </div>
                    )}
                  </div>
                </section>

                {/* Mobile / tablet line cards screen only */}
                <div className="quotation-mobile-only lg:hidden print:hidden px-4 py-4 space-y-3 border-b border-slate-200">
                  {lines.length === 0 ? (
                    <p className="py-6 text-center text-sm text-slate-400">No line items</p>
                  ) : (
                    lines.map((line) => (
                      <div
                        key={`m-${line.index}-${line.description}`}
                        className="rounded-xl border border-slate-200 bg-slate-50/80 p-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                              #{line.index}
                            </p>
                            <p className="mt-0.5 text-sm font-bold text-slate-900 break-words">
                              {line.description}
                            </p>
                            {line.detailLines.map((detail, i) => (
                              <p key={i} className="mt-0.5 text-[11px] text-slate-500 leading-snug break-words">
                                {detail}
                              </p>
                            ))}
                          </div>
                          <p className="shrink-0 text-sm font-extrabold tabular-nums text-slate-900">
                            {formatInr(line.preTax)}
                          </p>
                        </div>
                        <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-slate-600">
                          <p>
                            <span className="text-slate-400">HSN: </span>
                            {line.hsn || ""}
                          </p>
                          <p className="text-right tabular-nums">
                            <span className="text-slate-400">Qty: </span>
                            {formatQty(line.qty)}
                          </p>
                          <p className="tabular-nums">
                            <span className="text-slate-400">Rate: </span>
                            {formatInr(line.rate)}
                          </p>
                          {taxSplit === "cgst_sgst" ? (
                            <p className="text-right tabular-nums">
                              <span className="text-slate-400">GST: </span>
                              {formatInr((line.cgstAmount + line.sgstAmount) * taxScale)}
                            </p>
                          ) : (
                            <p className="text-right tabular-nums">
                              <span className="text-slate-400">IGST: </span>
                              {formatInr(line.igstAmount * taxScale)}
                            </p>
                          )}
                        </div>
                      </div>
                    ))
                  )}

                  <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-1.5 text-[12px]">
                    <p className="text-[11px] font-bold text-slate-800 leading-relaxed">
                      Total In Words:{" "}
                      <span className="italic font-semibold text-slate-700">
                        Indian Rupee {amountToIndianWords(totalForWords)}
                      </span>
                    </p>
                    <div className="flex justify-between gap-3 pt-1">
                      <span className="text-slate-600">Sub Total</span>
                      <span className="font-semibold tabular-nums">{formatInr(displaySubtotal)}</span>
                    </div>
                    {discount > 0 && (
                      <div className="flex justify-between gap-3">
                        <span className="text-slate-600">Discount</span>
                        <span className="font-semibold tabular-nums">−{formatInr(discount)}</span>
                      </div>
                    )}
                    {taxRows.map((row) => (
                      <div key={`m-${row.label}`} className="flex justify-between gap-3">
                        <span className="text-slate-600">{row.label}</span>
                        <span className="font-semibold tabular-nums">{formatInr(row.amount)}</span>
                      </div>
                    ))}
                    {installationCharges > 0 && (
                      <div className="flex justify-between gap-3">
                        <span className="text-slate-600">Installation</span>
                        <span className="font-semibold tabular-nums">{formatInr(installationCharges)}</span>
                      </div>
                    )}
                    {shipping > 0 && (
                      <div className="flex justify-between gap-3">
                        <span className="text-slate-600">Shipping</span>
                        <span className="font-semibold tabular-nums">{formatInr(shipping)}</span>
                      </div>
                    )}
                    <div className="flex justify-between gap-3 rounded-lg bg-[#eef1f4] px-2.5 py-2 mt-1">
                      <span className="font-bold text-slate-900">Total</span>
                      <span className="font-bold tabular-nums">{formatInr(totalForWords)}</span>
                    </div>
                    {notes?.trim() && (
                      <div className="pt-2 border-t border-slate-100">
                        <p className="font-bold text-slate-800 mb-1">Notes</p>
                        <p className="whitespace-pre-line text-slate-600 text-[11px] break-words">
                          {notes}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Desktop / print lines table */}
                <div className="quotation-print-table hidden lg:block print:block overflow-x-auto print:overflow-visible px-0">
                  <table className="w-full min-w-[720px] print:min-w-0 border-collapse text-[11px]">
                    <thead>
                      <tr className="bg-[#334155] text-white">
                        <th className="px-2.5 py-2.5 text-left font-bold w-8 border-b border-[#334155]">
                          #
                        </th>
                        <th className="px-2.5 py-2.5 text-left font-bold border-b border-[#334155]">
                          Item &amp; Description
                        </th>
                        <th className="px-2.5 py-2.5 text-left font-bold w-16 border-b border-[#334155]">
                          HSN
                        </th>
                        <th className="px-2.5 py-2.5 text-right font-bold w-14 border-b border-[#334155]">
                          Qty / Measurement
                        </th>
                        <th className="px-2.5 py-2.5 text-right font-bold w-20 border-b border-[#334155]">
                          Rate
                        </th>
                        {taxSplit === "cgst_sgst" ? (
                          <>
                            <th className="px-2.5 py-2.5 text-right font-bold w-[72px] border-b border-[#334155]">
                              CGST
                            </th>
                            <th className="px-2.5 py-2.5 text-right font-bold w-[72px] border-b border-[#334155]">
                              SGST
                            </th>
                          </>
                        ) : (
                          <th className="px-2.5 py-2.5 text-right font-bold w-[72px] border-b border-[#334155]">
                            IGST
                          </th>
                        )}
                        <th className="px-2.5 py-2.5 text-right font-bold w-24 border-b border-[#334155]">
                          Amount
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {lines.length === 0 ? (
                        <tr>
                          <td
                            colSpan={colCount}
                            className="px-2.5 py-8 text-center text-slate-400 border-b border-slate-200"
                          >
                            No line items
                          </td>
                        </tr>
                      ) : (
                        lines.map((line) => (
                          <tr
                            key={`${line.index}-${line.description}`}
                            className="align-top border-b border-slate-200"
                          >
                            <td className="px-2.5 py-2.5 text-slate-500">{line.index}</td>
                            <td className="px-2.5 py-2.5">
                              <p className="font-bold text-[#111]">{line.description}</p>
                              {line.detailLines.map((detail, i) => (
                                <p key={i} className="mt-0.5 text-[10px] text-slate-500 leading-snug">
                                  {detail}
                                </p>
                              ))}
                            </td>
                            <td className="px-2.5 py-2.5 text-slate-700">
                              {line.hsn || ""}
                            </td>
                            <td className="px-2.5 py-2.5 text-right tabular-nums text-slate-800">
                              {formatQty(line.qty)}
                            </td>
                            <td className="px-2.5 py-2.5 text-right tabular-nums text-slate-800">
                              {formatInr(line.rate)}
                            </td>
                            {taxSplit === "cgst_sgst" ? (
                              <>
                                <td className="px-2.5 py-2.5 text-right tabular-nums text-slate-800">
                                  <div>{formatInr(line.cgstAmount * taxScale)}</div>
                                  <div className="text-[9px] text-slate-400 leading-none mt-0.5">
                                    {formatPct(line.cgstRate)}
                                  </div>
                                </td>
                                <td className="px-2.5 py-2.5 text-right tabular-nums text-slate-800">
                                  <div>{formatInr(line.sgstAmount * taxScale)}</div>
                                  <div className="text-[9px] text-slate-400 leading-none mt-0.5">
                                    {formatPct(line.sgstRate)}
                                  </div>
                                </td>
                              </>
                            ) : (
                              <td className="px-2.5 py-2.5 text-right tabular-nums text-slate-800">
                                <div>{formatInr(line.igstAmount * taxScale)}</div>
                                <div className="text-[9px] text-slate-400 leading-none mt-0.5">
                                  {formatPct(line.igstRate)}
                                </div>
                              </td>
                            )}
                            <td className="px-2.5 py-2.5 text-right font-bold tabular-nums text-[#111]">
                              {formatInr(line.preTax)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td
                          colSpan={Math.max(colCount - 3, 1)}
                          className="px-2.5 pt-4 pb-3 align-top text-[12px]"
                        >
                          <p className="font-bold text-slate-800 leading-relaxed text-left">
                            Total In Words:{" "}
                            <span className="italic font-semibold text-slate-700">
                              Indian Rupee {amountToIndianWords(totalForWords)}
                            </span>
                          </p>
                          {notes?.trim() && (
                            <div className="mt-3 text-left">
                              <p className="font-bold text-slate-800 mb-1">Notes</p>
                              <p className="whitespace-pre-line text-slate-600 text-[11px]">
                                {notes}
                              </p>
                            </div>
                          )}
                        </td>
                        <td
                          colSpan={3}
                          className="px-0 pt-3 pb-2 align-top text-[12px]"
                        >
                          <div className="w-full min-w-[11rem]">
                            <div className="flex items-baseline justify-between gap-3 px-2.5 py-[3px]">
                              <span className="text-slate-600 whitespace-nowrap text-right flex-1">
                                Sub Total
                              </span>
                              <span className="font-semibold tabular-nums text-right text-slate-900 w-[5.75rem] shrink-0">
                                {formatInr(displaySubtotal)}
                              </span>
                            </div>
                            {discount > 0 && (
                              <div className="flex items-baseline justify-between gap-3 px-2.5 py-[3px]">
                                <span className="text-slate-600 whitespace-nowrap text-right flex-1">
                                  Discount
                                </span>
                                <span className="font-semibold tabular-nums text-right text-slate-900 w-[5.75rem] shrink-0">
                                  −{formatInr(discount)}
                                </span>
                              </div>
                            )}
                            {taxRows.map((row) => (
                              <div
                                key={row.label}
                                className="flex items-baseline justify-between gap-3 px-2.5 py-[3px]"
                              >
                                <span className="text-slate-600 whitespace-nowrap text-right flex-1">
                                  {row.label}
                                </span>
                                <span className="font-semibold tabular-nums text-right text-slate-900 w-[5.75rem] shrink-0">
                                  {formatInr(row.amount)}
                                </span>
                              </div>
                            ))}
                            {installationCharges > 0 && (
                              <div className="flex items-baseline justify-between gap-3 px-2.5 py-[3px]">
                                <span className="text-slate-600 whitespace-nowrap text-right flex-1">
                                  Installation
                                </span>
                                <span className="font-semibold tabular-nums text-right text-slate-900 w-[5.75rem] shrink-0">
                                  {formatInr(installationCharges)}
                                </span>
                              </div>
                            )}
                            {shipping > 0 && (
                              <div className="flex items-baseline justify-between gap-3 px-2.5 py-[3px]">
                                <span className="text-slate-600 whitespace-nowrap text-right flex-1">
                                  Shipping
                                </span>
                                <span className="font-semibold tabular-nums text-right text-slate-900 w-[5.75rem] shrink-0">
                                  {formatInr(shipping)}
                                </span>
                              </div>
                            )}
                            <div className="flex items-baseline justify-between gap-3 bg-[#eef1f4] px-2.5 py-2 mt-1">
                              <span className="font-bold text-[#111] text-right flex-1">Total</span>
                              <span className="font-bold tabular-nums text-right text-[#111] w-[5.75rem] shrink-0">
                                {formatInr(totalForWords)}
                              </span>
                            </div>
                          </div>
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>


                {/* Bank sample uses "FULL NAME OF ACCOUNT" */}
                {hasBankDetails(bank) && (
                  <section className="quotation-sheet-section px-4 sm:px-6 lg:px-8 py-4 sm:py-5 border-t border-slate-200">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                      Full Name of Account
                    </p>
                    <div className="quotation-sheet-bank-grid grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1 text-xs text-slate-700">
                      {bank?.accountName && (
                        <p className="break-words">
                          <span className="text-slate-400">Account Name: </span>
                          {bank.accountName}
                        </p>
                      )}
                      {bank?.accountType && (
                        <p>
                          <span className="text-slate-400">Account Type: </span>
                          {bank.accountType}
                        </p>
                      )}
                      {bank?.accountNumber && (
                        <p className="break-all">
                          <span className="text-slate-400">Account Number: </span>
                          {bank.accountNumber}
                        </p>
                      )}
                      {bank?.bankName && (
                        <p className="break-words">
                          <span className="text-slate-400">Bank: </span>
                          {bank.bankName}
                        </p>
                      )}
                      {bank?.branch && (
                        <p className="break-words">
                          <span className="text-slate-400">Branch: </span>
                          {bank.branch}
                        </p>
                      )}
                      {bank?.ifsc && (
                        <p>
                          <span className="text-slate-400">IFSC: </span>
                          {bank.ifsc}
                        </p>
                      )}
                    </div>
                  </section>
                )}

                {/* Terms */}
                {termsLines.length > 0 && (
                  <section className="quotation-sheet-section px-4 sm:px-6 lg:px-8 py-4 sm:py-5 border-t border-slate-200">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                      Terms &amp; Conditions
                    </p>
                    <ol className="list-decimal pl-4 space-y-1 text-[11px] text-slate-700 leading-relaxed">
                      {termsLines.map((line, i) => (
                        <li key={i}>{stripLeadingNumber(line)}</li>
                      ))}
                    </ol>
                  </section>
                )}
              </article>
            </td>
          </tr>
        </tbody>
      </table>
      </div>


    </div>
  );
}

const QUOTATION_IFRAME_PRINT_CSS = `
  @page {
    size: A4 portrait;
    margin: 0;
  }
  html, body {
    margin: 0 !important;
    padding: 0 !important;
    width: 210mm !important;
    background: white !important;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  .quotation-document-root {
    width: 210mm !important;
    max-width: 210mm !important;
    min-width: 210mm !important;
    margin: 0 !important;
    padding: 4mm !important;
    box-sizing: border-box !important;
    overflow: visible !important;
    background: white !important;
  }
  .quotation-sheet {
    border: none !important;
    box-shadow: none !important;
    overflow: visible !important;
    width: 100% !important;
  }
  .quotation-no-print { display: none !important; }
  .quotation-mobile-only { display: none !important; }
  .quotation-print-table {
    display: block !important;
    overflow: visible !important;
    width: 100% !important;
  }
  .quotation-print-table > table {
    width: 100% !important;
    min-width: 0 !important;
  }
  .quotation-logo-mobile { display: none !important; }
  .quotation-logo-desktop { display: block !important; }
  .quotation-sheet-header {
    display: flex !important;
    flex-direction: row !important;
    justify-content: space-between !important;
    align-items: flex-start !important;
    gap: 1.5rem !important;
    padding: 1rem 1.25rem !important;
  }
  .quotation-sheet-title {
    font-size: 1.875rem !important;
    line-height: 2.25rem !important;
    text-align: right !important;
  }
  .quotation-sheet-meta {
    display: grid !important;
    grid-template-columns: 1fr 1fr !important;
    gap: 1rem !important;
    padding: 0.75rem 1.25rem !important;
  }
  .quotation-sheet-meta-right {
    text-align: right !important;
  }
  .quotation-sheet-section {
    padding: 0.75rem 1.25rem !important;
  }
  .quotation-sheet-bank-grid {
    display: grid !important;
    grid-template-columns: 1fr 1fr !important;
    column-gap: 2rem !important;
  }
`;

function formatQty(qty: number): string {
  if (!Number.isFinite(qty)) return "0";
  return Number.isInteger(qty) ? String(qty) : qty.toFixed(2);
}

function formatPct(rate: number): string {
  if (!Number.isFinite(rate)) return "0%";
  return `${Number.isInteger(rate) ? rate : rate.toFixed(1)}%`;
}

function stripLeadingNumber(line: string): string {
  return line.replace(/^\d+[\).\-\s]+/, "").trim() || line;
}

/** Helper for builder preview: derive qty display consistently. */
export function lineQtyForDisplay(line: {
  quantity?: number | null;
  totalSqFt?: number | null;
}): number {
  return getLineMeasurement(line);
}
