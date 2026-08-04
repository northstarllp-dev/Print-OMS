/** Pure enquiry list / KPI / health helpers (unit-tested). */

export const ENQUIRY_HEALTH_STATUSES = [
  "Active",
  "Needs Attention",
  "On Hold",
  "Lost",
] as const;

export type EnquiryHealthStatus = (typeof ENQUIRY_HEALTH_STATUSES)[number];

export interface EnquiryListRow {
  id: string;
  dateReceived?: string | null;
  leadName?: string | null;
  businessName?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  source?: string | null;
  status?: string | null;
  notes?: string | null;
  primaryCommunicationMode?: string | null;
  location?: string | null;
  customerId?: string | null;
  orderId?: string | null;
  enquireId?: string | null;
  addedBy?: string | null;
  health?: string | null;
  lostReason?: string | null;
  holdNote?: string | null;
  reachOutAt?: string | null;
}

export interface EnquiryFilterOptions {
  search?: string;
  sourceFilter?: string;
  addedByFilter?: string;
  healthFilter?: string;
  selectedKpi?: string | null;
  dateFilterType?: "range" | "all";
  startDate?: string;
  endDate?: string;
}

/** Map DB / joined enquiry row → table view shape (admin + staff pages). */
export function mapDbEnquiryToViewRow(e: Record<string, any>): EnquiryListRow {
  return {
    id: e.id,
    dateReceived: e.date_received,
    leadName: e.lead_name,
    businessName: e.business_name || e.lead_name,
    phone: e.phone,
    whatsapp: e.whatsapp,
    email: e.email,
    source: e.source,
    status: e.status,
    notes: e.notes,
    primaryCommunicationMode: e.primary_communication_mode,
    location: e.location,
    customerId: e.customers?.customer_id || e.customer_id,
    orderId: e.orders?.order_id || e.order_id,
    enquireId: e.enquire_id || e.id,
    addedBy: e.added_by,
    health: e.health,
    lostReason: e.lost_reason,
    holdNote: e.hold_note,
    reachOutAt: e.reach_out_at,
  };
}

export function normalizeEnquiryHealth(health?: string | null): string {
  return health || "Active";
}

export function healthMenuActions(
  health?: string | null
): Array<{ health: EnquiryHealthStatus; label: string }> {
  const h = normalizeEnquiryHealth(health);
  if (h === "Active") {
    return [
      { health: "Needs Attention", label: "Mark Needs Attention" },
      { health: "On Hold", label: "On Hold" },
      { health: "Lost", label: "Mark as Lost" },
    ];
  }
  if (h === "Needs Attention") {
    return [
      { health: "Active", label: "Make Active" },
      { health: "On Hold", label: "On Hold" },
      { health: "Lost", label: "Mark as Lost" },
    ];
  }
  if (h === "On Hold") {
    return [
      { health: "Active", label: "Make Active" },
      { health: "Lost", label: "Mark as Lost" },
    ];
  }
  return [{ health: "Active", label: "Reopen (Active)" }];
}

export function isAllowedHealthTransition(
  from: string | null | undefined,
  to: string
): boolean {
  return healthMenuActions(from).some((a) => a.health === to);
}

/** Server update payload for health (clears lost_reason unless Lost; hold fields when On Hold). */
export function buildHealthUpdatePayload(
  health: string,
  lostReason?: string | null,
  hold?: { note?: string | null; reachOutAt?: string | null } | null
): {
  health: string;
  lost_reason: string | null;
  hold_note: string | null;
  reach_out_at: string | null;
} {
  const isHold = health === "On Hold";
  return {
    health,
    lost_reason: health === "Lost" ? lostReason ?? null : null,
    hold_note: isHold ? hold?.note?.trim() || null : null,
    reach_out_at: isHold ? hold?.reachOutAt || null : null,
  };
}

export function requiresHoldFollowUpPrompt(health: string): boolean {
  return health === "On Hold";
}

export function isValidHoldFollowUp(note?: string | null, reachOutAt?: string | null): boolean {
  return Boolean(note?.trim() && reachOutAt);
}

export function requiresLostReasonPrompt(
  health: string,
  promptReason: string | undefined
): boolean {
  return health === "Lost" && promptReason === undefined;
}

export function isValidLostReason(reason?: string | null): boolean {
  return Boolean(reason && reason.trim());
}

export function computeEnquiryKpis(enquiries: Array<{ status?: string | null }>) {
  const total = enquiries.length;
  const pending = enquiries.filter((e) => e.status === "Pending").length;
  const converted = enquiries.filter((e) => e.status === "Converted").length;
  const conversionRate = total > 0 ? Math.round((converted / total) * 100) : 0;
  return { total, pending, converted, conversionRate };
}

export function filterEnquiries<T extends EnquiryListRow>(
  enquiries: T[],
  opts: EnquiryFilterOptions
): T[] {
  const search = (opts.search || "").toLowerCase();
  const sourceFilter = opts.sourceFilter ?? "All";
  const addedByFilter = opts.addedByFilter ?? "All";
  const healthFilter = opts.healthFilter ?? "ALL";
  const selectedKpi = opts.selectedKpi ?? null;
  const dateFilterType = opts.dateFilterType ?? "range";
  const startDate = opts.startDate || "";
  const endDate = opts.endDate || "";

  return enquiries.filter((e) => {
    const matchesSearch =
      !search ||
      (e.businessName || "").toLowerCase().includes(search) ||
      (e.leadName || "").toLowerCase().includes(search) ||
      (e.phone || "").includes(opts.search || "");

    const matchesSource = sourceFilter === "All" || e.source === sourceFilter;
    const matchesAddedBy =
      addedByFilter === "All" || (e.addedBy || "Admin") === addedByFilter;
    const matchesHealth =
      healthFilter === "ALL" || normalizeEnquiryHealth(e.health) === healthFilter;

    if (selectedKpi === "pending" && e.status !== "Pending") return false;
    if (selectedKpi === "converted" && e.status !== "Converted") return false;
    // "total" KPI is a no-op status predicate (matches EnquiriesViewNew)

    let matchesDate = true;
    if (e.dateReceived) {
      try {
        const enqDateStr = new Date(e.dateReceived).toISOString().split("T")[0];
        if (dateFilterType === "range") {
          if (startDate && enqDateStr < startDate) matchesDate = false;
          if (endDate && enqDateStr > endDate) matchesDate = false;
        }
      } catch {
        matchesDate = false;
      }
    } else if (dateFilterType !== "all") {
      matchesDate = false;
    }

    return (
      matchesSearch &&
      matchesSource &&
      matchesAddedBy &&
      matchesDate &&
      matchesHealth
    );
  });
}

export function countActiveEnquiryFilters(opts: {
  sourceFilter?: string;
  addedByFilter?: string;
  healthFilter?: string;
  startDate?: string;
  endDate?: string;
  selectedKpi?: string | null;
}): number {
  return [
    (opts.sourceFilter ?? "All") !== "All",
    (opts.addedByFilter ?? "All") !== "All",
    (opts.healthFilter ?? "ALL") !== "ALL",
    Boolean(opts.startDate || opts.endDate),
    Boolean(opts.selectedKpi),
  ].filter(Boolean).length;
}

export function uniqueAddedByOptions(
  enquiries: Array<{ addedBy?: string | null }>
): string[] {
  return Array.from(
    new Set(enquiries.map((e) => e.addedBy || "Admin"))
  ).sort((a, b) => a.localeCompare(b));
}

/** Stall flag candidate: Active, not Converted, older than cutoff. */
export function isEnquiryStalledCandidate(
  e: { health?: string | null; status?: string | null; dateReceived?: string | null },
  cutoffIso: string
): boolean {
  if (normalizeEnquiryHealth(e.health) !== "Active") return false;
  if (e.status === "Converted") return false;
  if (!e.dateReceived) return false;
  return e.dateReceived < cutoffIso;
}

export function stallCutoffIso(days: number, from: Date = new Date()): string {
  const cutoff = new Date(from);
  cutoff.setDate(cutoff.getDate() - Math.max(0, days));
  return cutoff.toISOString();
}

/** Soft list access: admin always; staff needs view or edit on enquiry. */
export function canListEnquiries(actor: {
  role: string;
  canView: boolean;
  canEdit: boolean;
}): boolean {
  if (actor.role === "admin") return true;
  return actor.canView || actor.canEdit;
}
