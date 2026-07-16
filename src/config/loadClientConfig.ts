import { PrintOMSClientConfig } from "./schema";
import { clientRegistry } from "./registry";
import { mergeConfig } from "./mergeConfig";
import { defaultConfig } from "./clients/printoms";

export function loadClientConfig(): PrintOMSClientConfig {
  const slug = process.env.NEXT_PUBLIC_CLIENT_SLUG || "the-board-company";
  const override = clientRegistry[slug];
  
  if (!override) {
    console.warn(`No client config found for slug: ${slug}. Falling back to default.`);
    return defaultConfig;
  }
  
  return mergeConfig(override);
}

// Re-export type for convenience
export type { PrintOMSClientConfig as ClientConfig } from "./schema";
