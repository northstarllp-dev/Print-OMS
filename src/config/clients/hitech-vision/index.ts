import { PrintOMSClientConfig } from "../../schema";

export const hitechVisionConfig: Partial<PrintOMSClientConfig> = {
  id: "hitech-vision",
  name: "Hitech Vision",
  colors: {
    primary: "#0ea5e9", // Typical tech blue
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
  logoUrl: null, // Update to actual logo if available
  faviconUrl: null,
  loadingText: "HITECH VISION",
  features: {
    enableAdminAssignment: false,
  },
};
