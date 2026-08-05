/** Pure customer CRM helpers (unit-tested). */

export const CUSTOMER_STATUSES = [
  "Active",
  "Inactive",
  "Pending",
  "Blocked",
  "Archived",
] as const;

export type CustomerStatus = (typeof CUSTOMER_STATUSES)[number];

export const CUSTOMER_TYPES = ["Retail", "Corporate", "Dealer"] as const;
export type CustomerType = (typeof CUSTOMER_TYPES)[number];

export type CustomerListRow = {
  id: string;
  name: string;
  phone: string;
  email: string;
  whatsapp?: string | null;
  city?: string | null;
  billingAddress?: string | null;
  shippingAddress?: string | null;
  status?: string | null;
  customerCode: string;
  customerId?: string;
  contactPerson?: string | null;
  gstNumber?: string | null;
  customerType?: string | null;
};

export type CustomerOrderRow = {
  id: string;
  customerId?: string | null;
  stage?: string | null;
  budget?: number | null;
  orderCode?: string | null;
  orderId?: string | null;
  health?: string | null;
  businessName?: string | null;
  clientName?: string | null;
};

export type CustomerCatalogFilters = {
  search?: string;
  statusFilter?: string;
  customerTypeFilter?: string;
  orderCountFilter?: "ALL" | "0" | "1" | "multiple";
};

export type CustomerFormErrors = Partial<
  Record<"name" | "phone" | "email" | "gstNumber" | "status", string>
>;

const CLOSED_STAGES = new Set(["Completed", "Closed"]);

export function isClosedOrderStage(stage?: string | null): boolean {
  return CLOSED_STAGES.has(stage || "");
}

/** Portal access ends once every linked order is completed/closed. */
export function isCustomerPortalExpired(
  customerId: string,
  orders: Array<{ customerId?: string | null; stage?: string | null }>
): boolean {
  const linked = orders.filter((o) => o.customerId === customerId);
  return linked.length > 0 && linked.every((o) => isClosedOrderStage(o.stage));
}

export function getCustomerStatusColor(status: string | null | undefined): {
  bg: string;
  text: string;
  label: string;
} {
  const colors: Record<string, { bg: string; text: string; label: string }> = {
    Active: { bg: "#dcfce7", text: "#16a34a", label: "ACTIVE" },
    Inactive: { bg: "#fee2e2", text: "#dc2626", label: "INACTIVE" },
    Pending: { bg: "#fef3c7", text: "#ea580c", label: "PENDING" },
    Blocked: { bg: "#fce7f3", text: "#be185d", label: "BLOCKED" },
    Archived: { bg: "#f1f5f9", text: "#64748b", label: "ARCHIVED" },
  };
  return colors[status || "Active"] || colors.Active;
}

export function getOrderHealthBadgeClass(health: string | null | undefined): string {
  const colors: Record<string, string> = {
    Active: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
    "Needs Attention": "bg-amber-500/10 text-amber-700 border-amber-500/20",
    "On Hold": "bg-slate-500/10 text-slate-600 border-slate-200",
    Lost: "bg-rose-500/10 text-rose-600 border-rose-500/20",
  };
  return colors[health || ""] || "bg-slate-100 text-slate-600 border-slate-200";
}

export function mapDbCustomerToListRow(c: {
  id: string;
  name?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  city?: string | null;
  billing_address?: string | null;
  shipping_address?: string | null;
  status?: string | null;
  customer_id?: string | null;
  contact_person?: string | null;
  gst_number?: string | null;
  customer_type?: string | null;
}): CustomerListRow {
  return {
    id: c.id,
    name: c.name || "",
    phone: c.phone || "",
    whatsapp: c.whatsapp,
    email: c.email || "",
    city: c.city || "",
    billingAddress: c.billing_address || "",
    shippingAddress: c.shipping_address || "",
    status: c.status || "Active",
    customerCode: c.customer_id || c.id,
    customerId: c.customer_id || c.id,
    contactPerson: c.contact_person ?? null,
    gstNumber: c.gst_number ?? null,
    customerType: c.customer_type ?? null,
  };
}

export function mapDbOrderToCustomerOrder(o: {
  id: string;
  client_name?: string | null;
  business_name?: string | null;
  customer_id?: string | null;
  stage?: string | null;
  health?: string | null;
  budget?: number | null;
  date_created?: string | null;
  order_id?: string | null;
}): CustomerOrderRow & { dateCreated?: string | null; orderId?: string } {
  return {
    id: o.id,
    clientName: o.client_name,
    businessName: o.business_name || "",
    customerId: o.customer_id,
    stage: o.stage,
    health: o.health || "Active",
    budget: o.budget || 0,
    dateCreated: o.date_created,
    orderCode: o.order_id || o.id,
    orderId: o.order_id || o.id,
  };
}

export function normalizeCustomerSearch(term?: string | null): string {
  return (term || "").trim().toLowerCase();
}

/** Strip characters that commonly appear in injection probes for client-side search. */
export function sanitizeCustomerSearchInput(term: string): string {
  return term.replace(/[;'"\\]|--|\/\*|\*\//g, "").slice(0, 200);
}

export function customerMatchesSearch(
  c: CustomerListRow,
  rawSearch: string
): boolean {
  const search = normalizeCustomerSearch(sanitizeCustomerSearchInput(rawSearch));
  if (!search) return true;
  return (
    (c.name || "").toLowerCase().includes(search) ||
    (c.phone || "").toLowerCase().includes(search) ||
    (c.email || "").toLowerCase().includes(search) ||
    (c.customerCode || "").toLowerCase().includes(search) ||
    (c.contactPerson || "").toLowerCase().includes(search) ||
    (c.gstNumber || "").toLowerCase().includes(search)
  );
}

export function countOrdersForCustomer(
  customerId: string,
  orders: Array<{ customerId?: string | null }>
): number {
  return orders.filter((o) => o.customerId === customerId).length;
}

export function matchesOrderCountFilter(
  orderCount: number,
  filter: CustomerCatalogFilters["orderCountFilter"] = "ALL"
): boolean {
  if (!filter || filter === "ALL") return true;
  if (filter === "0") return orderCount === 0;
  if (filter === "1") return orderCount === 1;
  return orderCount > 1;
}

export function filterCustomersCatalog(
  customers: CustomerListRow[],
  orders: Array<{ customerId?: string | null }> = [],
  opts: CustomerCatalogFilters = {}
): CustomerListRow[] {
  const statusFilter = opts.statusFilter ?? "ALL";
  const typeFilter = opts.customerTypeFilter ?? "ALL";

  return customers.filter((c) => {
    const matchesSearch = customerMatchesSearch(c, opts.search || "");
    const matchesStatus =
      statusFilter === "ALL" || (c.status || "Active") === statusFilter;
    const matchesType =
      typeFilter === "ALL" || (c.customerType || "") === typeFilter;
    const orderCount = countOrdersForCustomer(c.id, orders);
    const matchesOrders = matchesOrderCountFilter(
      orderCount,
      opts.orderCountFilter
    );
    return matchesSearch && matchesStatus && matchesType && matchesOrders;
  });
}

export function resetCustomerFilters(): Required<
  Pick<
    CustomerCatalogFilters,
    "search" | "statusFilter" | "customerTypeFilter" | "orderCountFilter"
  >
> {
  return {
    search: "",
    statusFilter: "ALL",
    customerTypeFilter: "ALL",
    orderCountFilter: "ALL",
  };
}

export function computeCustomerKpis(
  customers: Array<{ status?: string | null }>
) {
  const total = customers.length;
  const active = customers.filter((c) => (c.status || "Active") === "Active").length;
  const pending = customers.filter((c) => c.status === "Pending").length;
  const inactive = customers.filter((c) => c.status === "Inactive").length;
  const blocked = customers.filter((c) => c.status === "Blocked").length;
  const archived = customers.filter((c) => c.status === "Archived").length;
  return {
    total,
    active,
    pending,
    inactive,
    blocked,
    archived,
    activePercentage: total > 0 ? Math.round((active / total) * 100) : 0,
  };
}

export function linkedOrdersForCustomer(
  customerId: string,
  orders: CustomerOrderRow[]
): CustomerOrderRow[] {
  return orders.filter((o) => o.customerId === customerId);
}

/** Sum of order budgets for a customer (spend proxy until invoice totals exist). */
export function computeCustomerTotalSpend(
  customerId: string,
  orders: Array<{ customerId?: string | null; budget?: number | null }>
): number {
  return orders
    .filter((o) => o.customerId === customerId)
    .reduce((sum, o) => sum + (Number(o.budget) || 0), 0);
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

/** Indian GSTIN format when provided. */
export function validateGstNumber(gst?: string | null): string | null {
  if (gst == null || !String(gst).trim()) return null;
  const v = String(gst).trim().toUpperCase();
  if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(v)) {
    return "Invalid GST number";
  }
  return null;
}

export function validateCustomerEditForm(form: {
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  gstNumber?: string | null;
  status?: string | null;
}): CustomerFormErrors {
  const errors: CustomerFormErrors = {};
  if (!form.name?.trim()) errors.name = "Company name is required";
  const phoneErr = validatePhone(form.phone);
  if (phoneErr) errors.phone = phoneErr;
  const emailErr = validateEmail(form.email);
  if (emailErr) errors.email = emailErr;
  const gstErr = validateGstNumber(form.gstNumber);
  if (gstErr) errors.gstNumber = gstErr;
  if (
    form.status &&
    !(CUSTOMER_STATUSES as readonly string[]).includes(form.status)
  ) {
    errors.status = "Invalid status";
  }
  return errors;
}

export function isDuplicateCustomerPhone(
  phone: string,
  existing: Array<{ id?: string; phone?: string | null }>,
  excludeId?: string
): boolean {
  const normalize = (p: string) => {
    const digits = p.replace(/\D/g, "");
    return digits.length > 10 ? digits.slice(-10) : digits;
  };
  const target = normalize(phone);
  if (!target) return false;
  return existing.some(
    (c) => c.id !== excludeId && normalize(c.phone || "") === target
  );
}

export function isDuplicateCustomerEmail(
  email: string,
  existing: Array<{ id?: string; email?: string | null }>,
  excludeId?: string
): boolean {
  const e = email.trim().toLowerCase();
  return existing.some(
    (c) => c.id !== excludeId && (c.email || "").trim().toLowerCase() === e
  );
}

export function canArchiveCustomer(
  customerId: string,
  orders: Array<{ customerId?: string | null; stage?: string | null }>
): { ok: boolean; reason?: string } {
  const active = orders.filter(
    (o) => o.customerId === customerId && !isClosedOrderStage(o.stage)
  );
  if (active.length > 0) {
    return {
      ok: false,
      reason: `Cannot archive: ${active.length} active order(s)`,
    };
  }
  return { ok: true };
}

export function shouldHardDeleteCustomer(): boolean {
  return false;
}

export function isCustomerSubmitLocked(isSubmitting: boolean): boolean {
  return isSubmitting;
}

export function canAccessCustomerCrm(role?: string | null): boolean {
  return role === "admin" || role === "sales";
}

export function canEditCustomer(role?: string | null): boolean {
  return role === "admin" || role === "sales";
}

export function canArchiveCustomers(role?: string | null): boolean {
  return role === "admin";
}

export function canGeneratePortalLink(role?: string | null): boolean {
  return role === "admin" || role === "sales";
}

export function designerSeesFullCustomerCrm(): boolean {
  return false;
}

export function customerRoleCanAccessCrm(): boolean {
  return false;
}

export function isPortalTokenExpired(expiresAt: Date | string, now = Date.now()): boolean {
  const t = typeof expiresAt === "string" ? new Date(expiresAt).getTime() : expiresAt.getTime();
  return Number.isNaN(t) || t < now;
}

export function isPortalTokenRevoked(revokedAt?: string | Date | null): boolean {
  return revokedAt != null && String(revokedAt).length > 0;
}

/** Portal token must bind to one customer — no cross-customer access. */
export function portalTokenMatchesCustomer(
  tokenCustomerId: string,
  requestedCustomerId: string
): boolean {
  return tokenCustomerId === requestedCustomerId;
}

export function portalTokenMatchesOrder(
  tokenOrderId: string | undefined,
  orderCustomerId: string | null | undefined,
  tokenCustomerId: string
): boolean {
  if (!tokenOrderId) return true;
  return orderCustomerId === tokenCustomerId;
}

export function defaultPortalExpiryDays(): number {
  return 30;
}

export function isOpaquePortalTokenShape(token: string): boolean {
  return /^[A-Za-z0-9_-]{8,32}$/.test(token) && !token.includes(".");
}

export function paginateCustomers<T>(
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
