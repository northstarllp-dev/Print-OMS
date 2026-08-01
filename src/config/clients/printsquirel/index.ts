import { PrintOMSClientConfig } from "../../schema";

const edit = (
  ...stages: Array<
    | "site_visit"
    | "quotation"
    | "invoice"
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

/** Print Squirel — light green / black / white brand. */
export const printsquirelConfig: Partial<PrintOMSClientConfig> = {
  id: "printsquirel",
  name: "Print Squirel",
  companyId: "55555555-5555-5555-5555-555555555555",
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
    sidebarActiveText: "#4ade80",
    sidebarAccent: "#4ade80",
  },
  logoUrl: "/clients/printsquirel/printsquirel.png",
  logoScale: 1.9,
  faviconUrl: "/clients/printsquirel/favicon_io/favicon.ico",
  loadingText: "PRINT SQUIREL",
  features: {
    enableAdminAssignment: false,
    needsAttentionAfterDays: 6,
  },
  usesFloorPortals: false,
  stageGrantsByRole: {
    Designer: edit("site_visit", "design"),
    Marketer: edit("site_visit", "quotation", "invoice"),
    "Production & Installation": edit(
      "site_visit",
      "production",
      "installation",
      "service_tickets"
    ),
  },
  whatsappTemplatePrefix: "printsquirel_",
};
