export interface FeaturesConfig {
  enableAdminAssignment: boolean;
  /** Days without pipeline stage progress before Active → Needs Attention. */
  needsAttentionAfterDays: number;
}
