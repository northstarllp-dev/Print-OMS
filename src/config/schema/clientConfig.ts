import { ThemeColors } from "./theme";
import { FeaturesConfig } from "./features";

export interface PrintOMSClientConfig {
  id: string;
  name: string;
  colors: ThemeColors;
  logoUrl: string | null;
  logoScale?: number;
  faviconUrl?: string | null;
  loadingText?: string;
  features: FeaturesConfig;
}
