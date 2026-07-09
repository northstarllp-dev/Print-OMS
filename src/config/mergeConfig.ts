import { PrintOMSClientConfig } from "./schema";
import { defaultConfig } from "./clients/_default";

export function mergeConfig(override: Partial<PrintOMSClientConfig>): PrintOMSClientConfig {
  return {
    ...defaultConfig,
    ...override,
    colors: {
      ...defaultConfig.colors,
      ...(override.colors || {}),
    },
    features: {
      ...defaultConfig.features,
      ...(override.features || {}),
    },
  };
}
