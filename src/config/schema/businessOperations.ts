import type { FeaturesConfig } from "./features";

/** Module keys that can appear in a business operation pipeline. */
export type BusinessStageKey =
  | "enquiry"
  | "site_visit"
  | "quotation"
  | "design"
  | "production"
  | "installation";

export interface BusinessOperation {
  id: string;
  label: string;
  /** Ordered stages stages not listed are skipped entirely. */
  stages: BusinessStageKey[];
  /** Optional feature overrides applied when this op is active. */
  features?: Partial<FeaturesConfig>;
}

/** Default signage op (matches current quote_first order). */
export const DEFAULT_BUSINESS_OPERATIONS: BusinessOperation[] = [
  {
    id: "signage",
    label: "Signage",
    stages: [
      "enquiry",
      "site_visit",
      "quotation",
      "design",
      "production",
      "installation",
    ],
  },
];

export const DEFAULT_BUSINESS_OPERATION_ID = "signage";
