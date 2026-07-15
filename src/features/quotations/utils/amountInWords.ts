/** Convert a non-negative amount to Indian English words (e.g. rupees). */
export function amountToIndianWords(amount: number): string {
  const n = Math.round(Math.abs(Number(amount) || 0));
  if (n === 0) return "Zero Only";

  const ones = [
    "",
    "One",
    "Two",
    "Three",
    "Four",
    "Five",
    "Six",
    "Seven",
    "Eight",
    "Nine",
    "Ten",
    "Eleven",
    "Twelve",
    "Thirteen",
    "Fourteen",
    "Fifteen",
    "Sixteen",
    "Seventeen",
    "Eighteen",
    "Nineteen",
  ];
  const tens = [
    "",
    "",
    "Twenty",
    "Thirty",
    "Forty",
    "Fifty",
    "Sixty",
    "Seventy",
    "Eighty",
    "Ninety",
  ];

  const twoDigits = (num: number): string => {
    if (num < 20) return ones[num];
    const t = Math.floor(num / 10);
    const o = num % 10;
    return `${tens[t]}${o ? ` ${ones[o]}` : ""}`.trim();
  };

  const threeDigits = (num: number): string => {
    const h = Math.floor(num / 100);
    const rest = num % 100;
    if (h && rest) return `${ones[h]} Hundred ${twoDigits(rest)}`;
    if (h) return `${ones[h]} Hundred`;
    return twoDigits(rest);
  };

  const crore = Math.floor(n / 10000000);
  const lakh = Math.floor((n % 10000000) / 100000);
  const thousand = Math.floor((n % 100000) / 1000);
  const hundred = n % 1000;

  const parts: string[] = [];
  if (crore) parts.push(`${threeDigits(crore)} Crore`);
  if (lakh) parts.push(`${threeDigits(lakh)} Lakh`);
  if (thousand) parts.push(`${threeDigits(thousand)} Thousand`);
  if (hundred) parts.push(threeDigits(hundred));

  return `${parts.join(" ")} Only`;
}

export function formatQuoteDate(iso?: string | Date | null): string {
  if (iso == null || iso === "") return "—";
  if (iso instanceof Date) {
    if (Number.isNaN(iso.getTime())) return "—";
    return iso.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  // Normalize Postgres-style "YYYY-MM-DD HH:MM:SS+00" to ISO for strict parsers
  const normalized = String(iso)
    .trim()
    .replace(" ", "T")
    .replace(/([+-]\d{2})$/, "$1:00");

  const d = new Date(normalized);
  if (Number.isNaN(d.getTime())) {
    const fallback = new Date(iso);
    if (Number.isNaN(fallback.getTime())) return "—";
    return fallback.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatInr(amount: number): string {
  return Number(amount || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Split terms text into display lines (preserve numbering if present). */
export function parseTermsLines(terms?: string | null): string[] {
  if (!terms?.trim()) return [];
  return terms
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}
