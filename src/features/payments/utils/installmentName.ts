/** e.g. 1 → "1st installment", 2 → "2nd installment" */
export function formatInstallmentName(n: number): string {
  const ordinal =
    n % 100 >= 11 && n % 100 <= 13
      ? `${n}th`
      : n % 10 === 1
        ? `${n}st`
        : n % 10 === 2
          ? `${n}nd`
          : n % 10 === 3
            ? `${n}rd`
            : `${n}th`;
  return `${ordinal} installment`;
}

/** Next installment label from existing payment count (1-based). */
export function nextInstallmentName(existingCount: number): string {
  return formatInstallmentName(Math.max(0, existingCount) + 1);
}

/** True if name is an auto-generated installment or rest-of-amount label. */
export function isAutoPaymentName(name: string): boolean {
  return (
    name === "Rest of Amount" ||
    name === "Advance Payment" ||
    /^\d+(st|nd|rd|th) installment$/i.test(name.trim())
  );
}
