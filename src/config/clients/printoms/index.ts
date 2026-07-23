import { PrintOMSClientConfig } from "../../schema";

const edit = (...stages: Array<"site_visit" | "quotation" | "design" | "production" | "installation" | "service_tickets">) => {
  const map: NonNullable<PrintOMSClientConfig["stageGrantsByRole"]>[string] = {};
  for (const s of stages) map[s] = { canView: true, canEdit: true };
  return map;
};

const view = (...stages: Array<"site_visit" | "quotation" | "design" | "production" | "installation" | "service_tickets">) => {
  const map: NonNullable<PrintOMSClientConfig["stageGrantsByRole"]>[string] = {};
  for (const s of stages) map[s] = { canView: true, canEdit: false };
  return map;
};

export const defaultConfig: PrintOMSClientConfig = {
  id: "printoms",
  name: "Printoms",
  companyId: "11111111-1111-1111-1111-111111111111",
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
    surface: "#F4F5F8",
    sidebarBg: "#0C0F1A",
    sidebarText: "#94A3B8",
    sidebarActiveBg: "#1A2035",
    sidebarActiveText: "#E2E8F0",
    sidebarAccent: "#F97316",
  },
  logoUrl: "/clients/printoms/light withoutbg.png",
  logoScale: 1.8,
  faviconUrl: "/clients/printoms/favicon_io/favicon.ico",
  loadingText: "PRINTOMS",
  features: {
    enableAdminAssignment: false,
  },
  usesFloorPortals: true,
  stageGrantsByRole: {
    Designer: { ...view("site_visit"), ...edit("design", "quotation") },
    Production: { ...view("site_visit"), ...edit("production", "service_tickets") },
    Installation: edit("installation"),
    Marketer: edit("site_visit", "quotation"),
  },
  whatsappTemplatePrefix: "printoms_",
};
