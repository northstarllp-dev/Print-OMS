/** Normalize a raw phone for wa.me 10-digit Indian numbers get a 91 prefix. */
export function normalizeWhatsAppShareNumber(rawPhone: string): string {
  const digits = rawPhone.replace(/[^0-9]/g, "");
  return digits.length === 10 ? `91${digits}` : digits;
}

export function buildWhatsAppShareLink(rawPhone: string, text: string): string {
  const phone = normalizeWhatsAppShareNumber(rawPhone);
  return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
}

export function buildMailtoLink(
  email: string,
  subject: string,
  body: string
): string {
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
