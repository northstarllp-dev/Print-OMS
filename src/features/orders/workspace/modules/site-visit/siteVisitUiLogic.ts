/** Pure UI / workflow rules for the site visit module (unit-tested). */

export type GpsLatLng = { lat: number; lng: number };

/** Parse stored GPS text ("12.97, 77.59" or with °NSEW) into a map center. */
export function parseGpsMapCenter(gpsLocation?: string | null): GpsLatLng | null {
  if (!gpsLocation) return null;
  const parts = gpsLocation.replace(/°|N|E|S|W/gi, "").split(",");
  if (parts.length < 2) return null;
  const lat = parseFloat(parts[0].trim());
  const lng = parseFloat(parts[1].trim());
  if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
  return { lat, lng };
}

/** Skip flow stores addresses that start with "Skipped". */
export function isSkippedSiteVisitAddress(address?: string | null): boolean {
  return typeof address === "string" && address.startsWith("Skipped");
}

/**
 * Read-only audit UI (mirrors SiteVisitModule baseFrozen before admin override / RBAC).
 * Prefer `isSiteVisitAuditFrozen` for the stricter pending-admin gate.
 */
export function isSiteVisitModuleBaseFrozen(
  stage: string,
  stageStatus: string | undefined,
  completed: boolean
): boolean {
  return !stage.startsWith("Site Visit") || (!!completed && stageStatus !== "Normal");
}

/** Effective freeze after admin unlock + RBAC canEdit. */
export function isSiteVisitUiFrozen(input: {
  stage: string;
  stageStatus?: string;
  completed: boolean;
  adminOverrideUnlocked?: boolean;
  canEdit: boolean;
}): boolean {
  const baseFrozen = isSiteVisitModuleBaseFrozen(
    input.stage,
    input.stageStatus,
    input.completed
  );
  return (baseFrozen && !input.adminOverrideUnlocked) || !input.canEdit;
}

/** Staff/admin advance gate on the site visit tab. */
export function canAdvanceSiteVisitAudit(details: {
  auditDate?: string | null;
  auditTime?: string | null;
  locations?: unknown[] | null;
}): { ok: boolean; tooltip: string } {
  const scheduled = !!(details.auditDate && details.auditTime);
  const hasLocations = !!(details.locations && details.locations.length > 0);
  const ok = scheduled && hasLocations;
  return {
    ok,
    tooltip: ok
      ? ""
      : "Schedule the visit and add at least one location item to unlock approval.",
  };
}

/**
 * List cards: Scheduled/Completed without auditDate still display as Pending.
 */
export function resolveDisplaySiteVisitStage(
  stage: string | null | undefined,
  auditDate?: string | null
): string {
  const s = stage || "";
  const isSiteVisitStage =
    s === "Site Visit Scheduled" || s === "Site Visit Completed";
  if (isSiteVisitStage && !auditDate) return "Site Visit Pending";
  return s;
}

/** Next N non-Sunday calendar days starting tomorrow (schedule modal). */
export function getNextBusinessDays(
  count = 7,
  from: Date = new Date()
): Date[] {
  const days: Date[] = [];
  const cur = new Date(from);
  while (days.length < count) {
    cur.setDate(cur.getDate() + 1);
    if (cur.getDay() !== 0) days.push(new Date(cur));
  }
  return days;
}

/** Schedule modal submit guard. */
export function canSubmitSiteVisitSchedule(input: {
  selectedDate?: string | null;
  selectedTime?: string | null;
  siteAddress?: string | null;
}): boolean {
  return !!(input.selectedDate && input.selectedTime && input.siteAddress?.trim());
}

/** Portal slot conflict: same date+time on another order. */
export function isSiteVisitSlotBooked(
  orders: Array<{
    id: string;
    siteVisitDetails?: {
      auditDate?: string | null;
      auditTime?: string | null;
      preferredDate?: string | null;
      preferredTime?: string | null;
    } | null;
  }>,
  date: string,
  time: string,
  excludeOrderId?: string
): boolean {
  return orders.some((o) => {
    if (excludeOrderId && o.id === excludeOrderId) return false;
    const sv = o.siteVisitDetails;
    if (!sv) return false;
    const d = sv.auditDate || sv.preferredDate;
    const t = sv.auditTime || sv.preferredTime;
    return d === date && t === time;
  });
}

export type SiteVisitReviewMode = "staff_push" | "admin_lock";

export function siteVisitReviewCopy(mode: SiteVisitReviewMode): {
  confirmLabel: string;
  locksAudit: boolean;
} {
  if (mode === "staff_push") {
    return { confirmLabel: "Request Admin Approval", locksAudit: false };
  }
  return { confirmLabel: "Lock & Continue", locksAudit: true };
}
