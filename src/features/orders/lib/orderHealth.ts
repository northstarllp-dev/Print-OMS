/** Canonical order health values (soft business flag, orthogonal to pipeline stage). */
export const ORDER_HEALTH_VALUES = [
  "Active",
  "Needs Attention",
  "On Hold",
  "Lost",
] as const;

export type OrderHealth = (typeof ORDER_HEALTH_VALUES)[number];

export function isOrderHealth(value: string): value is OrderHealth {
  return (ORDER_HEALTH_VALUES as readonly string[]).includes(value);
}

/**
 * Fields to merge into an orders UPDATE when pipeline `stage` actually changes.
 * Resets the stall clock and clears Needs Attention back to Active.
 */
export function stageProgressPatch(currentHealth?: string | null): {
  stage_changed_at: string;
  health?: "Active";
  lost_reason?: null;
} {
  const patch: {
    stage_changed_at: string;
    health?: "Active";
    lost_reason?: null;
  } = {
    stage_changed_at: new Date().toISOString(),
  };
  if (currentHealth === "Needs Attention") {
    patch.health = "Active";
    patch.lost_reason = null;
  }
  return patch;
}
