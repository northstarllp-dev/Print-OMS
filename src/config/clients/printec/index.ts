import { PrintOMSClientConfig } from "../../schema";

export const printecConfig: Partial<PrintOMSClientConfig> = {
  id: "printec",
  name: "Printec",
  colors: {
    primary: "#13b5ea", // Cyan
    onPrimary: "#ffffff",
    primaryContainer: "#e0f6ff",
    onPrimaryContainer: "#005a80",
    secondary: "#e41c8a", // Magenta
    onSecondary: "#ffffff",
    secondaryContainer: "#fdecf5",
    onSecondaryContainer: "#80004a",
    background: "#f8fafc",
    surface: "#ffffff",
    sidebarBg: "#000000", // Full Black
    sidebarText: "#d1d5db",
    sidebarActiveBg: "#3a3637",
    sidebarActiveText: "#fcd900", // Yellow
    sidebarAccent: "#fcd900", // Yellow accent
  },
  logoUrl: "/clients/printec/logo.jpeg",
  faviconUrl: "/clients/printec/logo.jpeg",
  loadingText: "PRINTEC",
  features: {
    enableAdminAssignment: false,
  },
};
