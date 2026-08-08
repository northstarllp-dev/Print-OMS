import { PrintOMSClientConfig } from "../../schema";

type Stage =
  | "enquiry"
  | "site_visit"
  | "quotation"
  | "invoice"
  | "design"
  | "production"
  | "installation"
  | "service_tickets";

const edit = (...stages: Stage[]) => {
  const map: NonNullable<PrintOMSClientConfig["stageGrantsByRole"]>[string] = {};
  for (const s of stages) map[s] = { canView: true, canEdit: true };
  return map;
};

const view = (...stages: Stage[]) => {
  const map: NonNullable<PrintOMSClientConfig["stageGrantsByRole"]>[string] = {};
  for (const s of stages) map[s] = { canView: true, canEdit: false };
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
  logoScale: 3,
  faviconUrl: "/clients/printsquirel/favicon_io/favicon.ico",
  loadingText: "PRINT SQUIREL",
  features: {
    enableAdminAssignment: false,
    needsAttentionAfterDays: 6,
    siteVisit: {
      hideElectricalAssessment: true,
    }
  },
  businessOperations: [
    {
      id: "signage",
      label: "Signage",
      stages: [
        "enquiry",
        "site_visit",
        "quotation",
        "design",
        "production",
        "installation",
      ],
    },
    {
      id: "flex_printing",
      label: "Flex Printing",
      // Enquiries → Design → Quote → Production (no site visit / installation).
      stages: ["enquiry", "design", "quotation", "production"],
    },
  ],
  usesFloorPortals: false,
  stageGrantsByRole: {
    Designer: { ...view("site_visit"), ...edit("design", "quotation", "invoice") },
    Marketer: edit("enquiry", "site_visit", "design", "quotation", "invoice"),
    "Production & Installation": { ...view("site_visit"), ...edit("production", "installation", "service_tickets") },
  },
  whatsappTemplatePrefix: "printsquirel_",
};
