import { PrintOMSClientConfig } from "./schema";
import { defaultConfig } from "./clients/printoms";

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
    stageGrantsByRole: {
      ...(defaultConfig.stageGrantsByRole || {}),
      ...(override.stageGrantsByRole || {}),
    },
    whatsappTemplateOverrides: {
      ...(defaultConfig.whatsappTemplateOverrides || {}),
      ...(override.whatsappTemplateOverrides || {}),
    },
  };
}
