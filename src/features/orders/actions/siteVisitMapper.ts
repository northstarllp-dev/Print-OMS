import { SiteVisitDetails, SignLocation } from "@/types";

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

    locations: (sv.site_visit_measurements || []).map((m: any) => ({
      id: m.id,
      name: m.name,
      width: m.width,
      widthUnit: m.width_unit || "ft",
      height: m.height,
      heightUnit: m.height_unit || "ft",
      depth: m.depth,
      depthUnit: m.depth_unit || "ft",
      groundClearance: m.ground_clearance,
      groundClearanceUnit: m.ground_clearance_unit || "ft",
      notes: m.notes,
      photos: m.photos || [],
      powerAvailable: m.power_available,
      distanceToPowerSource: m.distance_to_power_source,
      distanceToPowerSourceUnit: m.distance_to_power_source_unit,
      electricalNotes: m.electrical_notes,
      wallType: m.wall_type,
      mountingMethod: m.mounting_method,
      surfaceCondition: m.surface_condition,
      obstacles: m.obstacles || [],
      structuralNotes: m.structural_notes
    }))
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
