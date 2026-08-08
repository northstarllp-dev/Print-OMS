export interface FeaturesConfig {
  enableAdminAssignment: boolean;
  /** Days without pipeline stage progress before Active → Needs Attention. */
  needsAttentionAfterDays: number;
  /** Days before an active enquiry becomes Needs Attention. */
  enquiryNeedsAttentionAfterDays?: number;
  /**
   * When set, this feature block only applies for the listed business operation ids.
   * Omit to apply for all operations.
   */
  businessOperations?: string[];
  /** Hides specific fields on the Site Visit form */
  siteVisit?: {
    hideDepth?: boolean;
    hideGroundClearance?: boolean;
    hideExtraWireRequired?: boolean;
    hideFabricationReq?: boolean;
    hideCivilWork?: boolean;
    hideElectricalAssessment?: boolean;
    defaultMeasurementUnit?: "ft" | "inch" | "m";
    /** When set, site-visit UI only applies for these business operation ids. */
    businessOperations?: string[];
  };
}
