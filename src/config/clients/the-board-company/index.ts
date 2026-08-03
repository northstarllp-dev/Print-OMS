import { PrintOMSClientConfig } from "../../schema";

const edit = (...stages: Array<"enquiry" | "site_visit" | "quotation" | "invoice" | "design" | "production" | "installation" | "service_tickets">) => {
  const map: NonNullable<PrintOMSClientConfig["stageGrantsByRole"]>[string] = {};
  for (const s of stages) map[s] = { canView: true, canEdit: true };
  return map;
};

const view = (...stages: Array<"enquiry" | "site_visit" | "quotation" | "invoice" | "design" | "production" | "installation" | "service_tickets">) => {
  const map: NonNullable<PrintOMSClientConfig["stageGrantsByRole"]>[string] = {};
  for (const s of stages) map[s] = { canView: true, canEdit: false };
  return map;
};

export const theBoardCompanyConfig: Partial<PrintOMSClientConfig> = {
  id: "the-board-company",
  name: "The Board Company",
  companyId: "22222222-2222-2222-2222-222222222222",
  colors: {
    primary: "#2563eb",
    onPrimary: "#ffffff",
    primaryContainer: "#dbeafe",
    onPrimaryContainer: "#1e3a8a",
    secondary: "#2563eb",
    onSecondary: "#ffffff",
    secondaryContainer: "#dbeafe",
    onSecondaryContainer: "#1e3a8a",
    background: "#ffffff",
    surface: "#ffffff",
    sidebarBg: "#000000",
    sidebarText: "#ffffff",
    sidebarActiveBg: "#333333",
    sidebarActiveText: "#ead64a",
    sidebarAccent: "#ead64a",
  },
  logoUrl: "/clients/theboardcompany/logo.png",
  logoScale: 1.3,
  faviconUrl: "/clients/theboardcompany/favicon_io/favicon.ico",
  loadingText: "THE BOARD COMPANY",
  features: {
    enableAdminAssignment: true,
    needsAttentionAfterDays: 6,
  },
  usesFloorPortals: false,
  stageGrantsByRole: {
    Designer: { ...view("site_visit"), ...edit("design", "quotation", "invoice") },
    Finance: edit("quotation", "invoice"),
    "Production & Service": { ...view("site_visit"), ...edit("production", "service_tickets") },
    "Recce & Installation": edit("site_visit", "installation","production", "service_tickets"),
  },
  whatsappTemplatePrefix: "boardco_",
};
