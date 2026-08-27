import { PrintOMSClientConfig } from "./schema";
import { DEFAULT_BUSINESS_OPERATIONS } from "./schema/businessOperations";
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
    // Array replace (not deep merge) client fully owns its operations list.
    businessOperations:
      override.businessOperations ??
      defaultConfig.businessOperations ??
      DEFAULT_BUSINESS_OPERATIONS,
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
