/** Normalize phone to E.164 digits only (no +), for Meta WhatsApp API. */
export function normalizeWhatsAppPhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let digits = raw.replace(/\D/g, "");
  if (!digits) return null;

  // India: 10-digit mobile → 91 prefix
  if (digits.length === 10 && /^[6-9]/.test(digits)) {
    digits = `91${digits}`;
  }
  // US/CA test numbers: 10 digits → 1 prefix
  if (digits.length === 10 && digits.startsWith("555")) {
    digits = `1${digits}`;
  }

  if (digits.length < 10 || digits.length > 15) return null;
  return digits;
}

export function isWhatsAppConfigured(): boolean {
  return Boolean(
    process.env.WHATSAPP_ACCESS_TOKEN &&
      process.env.WHATSAPP_PHONE_NUMBER_ID
  );
}
