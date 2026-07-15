"use client";

import React from "react";
import { Printer } from "lucide-react";
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

export interface QuotationDocumentProps {
  quotationId?: string | null;
  quoteDate?: string | Date | null;
  status?: string | null;
  /** When false, omit status line (customer PDF look). Default true for builder preview. */
  showStatus?: boolean;
  billToName: string;
  billToAddress?: string | null;
  placeOfSupply?: string | null;
  sections: QuotationDocSection[];
  subtotal?: number;
  discount?: number;
  shipping?: number;
  tax?: number;
  grandTotal?: number;
  notes?: string | null;
  terms?: string | null;
  invoiceProfile?: InvoiceProfile | null;
  siteVisitItems?: any[];
  /** Show print button (hidden in print media). */
  showPrintButton?: boolean;
  className?: string;
}

export function QuotationDocument({
  quotationId,
  quoteDate,
  status,
  showStatus = true,
  billToName,
  billToAddress,
  placeOfSupply,
  sections,
  subtotal = 0,
  discount = 0,
  shipping = 0,
  tax = 0,
  grandTotal = 0,
  notes,
  terms,
  invoiceProfile,
  siteVisitItems = [],
  showPrintButton = true,
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

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className={`quotation-document-root ${className}`}>
      {showPrintButton && (
        <div className="quotation-no-print mb-3 flex justify-end">
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50"
          >
            <Printer size={14} />
            Print / Save as PDF
          </button>
        </div>
      )}

      <article className="quotation-sheet bg-white text-[#1a1a1a] border border-slate-200 shadow-sm overflow-hidden">
        {/* Header */}
        <header className="flex flex-col sm:flex-row gap-6 justify-between p-6 sm:p-8 border-b border-slate-200">
          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-3">
              {invoiceProfile?.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={invoiceProfile.logoUrl}
                  alt={brand}
                  className="h-12 w-auto max-w-[140px] object-contain"
                />
              ) : null}
              <div>
                <h1 className="text-lg sm:text-xl font-black tracking-tight text-[#111] uppercase">
                  {brand}
                </h1>
                {legalName && legalName !== brand && (
                  <p className="text-xs font-semibold text-slate-600 mt-0.5">
                    {legalName}
                  </p>
                )}
              </div>
            </div>
            {invoiceProfile?.address && (
              <p className="mt-3 text-[11px] leading-relaxed text-slate-600 whitespace-pre-line max-w-md">
                {invoiceProfile.address}
              </p>
            )}
            <div className="mt-2 space-y-0.5 text-[11px] text-slate-600">
              {invoiceProfile?.gstin && (
                <p>
                  <span className="font-semibold text-slate-800">GSTIN</span>{" "}
                  {invoiceProfile.gstin}
                </p>
              )}
              {invoiceProfile?.email && <p>{invoiceProfile.email}</p>}
              {invoiceProfile?.website && <p>{invoiceProfile.website}</p>}
            </div>
          </div>

          <div className="sm:text-right shrink-0">
            <p className="text-2xl sm:text-3xl font-black tracking-wide text-[#1e293b]">
              QUOTATION
            </p>
            <p className="mt-1 text-sm font-mono font-bold text-slate-700">
              {quotationId || "—"}
            </p>
            {showStatus && status && (
              <p className="mt-2 text-[10px] font-bold uppercase tracking-wider text-slate-500 quotation-no-print">
                Status: {status}
              </p>
            )}
          </div>
        </header>

        {/* Meta */}
        <section className="grid grid-cols-1 sm:grid-cols-2 gap-4 px-6 sm:px-8 py-5 border-b border-slate-200">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Bill To
            </p>
            <p className="mt-1 text-sm font-bold text-slate-900">{billToName}</p>
            {billToAddress && (
              <p className="mt-1 text-xs text-slate-600 whitespace-pre-line">
                {billToAddress}
              </p>
            )}
          </div>
          <div className="sm:text-right space-y-2">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Quote Date
              </p>
              <p
                className="mt-0.5 text-sm font-semibold text-slate-800"
                suppressHydrationWarning
              >
                {formatQuoteDate(quoteDate)}
              </p>
            </div>
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

        {/* Lines table — Zoho-style dark header, pre-tax Amount = Qty × Rate */}
        <div className="overflow-x-auto px-0">
          <table className="w-full min-w-[720px] border-collapse text-[11px]">
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
                  Qty
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
                      {line.hsn || "—"}
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


        {/* Bank — sample uses "FULL NAME OF ACCOUNT" */}
        {hasBankDetails(bank) && (
          <section className="px-6 sm:px-8 py-5 border-t border-slate-200">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">
              Full Name of Account
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1 text-xs text-slate-700">
              {bank?.accountName && (
                <p>
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
                <p>
                  <span className="text-slate-400">Account Number: </span>
                  {bank.accountNumber}
                </p>
              )}
              {bank?.bankName && (
                <p>
                  <span className="text-slate-400">Bank: </span>
                  {bank.bankName}
                </p>
              )}
              {bank?.branch && (
                <p>
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
          <section className="px-6 sm:px-8 py-5 border-t border-slate-200">
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

      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          .quotation-document-root,
          .quotation-document-root * {
            visibility: visible !important;
          }
          .quotation-document-root {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 0;
          }
          .quotation-no-print {
            display: none !important;
          }
          .quotation-sheet {
            box-shadow: none !important;
            border: none !important;
          }
        }
      `}</style>
    </div>
  );
}

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
