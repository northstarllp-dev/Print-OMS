import { PrintOMSClientConfig } from "../../schema";

const edit = (...stages: Array<"enquiry" | "site_visit" | "quotation" | "invoice" | "design" | "production" | "installation" | "service_tickets">) => {
  const map: NonNullable<PrintOMSClientConfig["stageGrantsByRole"]>[string] = {};
  for (const s of stages) map[s] = { canView: true, canEdit: true };
  return map;
};

export const printecConfig: Partial<PrintOMSClientConfig> = {
  id: "printec",
  name: "Printec",
  companyId: "33333333-3333-3333-3333-333333333333",
  colors: {
    primary: "#13b5ea",
    onPrimary: "#ffffff",
    primaryContainer: "#e0f6ff",
    onPrimaryContainer: "#13b5ea",
    secondary: "#e41c8a",
    onSecondary: "#ffffff",
    secondaryContainer: "#fdecf5",
    onSecondaryContainer: "#80004a",
    background: "#f8fafc",
    surface: "#ffffff",
    sidebarBg: "#000000",
    sidebarText: "#d1d5db",
    sidebarActiveBg: "#3a3637",
    sidebarActiveText: "#fcd900",
    sidebarAccent: "#fcd900",
  },
  logoUrl: "/clients/printec/logo.png",
  logoScale: 1,
  faviconUrl: "/clients/printec/favicon_io/favicon.ico",
  loadingText: "PRINTEC",
  features: {
    enableAdminAssignment: false,
    needsAttentionAfterDays: 6,
  },
  usesFloorPortals: false,
  stageGrantsByRole: {
    Production: edit("production", "service_tickets"),
    Installation: edit("site_visit", "installation"),
    Designer: edit("site_visit", "design"),
    Marketer: edit("enquiry", "site_visit", "quotation", "invoice"),
  },
  // Existing Meta templates were approved under the printec_ prefix
  whatsappTemplatePrefix: "printec_",
};
