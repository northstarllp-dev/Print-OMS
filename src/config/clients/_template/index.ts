import { PrintOMSClientConfig } from "../../schema";

/**
 * Copy this file when scaffolding a new client (see docs/printoms/ADD_CLIENT.md).
 * Replace PLACEHOLDER_* values before registering in registry.ts.
 */
const edit = (
  ...stages: Array<
    | "site_visit"
    | "quotation"
    | "design"
    | "production"
    | "installation"
    | "service_tickets"
  >
) => {
  const map: NonNullable<PrintOMSClientConfig["stageGrantsByRole"]>[string] = {};
  for (const s of stages) map[s] = { canView: true, canEdit: true };
  return map;
};

export const templateClientConfig: Partial<PrintOMSClientConfig> = {
  id: "PLACEHOLDER_SLUG",
  name: "PLACEHOLDER_NAME",
  companyId: "PLACEHOLDER_COMPANY_UUID",
  colors: {
    primary: "#1E40AF",
    onPrimary: "#ffffff",
    primaryContainer: "#dbeafe",
    onPrimaryContainer: "#1E40AF",
    secondary: "#1E40AF",
    onSecondary: "#ffffff",
    secondaryContainer: "#F1F3F6",
    onSecondaryContainer: "#1E40AF",
    background: "#F4F5F8",
    surface: "#ffffff",
    sidebarBg: "#0C0F1A",
    sidebarText: "#94A3B8",
    sidebarActiveBg: "#1A2035",
    sidebarActiveText: "#E2E8F0",
    sidebarAccent: "#F97316",
  },
  logoUrl: "/clients/PLACEHOLDER_SLUG/logo.png",
  faviconUrl: "/clients/PLACEHOLDER_SLUG/favicon_io/favicon.ico",
  loadingText: "PLACEHOLDER_NAME",
  features: {
    enableAdminAssignment: false,
  },
  usesFloorPortals: false,
  stageGrantsByRole: {
    Production: edit("production", "service_tickets"),
    Installation: edit("site_visit", "installation"),
    Designer: edit("site_visit", "design"),
    Marketer: edit("site_visit", "quotation"),
  },
  whatsappTemplatePrefix: "PLACEHOLDER_SLUG_",
};
