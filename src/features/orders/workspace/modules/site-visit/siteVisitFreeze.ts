/** Whether the site visit audit module should be read-only (before admin God Mode unlock). */
export function isSiteVisitAuditFrozen(
  stage: string,
  stageStatus: string | undefined,
  completed: boolean
): boolean {
  const pendingAdminApproval =
    stageStatus === "Pending Admin Approval: Site Visit Completed";

  return (
    !stage.startsWith("Site Visit") ||
    pendingAdminApproval ||
    (completed && stageStatus !== "Normal")
  );
}
