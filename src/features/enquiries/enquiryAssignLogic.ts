/** Pure helpers for post-convert Assign Employees flow (unit-tested). */

export type EmployeeStatInput = {
  id: string;
  name: string;
  email?: string | null;
  staff_role?: string | null;
};

export type AssignmentRowInput = {
  employee_id: string;
  orders?: {
    id?: string;
    client_name?: string | null;
    business_name?: string | null;
    stage?: string | null;
  } | null;
};

export type EmployeeStat = {
  id: string;
  name: string;
  staff_role?: string | null;
  activeJobs: number;
  jobTitles: string[];
};

/** After convert, CustomerMessageModal close with this flag opens AssignTeamModal. */
export function shouldOpenAssignTeamAfterConvert(afterClose?: string | null): boolean {
  return afterClose === "assignTeam";
}

/** Stages that still count toward an employee's active job load. */
export function isActiveAssignmentOrderStage(stage?: string | null): boolean {
  return stage !== "Completed" && stage !== "Closed";
}

export function formatEmployeeJobTitle(order?: {
  business_name?: string | null;
  client_name?: string | null;
} | null): string {
  if (!order) return "";
  return `${order.business_name || ""} - ${order.client_name || ""}`.trim();
}

/** Mirrors fetchEmployeeStats aggregation (staff list + active assignments). */
export function buildEmployeeStats(
  staff: EmployeeStatInput[],
  assignments: AssignmentRowInput[]
): EmployeeStat[] {
  return staff.map((emp) => {
    const mine = assignments.filter(
      (a) =>
        a.employee_id === emp.id &&
        isActiveAssignmentOrderStage(a.orders?.stage)
    );
    return {
      id: emp.id,
      name: emp.name,
      staff_role: emp.staff_role,
      activeJobs: mine.length,
      jobTitles: mine
        .map((a) => formatEmployeeJobTitle(a.orders))
        .filter(Boolean),
    };
  });
}

/** Toggle multi-select in AssignTeamModal. */
export function toggleEmployeeSelection(
  selectedIds: readonly string[],
  employeeId: string
): string[] {
  const set = new Set(selectedIds);
  if (set.has(employeeId)) set.delete(employeeId);
  else set.add(employeeId);
  return Array.from(set);
}

export function dedupeEmployeeIds(employeeIds: readonly string[]): string[] {
  return Array.from(new Set(employeeIds.filter(Boolean)));
}

export function canSaveAssignments(
  selectedCount: number,
  saving: boolean
): boolean {
  return selectedCount > 0 && !saving;
}

export function isAssignSubmitDisabled(
  selectedCount: number,
  saving: boolean
): boolean {
  return !canSaveAssignments(selectedCount, saving);
}

export function canStartAssignSubmit(saving: boolean): boolean {
  return !saving;
}

/** Rows written to order_assignments (replace-all strategy). */
export function buildOrderAssignmentRows(
  orderUuid: string,
  employeeIds: readonly string[]
): Array<{ order_id: string; employee_id: string }> {
  return dedupeEmployeeIds(employeeIds).map((employee_id) => ({
    order_id: orderUuid,
    employee_id,
  }));
}

export function requiresCompanyIdForAssignment(
  companyId?: string | null
): boolean {
  return !companyId;
}

export function buildTeamAssignedActivity(input: {
  orderFriendlyId: string;
  companyId: string;
  employeeCount: number;
}) {
  return {
    order_id: input.orderFriendlyId,
    company_id: input.companyId,
    actor_name: "System",
    actor_role: "System",
    content: `Team assigned: ${input.employeeCount} employee(s) allocated to this order.`,
    metadata: { action: "team_assigned", count: input.employeeCount },
  };
}

export function buildEmployeeAssignNotification(input: {
  orderFriendlyId: string;
  orderUuid: string;
  companyId: string;
}) {
  const orderRef = input.orderFriendlyId || input.orderUuid;
  return {
    title: `You've been assigned to Order ${orderRef}`,
    message: `You have been added to the team for this order.`,
    type: "info" as const,
    link: `/staff/orders/${input.orderFriendlyId || input.orderUuid}`,
  };
}

export function selectionSummaryLabel(count: number): string {
  if (count <= 0) return "Select employees above";
  return `${count} employee${count > 1 ? "s" : ""} selected`;
}

/**
 * Post-convert flow: convert success → message modal → assign team.
 * Empty selection is allowed to skip only via Close, not Save.
 */
export function canSkipAssignViaClose(): boolean {
  return true;
}

/* ── After Save Assignments: permissions / notify / staff portal ───────── */

/** Staff /enquiries page: need enquiry view or edit (redirect otherwise). */
export function canAccessStaffEnquiriesPage(perm: {
  canView: boolean;
  canEdit: boolean;
}): boolean {
  return perm.canView || perm.canEdit;
}

/** Sidebar Enquiries tab — same rule as getNavItemsForActor for enquiry. */
export function shouldShowEnquiriesNavItem(perm: {
  canView: boolean;
  canEdit: boolean;
}): boolean {
  return canAccessStaffEnquiriesPage(perm);
}

/** “View order” links on converted rows when staff has any other stage access. */
export function resolveCanViewOrderLink(
  otherStagePerms: Array<{ canView: boolean; canEdit: boolean }>
): boolean {
  return otherStagePerms.some((p) => p.canView || p.canEdit);
}

/**
 * Business rule: being on order_assignments does NOT grant stage edit.
 * Stage edit comes only from resolveStagePermission / role grants.
 */
export function doesAssignmentGrantStageEdit(): boolean {
  return false;
}

/** Enquiries list is company-wide for permitted staff — not filtered by assignment. */
export function isEnquiryListFilteredByAssignment(): boolean {
  return false;
}

export function isOrderAssignedToEmployee(
  assignedEmployees: string[] | null | undefined,
  employeeId: string
): boolean {
  return Boolean(assignedEmployees?.includes(employeeId));
}

/** DB row shape inserted by createNotification after assign. */
export function buildAssignmentNotificationDbRow(input: {
  userId: string;
  companyId: string | null;
  title: string;
  message: string;
  type: "info" | "success" | "warning" | "error";
  link?: string;
}) {
  return {
    company_id: input.companyId,
    user_id: input.userId,
    title: input.title,
    message: input.message,
    type: input.type,
    link: input.link,
    read: false,
  };
}

/**
 * StaffLayoutClient realtime filter: only surface INSERT events for this user.
 * Channel listens to notifications table; client filters by user_id.
 */
export function realtimeNotificationMatchesUser(
  notificationUserId: string | null | undefined,
  profileId: string | null | undefined
): boolean {
  if (!notificationUserId || !profileId) return false;
  return notificationUserId === profileId;
}

/** One direct notification per assigned employee (deduped). */
export function recipientIdsForAssignNotifications(
  employeeIds: readonly string[]
): string[] {
  return dedupeEmployeeIds(employeeIds);
}

/**
 * After assign, staff queue visibility needs BOTH assignment AND stage relevance.
 * (filterStaffQueueOrders with requireAssignment=true)
 */
export function canSeeAssignedOrderInStaffQueue(input: {
  assignedEmployees?: string[] | null;
  employeeId: string;
  stageRelevant: boolean;
  requireAssignment?: boolean;
}): boolean {
  const requireAssignment = input.requireAssignment !== false;
  if (requireAssignment && !isOrderAssignedToEmployee(input.assignedEmployees, input.employeeId)) {
    return false;
  }
  return input.stageRelevant;
}
