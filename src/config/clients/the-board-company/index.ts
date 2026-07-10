import { PrintOMSClientConfig } from "../../schema";

export const theBoardCompanyConfig: Partial<PrintOMSClientConfig> = {
  id: "the-board-company",
  name: "The Board Company",
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
  faviconUrl: "/clients/theboardcompany/logo.png",
  loadingText: "THE BOARD COMPANY",
  features: {
    enableAdminAssignment: true,
  },
};
