import { PrintOMSClientConfig } from "../../schema";

export const defaultConfig: PrintOMSClientConfig = {
  id: "default",
  name: "Printoms",
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
  logoUrl: null,
  loadingText: "PRINTOMS",
  features: {
    enableAdminAssignment: false,
  },
};
