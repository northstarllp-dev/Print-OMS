export type OrderStage =
  | "enquiry"
  | "site_visit"
  | "quotation"
  | "invoice"
  | "design"
  | "production"
  | "installation"
  | "service_tickets";

export interface StagePermission {
  canView: boolean;
  canEdit: boolean;
}

/** Temporary actor shape from existing profile (role / staff_role / tenant). */
export interface StageActor {
  role: string;
  staff_role?: string | null;
  /** Tenant key for per-company stage grant overrides (Phase 4b). Falls back to default matrix when absent. */
  company_id?: string | null;
}

export interface StageModuleProps<TData, TCallbacks> {
  data: TData;
  permission?: StagePermission;
  callbacks: TCallbacks;
}
