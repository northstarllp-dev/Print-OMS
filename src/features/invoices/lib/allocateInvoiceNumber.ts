import type { SupabaseClient } from "@supabase/supabase-js";
import {
  formatInvoiceNumber,
  normalizeInvoiceNumbering,
  resolvePeriodKey,
  type InvoiceNumberingConfig,
} from "@/features/invoices/types/invoiceNumbering";

/**
 * Allocates the next human-readable invoice_id for a company using
 * app_settings.invoice_numbering + invoice_number_sequences.
 * Never returns a UUID.
 */
export async function allocateInvoiceNumber(
  db: SupabaseClient,
  companyId: string,
  date: Date = new Date()
): Promise<{ invoiceId: string; config: InvoiceNumberingConfig }> {
  const { data: settingsRow, error: sErr } = await db
    .from("app_settings")
    .select("invoice_numbering")
    .eq("company_id", companyId)
    .maybeSingle();
  if (sErr) throw new Error(sErr.message);

  const config = normalizeInvoiceNumbering(settingsRow?.invoice_numbering);
  const periodKey = resolvePeriodKey(config, date);

  const { data: seq, error: aErr } = await db.rpc("allocate_invoice_sequence", {
    p_company_id: companyId,
    p_period_key: periodKey,
    p_starting_number: config.startingNumber,
  });
  if (aErr) throw new Error(aErr.message);

  const sequence = Number(seq);
  if (!Number.isFinite(sequence) || sequence < 1) {
    throw new Error("Failed to allocate invoice sequence");
  }

  const invoiceId = formatInvoiceNumber(config, sequence, date);
  return { invoiceId, config };
}
