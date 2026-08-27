/**
 * Site Visit checklist rules pure helpers for unit tests.
 * Encodes shipped behavior where it exists, and recommended multi-tenant
 * defaults (config) for gaps so nothing in the review checklist is untested.
 */

import { isSiteVisitAuditFrozen } from "./siteVisitFreeze";
import {
  canAdvanceSiteVisitAudit,
  canSubmitSiteVisitSchedule,
  isSiteVisitSlotBooked,
  isSiteVisitUiFrozen,
  parseGpsMapCenter,
} from "./siteVisitUiLogic";

export type SiteVisitChecklistRole =
  | "admin"
  | "marketer"
  | "site_visit_employee"
  | "designer"
  | "production"
  | "customer";

export type SiteVisitCapability =
  | "view_all"
  | "view_assigned"
  | "edit_any"
  | "edit_assigned"
  | "delete"
  | "delete_completed"
  | "approve_schedule"
  | "reject_schedule"
  | "approve_completed"
  | "reject_completed"
  | "override_measurements"
  | "override_employee"
  | "reassign_employee"
  | "view_internal_notes"
  | "add_internal_notes"
  | "change_workflow"
  | "schedule"
  | "reschedule"
  | "enter_measurements"
  | "upload_photos"
  | "upload_documents"
  | "add_notes"
  | "request_admin_approval"
  | "approve_own_work"
  | "check_in"
  | "check_out"
  | "capture_gps"
  | "complete_checklist"
  | "edit_after_approval"
  | "view_measurements"
  | "view_photos"
  | "view_notes"
  | "view_final_approved_only"
  | "customer_schedule"
  | "customer_reschedule_before_confirm"
  | "customer_view_status"
  | "customer_view_summary"
  | "edit_measurements_as_customer"
  | "edit_internal_notes_as_customer";

const CAPABILITY_KEYS: Record<SiteVisitCapability, true> = {
  view_all: true,
  view_assigned: true,
  edit_any: true,
  edit_assigned: true,
  delete: true,
  delete_completed: true,
  approve_schedule: true,
  reject_schedule: true,
  approve_completed: true,
  reject_completed: true,
  override_measurements: true,
  override_employee: true,
  reassign_employee: true,
  view_internal_notes: true,
  add_internal_notes: true,
  change_workflow: true,
  schedule: true,
  reschedule: true,
  enter_measurements: true,
  upload_photos: true,
  upload_documents: true,
  add_notes: true,
  request_admin_approval: true,
  approve_own_work: true,
  check_in: true,
  check_out: true,
  capture_gps: true,
  complete_checklist: true,
  edit_after_approval: true,
  view_measurements: true,
  view_photos: true,
  view_notes: true,
  view_final_approved_only: true,
  customer_schedule: true,
  customer_reschedule_before_confirm: true,
  customer_view_status: true,
  customer_view_summary: true,
  edit_measurements_as_customer: true,
  edit_internal_notes_as_customer: true,
};

function caps(
  enabled: SiteVisitCapability[]
): Record<SiteVisitCapability, boolean> {
  const out = {} as Record<SiteVisitCapability, boolean>;
  for (const c of Object.keys(CAPABILITY_KEYS) as SiteVisitCapability[]) {
    out[c] = false;
  }
  for (const c of enabled) out[c] = true;
  return out;
}

/** Checklist §1 RBAC matrix (product intent). */
export function siteVisitCapabilities(
  role: SiteVisitChecklistRole
): Record<SiteVisitCapability, boolean> {
  switch (role) {
    case "admin":
      return caps([
        "view_all",
        "edit_any",
        "delete",
        "delete_completed",
        "approve_schedule",
        "reject_schedule",
        "approve_completed",
        "reject_completed",
        "override_measurements",
        "override_employee",
        "reassign_employee",
        "view_internal_notes",
        "add_internal_notes",
        "change_workflow",
        "schedule",
        "reschedule",
        "enter_measurements",
        "upload_photos",
        "upload_documents",
        "add_notes",
        "request_admin_approval",
        "approve_own_work",
        "view_measurements",
        "view_photos",
        "view_notes",
        "edit_after_approval",
      ]);
    case "marketer":
      return caps([
        "view_assigned",
        "schedule",
        "reschedule",
        "enter_measurements",
        "upload_photos",
        "upload_documents",
        "add_notes",
        "request_admin_approval",
        "view_measurements",
        "view_photos",
        "view_notes",
        "view_internal_notes",
        "add_internal_notes",
      ]);
    case "site_visit_employee":
      return caps([
        "view_assigned",
        "check_in",
        "check_out",
        "upload_photos",
        "capture_gps",
        "enter_measurements",
        "complete_checklist",
        "request_admin_approval",
        "view_measurements",
        "view_photos",
        "view_notes",
        "add_notes",
      ]);
    case "designer":
      return caps(["view_assigned", "view_measurements", "view_photos", "view_notes"]);
    case "production":
      return caps([
        "view_assigned",
        "view_final_approved_only",
        "view_photos",
      ]);
    case "customer":
      return caps([
        "customer_schedule",
        "customer_reschedule_before_confirm",
        "customer_view_status",
        "customer_view_summary",
      ]);
  }
}

export function can(role: SiteVisitChecklistRole, capability: SiteVisitCapability): boolean {
  return siteVisitCapabilities(role)[capability] === true;
}

/** Cannot approve own work (marketer / field staff). */
export function canApproveOwnSiteVisitWork(role: SiteVisitChecklistRole): boolean {
  return can(role, "approve_own_work");
}

/** Edit after approval only if admin reopen / unlock. */
export function canEditSiteVisitAfterApproval(input: {
  role: SiteVisitChecklistRole;
  stage: string;
  stageStatus?: string;
  completed: boolean;
  adminReopened?: boolean;
}): boolean {
  if (input.adminReopened && can(input.role, "edit_after_approval")) return true;
  if (isSiteVisitAuditFrozen(input.stage, input.stageStatus, input.completed)) {
    return can(input.role, "edit_after_approval") && !!input.adminReopened;
  }
  return can(input.role, "enter_measurements") || can(input.role, "edit_any");
}

// ── §2 Scheduling / config defaults ─────────────────────────────────────────

export interface SiteVisitCompanyConfig {
  maxMeasurementItems: number;
  maxPhotosPerItem: number;
  allowedFileTypes: string[];
  maxUploadSizeMb: number;
  workingHoursStart: string; // "09:00"
  workingHoursEnd: string; // "18:00"
  visitDurationMinutes: number;
  bufferMinutes: number;
  maxReschedules: number;
  gpsRequired: boolean;
  mandatoryPhotos: boolean;
  mandatoryCustomerSignature: boolean;
  approvalRequired: boolean;
  autoStageProgression: boolean;
  holidays: string[]; // YYYY-MM-DD
}

export function defaultSiteVisitConfig(
  overrides?: Partial<SiteVisitCompanyConfig>
): SiteVisitCompanyConfig {
  return {
    maxMeasurementItems: 20,
    maxPhotosPerItem: 10,
    allowedFileTypes: ["jpg", "jpeg", "png", "pdf"],
    maxUploadSizeMb: 20,
    workingHoursStart: "09:00",
    workingHoursEnd: "18:00",
    visitDurationMinutes: 60,
    bufferMinutes: 30,
    maxReschedules: 3,
    gpsRequired: true,
    mandatoryPhotos: true,
    mandatoryCustomerSignature: false,
    approvalRequired: true,
    autoStageProgression: false,
    holidays: [],
    ...overrides,
  };
}

function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export function isWithinWorkingHours(
  time: string,
  config: SiteVisitCompanyConfig = defaultSiteVisitConfig()
): boolean {
  const t = timeToMinutes(time);
  return t >= timeToMinutes(config.workingHoursStart) && t <= timeToMinutes(config.workingHoursEnd);
}

export function isHoliday(
  date: string,
  config: SiteVisitCompanyConfig = defaultSiteVisitConfig()
): boolean {
  return config.holidays.includes(date);
}

export function slotsOverlap(
  aStart: string,
  aDurationMin: number,
  bStart: string,
  bDurationMin: number,
  bufferMin: number
): boolean {
  const a0 = timeToMinutes(aStart);
  const a1 = a0 + aDurationMin + bufferMin;
  const b0 = timeToMinutes(bStart);
  const b1 = b0 + bDurationMin + bufferMin;
  return a0 < b1 && b0 < a1;
}

export function hasEmployeeScheduleConflict(input: {
  employeeId: string;
  date: string;
  time: string;
  excludeOrderId?: string;
  existing: Array<{
    orderId: string;
    employeeId: string;
    date: string;
    time: string;
  }>;
  config?: SiteVisitCompanyConfig;
}): boolean {
  const config = input.config ?? defaultSiteVisitConfig();
  return input.existing.some((e) => {
    if (input.excludeOrderId && e.orderId === input.excludeOrderId) return false;
    if (e.employeeId !== input.employeeId || e.date !== input.date) return false;
    return slotsOverlap(
      input.time,
      config.visitDurationMinutes,
      e.time,
      config.visitDurationMinutes,
      config.bufferMinutes
    );
  });
}

export function canCreateSchedule(input: {
  date: string;
  time: string;
  address?: string | null;
  config?: SiteVisitCompanyConfig;
  ordersForSlotConflict?: Parameters<typeof isSiteVisitSlotBooked>[0];
  excludeOrderId?: string;
}): { ok: boolean; reason?: string } {
  const config = input.config ?? defaultSiteVisitConfig();
  if (!canSubmitSiteVisitSchedule({
    selectedDate: input.date,
    selectedTime: input.time,
    siteAddress: input.address ?? "x",
  })) {
    return { ok: false, reason: "missing_fields" };
  }
  if (isHoliday(input.date, config)) return { ok: false, reason: "holiday" };
  if (!isWithinWorkingHours(input.time, config)) {
    return { ok: false, reason: "outside_working_hours" };
  }
  if (
    input.ordersForSlotConflict &&
    isSiteVisitSlotBooked(
      input.ordersForSlotConflict,
      input.date,
      input.time,
      input.excludeOrderId
    )
  ) {
    return { ok: false, reason: "slot_conflict" };
  }
  return { ok: true };
}

export type ScheduleConfirmation =
  | "draft"
  | "pending_employee"
  | "pending_admin"
  | "confirmed"
  | "rejected";

export function canCustomerReschedule(input: {
  confirmation: ScheduleConfirmation;
  rescheduleCount: number;
  config?: SiteVisitCompanyConfig;
}): boolean {
  const config = input.config ?? defaultSiteVisitConfig();
  if (input.rescheduleCount >= config.maxReschedules) return false;
  // Before confirmation only (checklist).
  return (
    input.confirmation === "draft" ||
    input.confirmation === "pending_employee" ||
    input.confirmation === "pending_admin" ||
    input.confirmation === "rejected"
  );
}

export function canAdminOverrideSchedule(role: SiteVisitChecklistRole): boolean {
  return can(role, "approve_schedule") || can(role, "edit_any");
}

export type ScheduleApprovalStep =
  | "customer_schedule"
  | "employee_approve"
  | "admin_approve"
  | "confirmed"
  | "back_to_scheduling";

export function nextScheduleApprovalStep(
  current: ScheduleApprovalStep,
  decision: "approve" | "reject" | "submit"
): ScheduleApprovalStep {
  if (decision === "reject") return "back_to_scheduling";
  if (current === "customer_schedule" && decision === "submit") return "employee_approve";
  if (current === "employee_approve" && decision === "approve") return "admin_approve";
  if (current === "admin_approve" && decision === "approve") return "confirmed";
  if (current === "back_to_scheduling" && decision === "submit") return "employee_approve";
  return current;
}

// ── §3 Workflow transitions ─────────────────────────────────────────────────

export const SITE_VISIT_PIPELINE = [
  "Enquiry",
  "Site Visit Pending",
  "Site Visit Scheduled",
  "Site Visit Completed",
  "Pending Admin Approval: Site Visit Completed",
  "Quotation In Progress",
] as const;

export type SiteVisitPipelineStage = (typeof SITE_VISIT_PIPELINE)[number];

/** Valid forward transitions in the site-visit slice of the order pipeline. */
export function isValidSiteVisitStageTransition(
  from: string,
  to: string
): boolean {
  const allowed: Record<string, string[]> = {
    Enquiry: ["Site Visit Pending"],
    "Site Visit Pending": ["Site Visit Scheduled", "Site Visit Completed"],
    "Site Visit Scheduled": ["Site Visit Completed", "Site Visit Pending"],
    "Site Visit Completed": [
      "Pending Admin Approval: Site Visit Completed",
      "Quotation In Progress",
      "Design In Progress", // design_first
    ],
    "Pending Admin Approval: Site Visit Completed": [
      "Site Visit Completed", // reject → back
      "Quotation In Progress",
      "Design In Progress",
    ],
  };
  return (allowed[from] || []).includes(to);
}

export function canActorRequestStageAdvance(role: SiteVisitChecklistRole): boolean {
  return can(role, "request_admin_approval");
}

export function canActorApproveStage(role: SiteVisitChecklistRole): boolean {
  return can(role, "approve_completed");
}

// ── §4–5 Form + measurements ────────────────────────────────────────────────

export type SiteVisitFieldType =
  | "text"
  | "number"
  | "boolean"
  | "photo"
  | "gps"
  | "select";

export interface SiteVisitFormFieldDef {
  id: string;
  label: string;
  type: SiteVisitFieldType;
  required: boolean;
  visibleTo: SiteVisitChecklistRole[];
  order: number;
}

export function standardSiteVisitFormFields(): SiteVisitFormFieldDef[] {
  const allStaff: SiteVisitChecklistRole[] = [
    "admin",
    "marketer",
    "site_visit_employee",
    "designer",
    "production",
  ];
  return [
    { id: "customer", label: "Customer", type: "text", required: true, visibleTo: [...allStaff, "customer"], order: 1 },
    { id: "address", label: "Address", type: "text", required: true, visibleTo: [...allStaff, "customer"], order: 2 },
    { id: "gps", label: "GPS", type: "gps", required: true, visibleTo: allStaff, order: 3 },
    { id: "measurements", label: "Measurements", type: "text", required: true, visibleTo: allStaff, order: 4 },
    { id: "photos", label: "Photos", type: "photo", required: true, visibleTo: allStaff, order: 5 },
    { id: "power", label: "Power", type: "boolean", required: false, visibleTo: allStaff, order: 6 },
    { id: "wall_type", label: "Wall Type", type: "select", required: false, visibleTo: allStaff, order: 7 },
    { id: "budget", label: "Budget", type: "number", required: false, visibleTo: ["admin", "marketer"], order: 8 },
    { id: "requirements", label: "Requirements", type: "text", required: false, visibleTo: allStaff, order: 9 },
    { id: "notes", label: "Notes", type: "text", required: false, visibleTo: allStaff, order: 10 },
    { id: "internal_notes", label: "Internal Notes", type: "text", required: false, visibleTo: ["admin", "marketer"], order: 11 },
  ];
}

export function fieldsVisibleTo(
  fields: SiteVisitFormFieldDef[],
  role: SiteVisitChecklistRole
): SiteVisitFormFieldDef[] {
  return fields.filter((f) => f.visibleTo.includes(role)).sort((a, b) => a.order - b.order);
}

export function validateDynamicSiteVisitForm(
  values: Record<string, unknown>,
  fields: SiteVisitFormFieldDef[],
  role: SiteVisitChecklistRole
): string[] {
  const errors: string[] = [];
  for (const f of fieldsVisibleTo(fields, role)) {
    if (!f.required) continue;
    const v = values[f.id];
    if (v == null || v === "" || (Array.isArray(v) && v.length === 0)) {
      errors.push(`${f.id}_required`);
    }
  }
  return errors;
}

export function canAddMeasurementItem(
  currentCount: number,
  config: SiteVisitCompanyConfig = defaultSiteVisitConfig()
): boolean {
  return currentCount < config.maxMeasurementItems;
}

export function canAddPhotoToItem(
  currentPhotos: number,
  config: SiteVisitCompanyConfig = defaultSiteVisitConfig()
): boolean {
  return currentPhotos < config.maxPhotosPerItem;
}

export function isUploadAllowed(
  file: { name: string; sizeBytes: number },
  config: SiteVisitCompanyConfig = defaultSiteVisitConfig()
): { ok: boolean; reason?: string } {
  const ext = (file.name.split(".").pop() || "").toLowerCase();
  if (!config.allowedFileTypes.includes(ext)) {
    return { ok: false, reason: "file_type" };
  }
  if (file.sizeBytes > config.maxUploadSizeMb * 1024 * 1024) {
    return { ok: false, reason: "file_size" };
  }
  return { ok: true };
}

// ── §6 GPS ──────────────────────────────────────────────────────────────────

const EARTH_RADIUS_M = 6371000;

export function haversineDistanceMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

export function isGpsAccurateEnough(accuracyMeters: number, maxAccuracy = 50): boolean {
  return Number.isFinite(accuracyMeters) && accuracyMeters > 0 && accuracyMeters <= maxAccuracy;
}

export function isNearScheduledLocation(input: {
  currentGps: string;
  scheduledGps: string;
  maxDistanceMeters?: number;
}): boolean {
  const cur = parseGpsMapCenter(input.currentGps);
  const sched = parseGpsMapCenter(input.scheduledGps);
  if (!cur || !sched) return false;
  return (
    haversineDistanceMeters(cur, sched) <= (input.maxDistanceMeters ?? 200)
  );
}

export function gpsCheckInPayload(input: {
  lat: number;
  lng: number;
  accuracyMeters: number;
  at?: Date;
}): { gps: string; accuracyMeters: number; timestamp: string } {
  return {
    gps: `${input.lat}, ${input.lng}`,
    accuracyMeters: input.accuracyMeters,
    timestamp: (input.at ?? new Date()).toISOString(),
  };
}

// ── §7 Media paths ──────────────────────────────────────────────────────────

export function buildSiteVisitStoragePath(input: {
  companyId: string;
  orderId: string;
  measurementId: string;
  fileName: string;
}): string {
  const safe = input.fileName.replace(/[/\\]/g, "_");
  return `${input.companyId}/${input.orderId}/site-visit/${input.measurementId}/${safe}`;
}

/** When a measurement is deleted, storage objects for that item must be removed. */
export function mediaDeletePlan(input: {
  measurementDeleted: boolean;
  photoPaths: string[];
}): { deleteDbRow: boolean; storagePaths: string[] } {
  if (!input.measurementDeleted) {
    return { deleteDbRow: false, storagePaths: [] };
  }
  return { deleteDbRow: true, storagePaths: [...input.photoPaths] };
}

// ── §8 Backend ops ──────────────────────────────────────────────────────────

export type SiteVisitMutation =
  | "create"
  | "update"
  | "delete"
  | "archive"
  | "restore"
  | "autosave";

export function siteVisitMutationAllowed(
  mutation: SiteVisitMutation,
  role: SiteVisitChecklistRole
): boolean {
  if (mutation === "create" || mutation === "update" || mutation === "autosave") {
    return (
      can(role, "edit_any") ||
      can(role, "edit_assigned") ||
      can(role, "enter_measurements") ||
      can(role, "schedule") ||
      can(role, "customer_schedule")
    );
  }
  if (mutation === "delete" || mutation === "archive") {
    return can(role, "delete");
  }
  if (mutation === "restore") return can(role, "edit_any");
  return false;
}

export function validateSiteVisitSave(input: {
  address?: string | null;
  gps?: string | null;
  locationsCount: number;
  config?: SiteVisitCompanyConfig;
}): string[] {
  const config = input.config ?? defaultSiteVisitConfig();
  const errors: string[] = [];
  if (!input.address?.trim()) errors.push("address_required");
  if (config.gpsRequired && !parseGpsMapCenter(input.gps)) errors.push("gps_required");
  if (input.locationsCount > config.maxMeasurementItems) {
    errors.push("too_many_measurements");
  }
  return errors;
}

// ── §10 Concurrency ─────────────────────────────────────────────────────────

export function isStaleSiteVisitSave(input: {
  clientVersion: number;
  serverVersion: number;
}): boolean {
  return input.clientVersion < input.serverVersion;
}

export function resolveConcurrentEdit(input: {
  clientVersion: number;
  serverVersion: number;
}): "accept" | "reject_stale" {
  return isStaleSiteVisitSave(input) ? "reject_stale" : "accept";
}

// ── §11 Notifications ───────────────────────────────────────────────────────

export type SiteVisitNotifyAudience = "customer" | "employee" | "admin";

export function siteVisitNotificationEvents(event: string): SiteVisitNotifyAudience[] {
  const map: Record<string, SiteVisitNotifyAudience[]> = {
    schedule_created: ["customer", "employee", "admin"],
    schedule_approved: ["customer", "employee"],
    schedule_rejected: ["customer", "employee"],
    rescheduled: ["customer", "employee", "admin"],
    visit_completed: ["customer", "admin"],
    new_assignment: ["employee"],
    pending_approval: ["admin"],
  };
  return map[event] || [];
}

// ── §12 Buttons ─────────────────────────────────────────────────────────────

export type SiteVisitButton =
  | "schedule"
  | "reschedule"
  | "approve"
  | "reject"
  | "save"
  | "draft"
  | "complete"
  | "delete"
  | "cancel"
  | "upload"
  | "view_photos"
  | "open_maps"
  | "call_customer"
  | "directions";

export function siteVisitButtonState(input: {
  button: SiteVisitButton;
  role: SiteVisitChecklistRole;
  loading?: boolean;
}): {
  visible: boolean;
  enabled: boolean;
  loading: boolean;
  requiresAudit: boolean;
} {
  const loading = !!input.loading;
  const permissionMap: Record<SiteVisitButton, SiteVisitCapability | null> = {
    schedule: "schedule",
    reschedule: "reschedule",
    approve: "approve_completed",
    reject: "reject_completed",
    save: "enter_measurements",
    draft: "enter_measurements",
    complete: "request_admin_approval",
    delete: "delete",
    cancel: "schedule",
    upload: "upload_photos",
    view_photos: "view_photos",
    open_maps: "view_assigned",
    call_customer: "view_assigned",
    directions: "view_assigned",
  };

  // Admin fallbacks
  let capability = permissionMap[input.button];
  let allowed = capability ? can(input.role, capability) : false;
  if (!allowed && can(input.role, "edit_any")) {
    if (["schedule", "reschedule", "save", "draft", "upload", "delete", "approve", "reject", "complete"].includes(input.button)) {
      allowed = true;
    }
  }
  if (input.role === "customer") {
    if (input.button === "schedule") allowed = can(input.role, "customer_schedule");
    if (input.button === "reschedule") {
      allowed = can(input.role, "customer_reschedule_before_confirm");
    }
    if (["view_photos", "open_maps", "directions"].includes(input.button)) {
      allowed = can(input.role, "customer_view_summary");
    }
  }
  if (["view_photos", "open_maps", "directions", "call_customer"].includes(input.button)) {
    allowed =
      allowed ||
      can(input.role, "view_photos") ||
      can(input.role, "view_assigned") ||
      can(input.role, "view_all") ||
      can(input.role, "customer_view_summary");
  }

  return {
    visible: allowed,
    enabled: allowed && !loading,
    loading,
    requiresAudit: ["approve", "reject", "complete", "delete", "schedule", "reschedule"].includes(
      input.button
    ),
  };
}

// ── §16 KPIs ────────────────────────────────────────────────────────────────

export interface SiteVisitKpiRow {
  status:
    | "scheduled"
    | "completed"
    | "cancelled"
    | "rescheduled"
    | "no_show";
  visitMinutes?: number;
  approvalMinutes?: number;
  measurementCount?: number;
  photoCount?: number;
  employeeId?: string;
}

export function computeSiteVisitKpis(rows: SiteVisitKpiRow[]) {
  const scheduled = rows.filter((r) => r.status === "scheduled").length;
  const completed = rows.filter((r) => r.status === "completed").length;
  const cancelled = rows.filter((r) => r.status === "cancelled").length;
  const rescheduled = rows.filter((r) => r.status === "rescheduled").length;
  const noShow = rows.filter((r) => r.status === "no_show").length;
  const completedRows = rows.filter((r) => r.status === "completed");
  const avg = (vals: number[]) =>
    vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;

  const byEmployee = new Map<string, number>();
  for (const r of completedRows) {
    if (!r.employeeId) continue;
    byEmployee.set(r.employeeId, (byEmployee.get(r.employeeId) || 0) + 1);
  }

  return {
    scheduled,
    completed,
    cancelled,
    rescheduled,
    noShow,
    averageVisitTime: avg(completedRows.map((r) => r.visitMinutes || 0)),
    averageApprovalTime: avg(completedRows.map((r) => r.approvalMinutes || 0)),
    averageMeasurements: avg(completedRows.map((r) => r.measurementCount || 0)),
    averagePhotos: avg(completedRows.map((r) => r.photoCount || 0)),
    employeeProductivity: Object.fromEntries(byEmployee),
  };
}

// ── §17 Audit ───────────────────────────────────────────────────────────────

export const SITE_VISIT_AUDIT_ACTIONS = [
  "customer_scheduled",
  "employee_confirmed",
  "admin_approved",
  "admin_rejected",
  "employee_uploaded_photos",
  "measurements_updated",
  "visit_completed",
  "admin_approved_completion",
  "rescheduled",
  "deleted",
] as const;

export type SiteVisitAuditAction = (typeof SITE_VISIT_AUDIT_ACTIONS)[number];

export function buildSiteVisitAuditEntry(input: {
  action: SiteVisitAuditAction;
  orderId: string;
  companyId: string;
  actorName: string;
  actorRole: string;
}): {
  order_id: string;
  company_id: string;
  actor_name: string;
  actor_role: string;
  content: string;
  metadata: { action: SiteVisitAuditAction; module: "site_visit" };
} {
  if (!input.companyId) throw new Error("company_id required for audit");
  return {
    order_id: input.orderId,
    company_id: input.companyId,
    actor_name: input.actorName,
    actor_role: input.actorRole,
    content: `Site visit: ${input.action.replace(/_/g, " ")}`,
    metadata: { action: input.action, module: "site_visit" },
  };
}

// ── Re-exports used by checklist tests ──────────────────────────────────────

export {
  canAdvanceSiteVisitAudit,
  canSubmitSiteVisitSchedule,
  isSiteVisitSlotBooked,
  isSiteVisitUiFrozen,
  isSiteVisitAuditFrozen,
  parseGpsMapCenter,
};
