import { calcLineAmount, getLineMeasurement } from "@/features/quotations/utils/lineAmount";
import type { InvoiceTaxSplit } from "@/features/quotations/types/invoiceProfile";

export interface QuotationDocLine {
  id?: string;
  description?: string;
  hsn?: string;
  quantity?: number | null;
  totalSqFt?: number | null;
  unitPrice?: number | null;
  gstRate?: number | null;
  notes?: string | null;
  pricingType?: string;
  unit?: string;
}

export interface QuotationDocSection {
  itemLabel?: string;
  siteVisitItemId?: string;
  notes?: string;
  lines?: QuotationDocLine[];
}

export interface FlatDocLine {
  index: number;
  description: string;
  /** Secondary description lines under the item name (notes, size, etc.). */
  detailLines: string[];
  hsn: string;
  qty: number;
  rate: number;
  gstRate: number;
  preTax: number;
  cgstRate: number;
  sgstRate: number;
  cgstAmount: number;
  sgstAmount: number;
  igstRate: number;
  igstAmount: number;
  notes?: string | null;
}

export interface TaxSummaryRow {
  label: string;
  rate: number;
  amount: number;
}

function formatSizeDetail(sv: {
  width?: number | null;
  height?: number | null;
  widthUnit?: string | null;
  heightUnit?: string | null;
}): string | null {
  if (sv.width == null && sv.height == null) return null;
  const w = Number(sv.width) || 0;
  const h = Number(sv.height) || 0;
  const area = w > 0 && h > 0 ? w * h : null;
  if (area != null && area > 0) {
    return `Size : ${w}X${h}=${area} Sqft`;
  }
  const wLabel = sv.width != null ? `${sv.width}${sv.widthUnit || "ft"}` : "—";
  const hLabel = sv.height != null ? `${sv.height}${sv.heightUnit || "ft"}` : "—";
  return `Size: ${wLabel} × ${hLabel}`;
}

/** Skip blank builder rows (no real description and zero amount). */
export function isDisplayableQuotationLine(line: QuotationDocLine): boolean {
  const desc = (line.description || "").trim();
  const preTax = calcLineAmount(line);
  const rate = Number(line.unitPrice) || 0;
  if (preTax > 0 || rate > 0) return true;
  if (!desc || /^item$/i.test(desc)) return false;
  return true;
}

export function flattenQuotationLines(
  sections: QuotationDocSection[] | null | undefined,
  taxSplit: InvoiceTaxSplit = "cgst_sgst",
  siteVisitItems?: Array<{
    id?: string;
    name?: string;
    width?: number | null;
    height?: number | null;
    widthUnit?: string | null;
    heightUnit?: string | null;
    depth?: number | null;
    depthUnit?: string | null;
  }>
): FlatDocLine[] {
  const rows: FlatDocLine[] = [];
  let index = 0;

  // Determine if we have multiple sections so we show the item label per line.
  const sectionsWithLines = (sections || []).filter(
    (s) => (s.lines || []).some(isDisplayableQuotationLine)
  );
  const showSectionLabel = sectionsWithLines.length > 1;

  for (const section of sections || []) {
    const sv = siteVisitItems?.find(
      (s) =>
        s.id &&
        section.siteVisitItemId &&
        String(s.id) === String(section.siteVisitItemId)
    );
    const sizeDetail = sv ? formatSizeDetail(sv) : null;
    let sizeAttached = false;

    // The label to append in brackets: prefer itemLabel, fall back to sv.name.
    const sectionLabel =
      section.itemLabel?.trim() || sv?.name?.trim() || "";

    for (const line of section.lines || []) {
      if (!isDisplayableQuotationLine(line)) continue;

      index += 1;
      const preTax = calcLineAmount(line);
      const gstRate = Number(line.gstRate) || 0;
      const half = gstRate / 2;
      const halfAmt = Math.round(preTax * half) / 100;
      const fullAmt = Math.round(preTax * gstRate) / 100;

      const baseDesc = (line.description || "").trim() || "Item";
      const desc =
        showSectionLabel && sectionLabel
          ? `${baseDesc} (${sectionLabel})`
          : baseDesc;
      const detailLines: string[] = [];
      if (line.notes?.trim()) detailLines.push(line.notes.trim());

      // Show unit type (e.g. "Per Sq.Ft", "Per Unit") as the sub-detail line.
      const unitLabel = (line.unit || "").trim();
      if (unitLabel) detailLines.push(unitLabel);

      rows.push({
        index,
        description: desc,
        detailLines,
        hsn: (line.hsn || "").trim(),
        qty: getLineMeasurement(line),
        rate: Number(line.unitPrice) || 0,
        gstRate,
        preTax: Math.round(preTax * 100) / 100,
        cgstRate: taxSplit === "cgst_sgst" ? half : 0,
        sgstRate: taxSplit === "cgst_sgst" ? half : 0,
        cgstAmount: taxSplit === "cgst_sgst" ? halfAmt : 0,
        sgstAmount: taxSplit === "cgst_sgst" ? halfAmt : 0,
        igstRate: taxSplit === "igst" ? gstRate : 0,
        igstAmount: taxSplit === "igst" ? fullAmt : 0,
        notes: line.notes ?? undefined,
      });
    }
  }

  return rows;
}

/** Group tax amounts by half-rate (CGST/SGST) or full rate (IGST) for summary. */
export function buildTaxSummaryRows(
  lines: FlatDocLine[],
  taxSplit: InvoiceTaxSplit,
  /** Scale factor when discount reduces taxable GST (tax / rawGst). */
  taxScale = 1
): TaxSummaryRow[] {
  const map = new Map<string, TaxSummaryRow>();

  for (const line of lines) {
    if (taxSplit === "igst") {
      if (!line.igstRate) continue;
      const key = `IGST${line.igstRate}`;
      const prev = map.get(key) || {
        // Sample style: IGST18 (18%)
        label: `IGST${line.igstRate} (${line.igstRate}%)`,
        rate: line.igstRate,
        amount: 0,
      };
      prev.amount += line.igstAmount * taxScale;
      map.set(key, prev);
    } else {
      if (!line.cgstRate) continue;
      for (const side of ["CGST", "SGST"] as const) {
        const rate = side === "CGST" ? line.cgstRate : line.sgstRate;
        const amt = side === "CGST" ? line.cgstAmount : line.sgstAmount;
        const key = `${side}${rate}`;
        const prev = map.get(key) || {
          // Sample style: CGST9 (9%)
          label: `${side}${rate} (${rate}%)`,
          rate,
          amount: 0,
        };
        prev.amount += amt * taxScale;
        map.set(key, prev);
      }
    }
  }

  return Array.from(map.values()).map((r) => ({
    ...r,
    amount: Math.round(r.amount * 100) / 100,
  }));
}
