"use client";

import React, { useEffect } from "react";
import { getActiveClient } from "@/config/clientConfig";

export function ClientThemeProvider() {
  useEffect(() => {
    const config = getActiveClient();
    const root = document.documentElement;

    root.style.setProperty("--color-primary", config.colors.primary);
    root.style.setProperty("--color-on-primary", config.colors.onPrimary);
    root.style.setProperty("--color-primary-container", config.colors.primaryContainer);
    root.style.setProperty("--color-on-primary-container", config.colors.onPrimaryContainer);
    
    root.style.setProperty("--color-secondary", config.colors.secondary);
    root.style.setProperty("--color-on-secondary", config.colors.onSecondary);
    root.style.setProperty("--color-secondary-container", config.colors.secondaryContainer);
    root.style.setProperty("--color-on-secondary-container", config.colors.onSecondaryContainer);
    
    root.style.setProperty("--color-background", config.colors.background);
    root.style.setProperty("--color-surface", config.colors.surface);
    root.style.setProperty("--sidebar-bg", config.colors.sidebarBg);
    root.style.setProperty("--sidebar-text", config.colors.sidebarText);
    root.style.setProperty("--sidebar-active-bg", config.colors.sidebarActiveBg);
    root.style.setProperty("--sidebar-active-text", config.colors.sidebarActiveText);
    root.style.setProperty("--sidebar-accent", config.colors.sidebarAccent);

    // Also update legacy aliases that might be used
    root.style.setProperty("--primary-900", config.colors.primary);
    root.style.setProperty("--secondary-500", config.colors.secondary);
    root.style.setProperty("--secondary-fixed", config.colors.primaryContainer);
    root.style.setProperty("--background", config.colors.background);

  }, []);

  return null; // This component only manages side-effects (CSS variables)
}
