import { PrintOMSClientConfig } from "./schema";
import { clientRegistry } from "./registry";
import { mergeConfig } from "./mergeConfig";
import { defaultConfig } from "./clients/printoms";

function resolveSlug(): string {
  return (
    process.env.CLIENT_SLUG?.trim() ||
    process.env.NEXT_PUBLIC_CLIENT_SLUG?.trim() ||
    ""
  );
}

export function loadClientConfig(): PrintOMSClientConfig {
  const slug = resolveSlug();
  const isProd = process.env.NODE_ENV === "production";

  if (!slug) {
    if (isProd) {
      throw new Error("CLIENT_SLUG or NEXT_PUBLIC_CLIENT_SLUG is required");
    }
    console.warn(
      "[loadClientConfig] No CLIENT_SLUG set; falling back to printoms for local dev."
    );
    return defaultConfig;
  }

  const override = clientRegistry[slug];
  if (!override) {
    if (isProd) {
      throw new Error(`Unknown CLIENT_SLUG: ${slug}`);
    }
    console.warn(
      `[loadClientConfig] No client config for slug "${slug}". Falling back to printoms.`
    );
    return defaultConfig;
  }

  return mergeConfig(override);
}

/** Deploy tenant UUID for the active CLIENT_SLUG. */
export function getDeployCompanyId(): string {
  const id = loadClientConfig().companyId;
  if (!id) {
    throw new Error("Client config is missing companyId");
  }
  return id;
}

/** All company UUIDs allowed for this deploy. */
export function getDeployCompanyIds(): string[] {
  const config = loadClientConfig();
  if (config.companyIds?.length) return config.companyIds;
  return [config.companyId];
}

// Re-export type for convenience
export type { PrintOMSClientConfig as ClientConfig } from "./schema";
