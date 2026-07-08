export interface ClientConfig {
  id: string;
  name: string;
  colors: {
    primary: string;
    onPrimary: string;
    primaryContainer: string;
    onPrimaryContainer: string;
    secondary: string;
    onSecondary: string;
    secondaryContainer: string;
    onSecondaryContainer: string;
    background: string;
    surface: string;
    sidebarBg: string;
    sidebarText: string;
    sidebarActiveBg: string;
    sidebarActiveText: string;
    sidebarAccent: string;
  };
  logoUrl: string | null;
}

const defaultConfig: ClientConfig = {
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
  logoUrl: null, // Use default text logo
};

const theboardcompanyConfig: ClientConfig = {
  id: "theboardcompany",
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
};

const clients: Record<string, ClientConfig> = {
  default: defaultConfig,
  theboardcompany: theboardcompanyConfig,
};

export function getActiveClient(): ClientConfig {
  const clientId = process.env.NEXT_PUBLIC_CLIENT_ID || "theboardcompany";
  return clients[clientId] || clients.default;
}
