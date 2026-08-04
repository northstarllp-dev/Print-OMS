export interface FeaturesConfig {
  enableAdminAssignment: boolean;
  /** Days without pipeline stage progress before Active → Needs Attention. */
  needsAttentionAfterDays: number;
  /** Days before an active enquiry becomes Needs Attention. */
  enquiryNeedsAttentionAfterDays?: number;
  /** Hides specific fields on the Site Visit form */
  siteVisit?: {
    hideDepth?: boolean;
    hideGroundClearance?: boolean;
    hideExtraWireRequired?: boolean;
    hideFabricationReq?: boolean;
    hideCivilWork?: boolean;
    hideElectricalAssessment?: boolean;
    defaultMeasurementUnit?: "ft" | "inch" | "m";
  };
}
