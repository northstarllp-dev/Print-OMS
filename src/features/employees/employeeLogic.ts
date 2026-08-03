/** Pure employee directory helpers (unit-tested). */

export const EMPLOYEE_STATUSES = ["Active", "Inactive", "Archived"] as const;
export type EmployeeStatus = (typeof EMPLOYEE_STATUSES)[number];

/** UI label: DB Inactive → "Frozen". */
export function employeeStatusLabel(status?: string | null): string {
  if (status === "Inactive") return "Frozen";
  if (status === "Archived") return "Archived";
  return "Active";
}

/** UI “Frozen” maps to DB status Inactive. */
export function normalizeEmployeeStatus(
  status?: string | null
): "Active" | "Inactive" | "Archived" {
  if (status === "Archived") return "Archived";
  if (status === "Inactive" || status === "Frozen") return "Inactive";
  return "Active";
}

export function isEmployeeFrozen(status?: string | null): boolean {
  return normalizeEmployeeStatus(status) === "Inactive";
}

export function isEmployeeArchived(status?: string | null): boolean {
  return normalizeEmployeeStatus(status) === "Archived";
}

export function canEmployeeLogin(status?: string | null): boolean {
  const s = normalizeEmployeeStatus(status);
  return s === "Active";
}

export type EmployeeListRow = {
  id: string;
  employeeId?: string | null;
  name: string;
  role: string;
  phone: string;
  email: string;
  status?: string | null;
  rating?: number;
  workload?: number;
  jobsAssigned?: number;
  department?: string | null;
  online?: boolean | null;
};

export type EmployeeCatalogFilters = {
  search?: string;
  statusFilter?: "ALL" | "Active" | "Inactive" | "Frozen" | "Archived" | "Online" | "Offline";
  roleFilter?: string;
  departmentFilter?: string;
};

export type EmployeeFormErrors = Partial<
  Record<"name" | "email" | "phone" | "role" | "password", string>
>;

export function mapDbUserToEmployee(user: {
  id: string;
  employee_id?: string | null;
  name?: string | null;
  staff_role?: string | null;
  phone?: string | null;
  email?: string | null;
  status?: string | null;
  rating?: number | null;
  workload?: number | null;
  order_assignments?: Array<{ id?: string }> | null;
  department?: string | null;
}): EmployeeListRow {
  return {
    id: user.id,
    employeeId: user.employee_id,
    name: user.name || "",
    role: user.staff_role || "",
    phone: user.phone || "",
    email: user.email || "",
    status: user.status || "Active",
    rating: Number(user.rating) || 5.0,
    workload: Number(user.workload) || 0,
    jobsAssigned: user.order_assignments ? user.order_assignments.length : 0,
    department: user.department ?? null,
  };
}

export function sanitizeEmployeeSearchInput(term: string): string {
  return term.replace(/[;'"\\]|--|\/\*|\*\//g, "").slice(0, 200);
}

export function normalizeEmployeeSearch(term?: string | null): string {
  return sanitizeEmployeeSearchInput(term || "").trim().toLowerCase();
}

export function employeeMatchesSearch(emp: EmployeeListRow, rawSearch: string): boolean {
  const q = normalizeEmployeeSearch(rawSearch);
  if (!q) return true;
  return (
    (emp.name || "").toLowerCase().includes(q) ||
    (emp.role || "").toLowerCase().includes(q) ||
    (emp.id || "").toLowerCase().includes(q) ||
    (!!emp.employeeId && emp.employeeId.toLowerCase().includes(q)) ||
    (emp.email || "").toLowerCase().includes(q) ||
    (emp.phone || "").toLowerCase().includes(q) ||
    (emp.department || "").toLowerCase().includes(q)
  );
}

export function filterEmployeesCatalog<T extends EmployeeListRow>(
  employees: T[],
  opts: EmployeeCatalogFilters = {}
): T[] {
  const statusFilter = opts.statusFilter ?? "ALL";
  const roleFilter = opts.roleFilter ?? "ALL";
  const departmentFilter = opts.departmentFilter ?? "ALL";

  return employees.filter((emp) => {
    if (!employeeMatchesSearch(emp, opts.search || "")) return false;

    const status = normalizeEmployeeStatus(emp.status);
    // Default directory hides archived employees
    if (statusFilter === "ALL" && status === "Archived") return false;
    if (statusFilter === "Active" && status !== "Active") return false;
    if (
      (statusFilter === "Inactive" || statusFilter === "Frozen") &&
      status !== "Inactive"
    ) {
      return false;
    }
    if (statusFilter === "Archived" && status !== "Archived") return false;
    if (statusFilter === "Online" && emp.online !== true) return false;
    if (statusFilter === "Offline" && emp.online === true) return false;

    if (roleFilter !== "ALL" && (emp.role || "") !== roleFilter) return false;
    if (departmentFilter !== "ALL" && (emp.department || "") !== departmentFilter) {
      return false;
    }
    return true;
  });
}

export function resetEmployeeFilters(): Required<EmployeeCatalogFilters> {
  return {
    search: "",
    statusFilter: "ALL",
    roleFilter: "ALL",
    departmentFilter: "ALL",
  };
}

export function computeEmployeeKpis(employees: EmployeeListRow[]) {
  const total = employees.length;
  const active = employees.filter(
    (e) => normalizeEmployeeStatus(e.status) === "Active"
  ).length;
  const frozen = employees.filter((e) => isEmployeeFrozen(e.status)).length;
  const archived = employees.filter((e) => isEmployeeArchived(e.status)).length;
  const totalJobsAssigned = employees.reduce(
    (sum, emp) => sum + (emp.jobsAssigned || 0),
    0
  );
  const avgJobsPerEmployee =
    total > 0 ? Number((totalJobsAssigned / total).toFixed(1)) : 0;
  const overloaded = employees.filter((e) => (e.jobsAssigned || 0) >= 5).length;
  const idle = employees.filter(
    (e) =>
      normalizeEmployeeStatus(e.status) === "Active" && (e.jobsAssigned || 0) === 0
  ).length;

  return {
    total,
    active,
    frozen,
    archived,
    activePercentage: total > 0 ? Math.round((active / total) * 100) : 0,
    totalJobsAssigned,
    avgJobsPerEmployee,
    overloaded,
    idle,
  };
}

export function validatePhone(phone?: string | null): string | null {
  if (!phone?.trim()) return "Phone is required";
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 10) return "Invalid phone";
  return null;
}

export function validateEmail(email?: string | null): string | null {
  if (!email?.trim()) return "Email is required";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return "Invalid email";
  return null;
}

export function validateEmployeeForm(form: {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  role?: string | null;
}): EmployeeFormErrors {
  const errors: EmployeeFormErrors = {};
  if (!form.name?.trim()) errors.name = "Name is required";
  const emailErr = validateEmail(form.email);
  if (emailErr) errors.email = emailErr;
  const phoneErr = validatePhone(form.phone);
  if (phoneErr) errors.phone = phoneErr;
  if (!form.role?.trim()) errors.role = "Role is required";
  return errors;
}

function normalizePhoneDigits(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.length > 10 ? digits.slice(-10) : digits;
}

export function isDuplicateEmployeeEmail(
  email: string,
  existing: Array<{ id?: string; email?: string | null }>,
  excludeId?: string
): boolean {
  const e = email.trim().toLowerCase();
  return existing.some(
    (row) => row.id !== excludeId && (row.email || "").trim().toLowerCase() === e
  );
}

export function isDuplicateEmployeePhone(
  phone: string,
  existing: Array<{ id?: string; phone?: string | null }>,
  excludeId?: string
): boolean {
  const target = normalizePhoneDigits(phone);
  if (!target) return false;
  return existing.some(
    (row) => row.id !== excludeId && normalizePhoneDigits(row.phone || "") === target
  );
}

/** Min length policy used by admin reset UI today. */
export function validatePasswordPolicy(password: string, minLength = 6): string | null {
  if (!password || password.length < minLength) {
    return `Password must be at least ${minLength} characters`;
  }
  return null;
}

export function passwordsMatch(password: string, confirm: string): boolean {
  return password === confirm;
}

export function canAdminResetPassword(actorRole?: string | null): boolean {
  return actorRole === "admin";
}

export function canResetOwnPasswordAsAdminWithoutPolicy(): boolean {
  return false;
}

export function canResetFrozenEmployeePassword(status?: string | null): boolean {
  // Allowed: admin may still set a password while frozen; login remains blocked by status.
  return true;
}

export function canResetDeletedEmployeePassword(exists: boolean): boolean {
  return exists;
}

export function shouldHardDeleteEmployee(): boolean {
  return false;
}

export function canArchiveEmployeeWithJobs(jobsAssigned: number): {
  ok: boolean;
  reason?: string;
} {
  if (jobsAssigned > 0) {
    return {
      ok: false,
      reason: `Cannot archive: ${jobsAssigned} job(s) still assigned. Reassign first.`,
    };
  }
  return { ok: true };
}

/** @deprecated Use canArchiveEmployeeWithJobs */
export function canDeleteEmployeeWithJobs(jobsAssigned: number) {
  return canArchiveEmployeeWithJobs(jobsAssigned);
}

export function recommendArchiveInsteadOfDelete(): boolean {
  return true;
}

export function isEmployeeSubmitLocked(isPending: boolean): boolean {
  return isPending;
}

export function canManageEmployees(role?: string | null): boolean {
  return role === "admin";
}

export function canFreezeEmployee(role?: string | null): boolean {
  return role === "admin";
}

export function staffCanAccessEmployeeCrm(): boolean {
  return false;
}

export function nextEmployeeIdFromExisting(existingIds: string[]): string {
  const maxNum = existingIds.reduce((max, id) => {
    const match = id?.match(/^E(\d+)$/i);
    if (match) return Math.max(max, parseInt(match[1], 10));
    return max;
  }, 0);
  return `E${String(maxNum + 1).padStart(3, "0")}`;
}

export function paginateEmployees<T>(
  rows: T[],
  page: number,
  pageSize: number
): { items: T[]; total: number; page: number; pageSize: number; totalPages: number } {
  const safePage = Math.max(1, page);
  const safeSize = Math.max(1, pageSize);
  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / safeSize));
  const start = (safePage - 1) * safeSize;
  return {
    items: rows.slice(start, start + safeSize),
    total,
    page: safePage,
    pageSize: safeSize,
    totalPages,
  };
}

export function sortEmployeesByName(
  employees: EmployeeListRow[],
  direction: "asc" | "desc" = "asc"
): EmployeeListRow[] {
  return [...employees].sort((a, b) => {
    const cmp = (a.name || "").localeCompare(b.name || "");
    return direction === "asc" ? cmp : -cmp;
  });
}

export function workloadBucket(jobsAssigned: number): "idle" | "normal" | "overloaded" {
  if (jobsAssigned <= 0) return "idle";
  if (jobsAssigned >= 5) return "overloaded";
  return "normal";
}

/** Config-driven stage roles — Roles UI “coming soon”; grants already live in stageGrants. */
export function rolesUiIsImplemented(): boolean {
  return false;
}

export function permissionMatrixRoles(): string[] {
  return ["Production", "Installation", "Designer", "Marketer"];
}
