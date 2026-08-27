import { SiteVisitDetails, SignLocation } from "@/types";

/** Map a site_visit_measurements row (snake_case or camelCase) to the UI shape. */
export function mapSiteVisitMeasurementFromDb(m: any): SignLocation {
  const num = (v: unknown): number | undefined => {
    if (v == null || v === "") return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  };
  const unit = (...candidates: unknown[]) => {
    for (const c of candidates) {
      if (typeof c === "string" && c.trim()) return c.trim();
    }
    return "ft";
  };

  return {
    id: m.id,
    name: m.name,
    width: num(m.width),
    widthUnit: unit(m.width_unit, m.widthUnit),
    height: num(m.height),
    heightUnit: unit(m.height_unit, m.heightUnit),
    depth: num(m.depth),
    depthUnit: unit(m.depth_unit, m.depthUnit),
    groundClearance: num(m.ground_clearance ?? m.groundClearance),
    groundClearanceUnit: unit(m.ground_clearance_unit, m.groundClearanceUnit),
    notes: m.notes ?? undefined,
    photos: m.photos || [],
    powerAvailable: m.power_available ?? m.powerAvailable,
    distanceToPowerSource: num(m.distance_to_power_source ?? m.distanceToPowerSource),
    distanceToPowerSourceUnit: m.distance_to_power_source_unit ?? m.distanceToPowerSourceUnit,
    electricalNotes: m.electrical_notes ?? m.electricalNotes,
    wallType: m.wall_type ?? m.wallType,
    mountingMethod: m.mounting_method ?? m.mountingMethod,
    surfaceCondition: m.surface_condition ?? m.surfaceCondition,
    obstacles: m.obstacles || [],
    structuralNotes: m.structural_notes ?? m.structuralNotes,
  };
}

/** Normalize linear unit labels from site-visit UI / DB. */
export function normalizeLinearUnit(unit?: string | null): "ft" | "in" | "m" | "cm" | "mm" {
  const u = (unit || "ft").trim().toLowerCase();
  if (u === "in" || u === "inch" || u === "inches" || u === "\"") return "in";
  if (u === "m" || u === "meter" || u === "metre" || u === "meters" || u === "metres") return "m";
  if (u === "cm" || u === "centimeter" || u === "centimetre" || u === "centimeters") return "cm";
  if (u === "mm" || u === "millimeter" || u === "millimetre" || u === "millimeters") return "mm";
  // ft, feet, foot, '
  return "ft";
}

/** Convert one linear dimension to feet. */
export function linearToFeet(value: number, unit?: string | null): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  switch (normalizeLinearUnit(unit)) {
    case "in":
      return n / 12;
    case "m":
      return n / 0.3048;
    case "cm":
      return n / 30.48;
    case "mm":
      return n / 304.8;
    default:
      return n;
  }
}

/**
 * Area in square feet for quotation qty (Per Sq.Ft).
 * Handles mixed units (e.g. width in inch, height in ft).
 * Returns 0 when width/height missing or non-positive.
 */
export function siteMeasurementAreaSqFt(item: {
  width?: number | null;
  height?: number | null;
  widthUnit?: string | null;
  heightUnit?: string | null;
  width_unit?: string | null;
  height_unit?: string | null;
} | null | undefined): number {
  if (!item) return 0;
  const w = Number(item.width);
  const h = Number(item.height);
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return 0;
  const wFt = linearToFeet(w, item.widthUnit || item.width_unit);
  const hFt = linearToFeet(h, item.heightUnit || item.height_unit);
  const area = wFt * hFt;
  // Quotation qty should be a simple whole sq ft.
  return Math.round(area);
}

/** Label shown under signage items on quotation pages. */
export function formatSiteMeasurementLabel(item: {
  width?: number | null;
  widthUnit?: string | null;
  height?: number | null;
  heightUnit?: string | null;
  depth?: number | null;
  depthUnit?: string | null;
  width_unit?: string | null;
  height_unit?: string | null;
  depth_unit?: string | null;
} | null | undefined): string | null {
  if (!item || (item.width == null && item.height == null)) return null;
  const wUnit = (item.widthUnit || item.width_unit || "ft").toUpperCase();
  const hUnit = (item.heightUnit || item.height_unit || "ft").toUpperCase();
  const dUnit = (item.depthUnit || item.depth_unit || "ft").toUpperCase();
  let label = `Site Measurement: ${item.width ?? ""} ${wUnit} × ${item.height ?? ""} ${hUnit}`;
  if (item.depth != null && item.depth !== 0) {
    label += ` - Depth: ${item.depth} ${dUnit}`;
  }
  return label;
}

const PLACEHOLDER_INSTALLATION_ADDRESSES = new Set([
  "Installation Address Pending Survey",
  "Not Provided",
]);

/** Enquiry/customer placeholders that must not seed schedule address fields. */
export function isPlaceholderInstallationAddress(value?: string | null): boolean {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  return !trimmed || PLACEHOLDER_INSTALLATION_ADDRESSES.has(trimmed);
}

/**
 * Address safe to prefill into schedule/skip location inputs.
 * Drops placeholders, blank, and legacy "Skipped…" strings.
 */
export function usableSiteAddressHint(value?: string | null): string {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed || trimmed.startsWith("Skipped") || PLACEHOLDER_INSTALLATION_ADDRESSES.has(trimmed)) {
    return "";
  }
  return trimmed;
}

/** Site visit address is the source of truth for installation location when available. */
export function resolveSiteVisitInstallationAddress(
  siteVisit?: Partial<SiteVisitDetails> | Record<string, unknown> | null,
  fallback?: string | null
): string | null {
  const sv = (siteVisit || {}) as Record<string, unknown>;
  const candidates = [
    sv.customerAddress,
    sv.customer_address,
    sv.siteAddress,
    sv.site_address,
  ];

  for (const value of candidates) {
    if (typeof value !== "string") continue;
    const usable = usableSiteAddressHint(value);
    if (!usable) continue;
    return usable;
  }

  return usableSiteAddressHint(fallback) || null;
}

/** Open address or "lat, lng" in Google Maps. */
export function buildGoogleMapsSearchUrl(query?: string | null): string | null {
  const trimmed = typeof query === "string" ? query.trim() : "";
  if (!trimmed || trimmed === "N/A" || trimmed.startsWith("Skipped")) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(trimmed)}`;
}

/**
 * Location link for list/table cells.
 * Never uses legacy "Skipped…" placeholder text as the link label prefers real
 * address, then GPS, then an explicit gmap link.
 */
export function resolveSiteVisitMapLink(
  details?: {
    customerAddress?: string | null;
    customer_address?: string | null;
    siteAddress?: string | null;
    site_address?: string | null;
    gpsLocation?: string | null;
    gps_location?: string | null;
    gmapLink?: string | null;
    gmap_link?: string | null;
  } | null
): { href: string; label: string } | null {
  if (!details) return null;

  const gmap =
    (typeof details.gmapLink === "string" && details.gmapLink.trim()) ||
    (typeof details.gmap_link === "string" && details.gmap_link.trim()) ||
    "";
  if (gmap) {
    const address = resolveSiteVisitInstallationAddress(details);
    return { href: gmap, label: address || "Open map location" };
  }

  const address = resolveSiteVisitInstallationAddress(details);
  if (address) {
    const href = buildGoogleMapsSearchUrl(address);
    if (href) return { href, label: address };
  }

  const gpsRaw = details.gpsLocation ?? details.gps_location;
  const gps = typeof gpsRaw === "string" ? gpsRaw.trim() : "";
  if (gps && gps !== "N/A") {
    const href = buildGoogleMapsSearchUrl(gps);
    if (href) return { href, label: gps };
  }

  return null;
}

export function mapSiteVisitFromDb(sv: any): SiteVisitDetails | null {
  if (!sv) return null;

  return {
    id: sv.id || undefined,
    completed: sv.completed || false,

    customerAddress: sv.customer_address,
    landmark: sv.landmark,
    preferredDate: sv.preferred_date,
    preferredTime: sv.preferred_time,
    gpsLocation: sv.gps_location,

    auditDate: sv.audit_date,
    auditTime: sv.audit_time,

    internalNotes: sv.internal_notes || {},

    reviewStatus: sv.review_status,

    // Installation Requirements
    scaffoldingRequired: sv.scaffolding_required ?? undefined,
    craneRequired: sv.crane_required ?? undefined,
    overnightInstallation: sv.overnight_installation ?? undefined,

    // Fabrication Requirements
    extraAnglesRequired: sv.extra_angles_required ?? undefined,
    extraAnglesLength: sv.extra_angles_length ?? "",
    extraAcpSheetRequired: sv.extra_acp_sheet_required ?? undefined,
    oldBoardRemovalRequired: sv.old_board_removal_required ?? undefined,
    extraWireRequired: sv.extra_wire_required ?? undefined,

    // Design Inputs
    designBriefAvailable: sv.design_brief_available ?? undefined,
    fabricationRequired: sv.fabrication_required ?? undefined,
    civilWorkRequired: sv.civil_work_required ?? undefined,

    locations: (sv.site_visit_measurements || []).map((m: any) => mapSiteVisitMeasurementFromDb(m))
  };
}

export function mapSiteVisitToDb(orderId: string, companyId: string, details: Partial<SiteVisitDetails>): any {
  return {
    order_id: orderId,
    company_id: companyId,
    completed: details.completed,

    customer_address: details.customerAddress,
    landmark: details.landmark,
    preferred_date: details.preferredDate,
    preferred_time: details.preferredTime,
    gps_location: details.gpsLocation,

    audit_date: details.auditDate,
    audit_time: details.auditTime,

    internal_notes: details.internalNotes,

    review_status: details.reviewStatus,

    // Installation Requirements
    scaffolding_required: details.scaffoldingRequired,
    crane_required: details.craneRequired,
    overnight_installation: details.overnightInstallation,

    // Fabrication Requirements
    extra_angles_required: details.extraAnglesRequired,
    extra_angles_length: details.extraAnglesLength,
    extra_acp_sheet_required: details.extraAcpSheetRequired,
    old_board_removal_required: details.oldBoardRemovalRequired,
    extra_wire_required: details.extraWireRequired,

    // Design Inputs
    design_brief_available: details.designBriefAvailable,
    fabrication_required: details.fabricationRequired,
    civil_work_required: details.civilWorkRequired,
  };
}
