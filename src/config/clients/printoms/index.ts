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
    needsAttentionAfterDays: 6,
    enquiryNeedsAttentionAfterDays: 5,
    enableCustomerPickup: true,
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
      stages: ["enquiry", "quotation", "design", "production", "installation"],
    },
  ],
  usesFloorPortals: true,
  stageGrantsByRole: {
    Designer: { ...view("site_visit"), ...edit("design", "quotation", "invoice") },
    Production: { ...view("site_visit"), ...edit("production", "service_tickets") },
    Installation: edit("installation"),
    Marketer: { ...view("enquiry"), ...edit("site_visit", "quotation", "invoice") },
  },
  whatsappTemplatePrefix: "printoms_",
};
