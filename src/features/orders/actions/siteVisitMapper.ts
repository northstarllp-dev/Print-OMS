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
  let label = `Site Measurement: ${item.width ?? "—"} ${wUnit} × ${item.height ?? "—"} ${hUnit}`;
  if (item.depth != null && item.depth !== 0) {
    label += ` - Depth: ${item.depth} ${dUnit}`;
  }
  return label;
}

export function mapSiteVisitFromDb(sv: any): SiteVisitDetails | null {
  if (!sv) return null;

  return {
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
    scaffoldingRequired: sv.scaffolding_required ?? false,
    craneRequired: sv.crane_required ?? false,
    overnightInstallation: sv.overnight_installation ?? false,

    // Fabrication Requirements
    extraAnglesRequired: sv.extra_angles_required ?? false,
    extraAnglesLength: sv.extra_angles_length ?? "",
    extraAcpSheetRequired: sv.extra_acp_sheet_required ?? false,
    oldBoardRemovalRequired: sv.old_board_removal_required ?? false,
    extraWireRequired: sv.extra_wire_required ?? false,

    // Design Inputs
    designBriefAvailable: sv.design_brief_available ?? undefined,
    fabricationRequired: sv.fabrication_required ?? false,
    civilWorkRequired: sv.civil_work_required ?? false,

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
