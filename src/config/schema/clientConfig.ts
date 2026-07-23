import { ThemeColors } from "./theme";
import { FeaturesConfig } from "./features";

/** Stage permission shape used in client workflow config (mirrors stageGrants). */
export type StagePermissionConfig = { canView: boolean; canEdit: boolean };

export type RoleStageGrantMapConfig = Partial<
  Record<
    | "site_visit"
    | "quotation"
    | "design"
    | "production"
    | "installation"
    | "service_tickets",
    StagePermissionConfig
  >
>;

export interface PrintOMSClientConfig {
  /** Client slug (matches companies.slug / CLIENT_SLUG). Never use as DB company_id. */
  id: string;
  name: string;
  /** Primary tenant UUID in public.companies — use this for all company_id DB/API values */
  companyId: string;
  /** Optional extra company UUIDs for this deploy (defaults to [companyId]) */
  companyIds?: string[];
  colors: ThemeColors;
  logoUrl: string | null;
  logoScale?: number;
  faviconUrl?: string | null;
  loadingText?: string;
  features: FeaturesConfig;
  /** Dedicated /production and /installation floor portals */
  usesFloorPortals?: boolean;
  /** Per staff_role stage grant overrides (falls back to DEFAULT_STAGE_GRANTS_BY_ROLE) */
  stageGrantsByRole?: Record<string, RoleStageGrantMapConfig>;
  /** Meta WhatsApp template name prefix, e.g. "printec_" */
  whatsappTemplatePrefix?: string;
  /** Optional full Meta template name overrides keyed by internal WhatsAppTemplateKey */
  whatsappTemplateOverrides?: Partial<Record<string, string>>;
}
