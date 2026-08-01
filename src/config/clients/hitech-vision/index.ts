import { PrintOMSClientConfig } from "../../schema";

const edit = (...stages: Array<"site_visit" | "quotation" | "invoice" | "design" | "production" | "installation" | "service_tickets">) => {
  const map: NonNullable<PrintOMSClientConfig["stageGrantsByRole"]>[string] = {};
  for (const s of stages) map[s] = { canView: true, canEdit: true };
  return map;
};

export const hitechVisionConfig: Partial<PrintOMSClientConfig> = {
  id: "hitech-vision",
  name: "Hitech Vision",
  companyId: "44444444-4444-4444-4444-444444444444",
  colors: {
    primary: "#0ea5e9",
    onPrimary: "#ffffff",
    primaryContainer: "#e0f2fe",
    onPrimaryContainer: "#0369a1",
    secondary: "#64748b",
    onSecondary: "#ffffff",
    secondaryContainer: "#f1f5f9",
    onSecondaryContainer: "#334155",
    background: "#f8fafc",
    surface: "#ffffff",
    sidebarBg: "#0f172a",
    sidebarText: "#bae6fd",
    sidebarActiveBg: "#0284c7",
    sidebarActiveText: "#ffffff",
    sidebarAccent: "#38bdf8",
  },
  logoUrl: null,
  faviconUrl: null,
  loadingText: "HITECH VISION",
  features: {
    enableAdminAssignment: false,
    needsAttentionAfterDays: 6,
  },
  usesFloorPortals: false,
  stageGrantsByRole: {
    Production: edit("production", "service_tickets"),
    Installation: edit("site_visit", "installation"),
    Designer: edit("site_visit", "design"),
    Marketer: edit("site_visit", "quotation", "invoice"),
  },
  whatsappTemplatePrefix: "hitech_",
};
