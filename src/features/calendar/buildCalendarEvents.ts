import type {
  CalendarCustomerInput,
  CalendarEvent,
  CalendarOrderInput,
} from "./types";

/** Parse a date string into a local YYYY-MM-DD key. */
export function toDateKey(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;

  const y = parsed.getFullYear();
  const m = String(parsed.getMonth() + 1).padStart(2, "0");
  const d = String(parsed.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function todayDateKey(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function buildCalendarEvents(
  orders: CalendarOrderInput[],
  customers: CalendarCustomerInput[] = []
): CalendarEvent[] {
  const customerById = new Map(customers.map((c) => [c.id, c]));
  const events: CalendarEvent[] = [];

  for (const order of orders) {
    if (order.stage === "Closed") continue;

    const orderCode = order.orderCode || order.orderId || order.id;
    const projectName = order.businessName || order.clientName || "Order";
    const clientName = order.clientName || "Unknown client";
    const customer = order.customerId ? customerById.get(order.customerId) : undefined;
    const clientPhone = customer?.phone || "";
    const fallbackAddress = customer?.shippingAddress || "";
    const assignees = order.assignedEmployees || [];

    const sv = order.siteVisitDetails;
    if (sv) {
      const visitDate = toDateKey(sv.auditDate || sv.preferredDate || null);
      if (visitDate) {
        events.push({
          id: `${order.id}-site_visit`,
          orderId: order.id,
          orderCode,
          type: "site_visit",
          dateKey: visitDate,
          time: sv.auditTime || sv.preferredTime || null,
          projectName,
          clientName,
          clientPhone,
          address: sv.customerAddress || fallbackAddress || undefined,
          assigneeIds: assignees,
          stage: order.stage,
        });
      }
    }

    const inst = order.installationDetails;
    if (inst) {
      const installDate = toDateKey(inst.scheduledDate || inst.scheduled_date || null);
      if (installDate) {
        events.push({
          id: `${order.id}-installation`,
          orderId: order.id,
          orderCode,
          type: "installation",
          dateKey: installDate,
          time: inst.scheduledTime || inst.scheduled_time || null,
          projectName,
          clientName,
          clientPhone,
          address: fallbackAddress || undefined,
          assigneeIds: assignees,
          stage: order.stage,
        });
      }
    }

    const deadline = toDateKey(order.productionDetails?.deadline || null);
    if (deadline && order.stage !== "Completed") {
      events.push({
        id: `${order.id}-deadline`,
        orderId: order.id,
        orderCode,
        type: "deadline",
        dateKey: deadline,
        time: null,
        projectName,
        clientName,
        clientPhone,
        address: fallbackAddress || undefined,
        assigneeIds: assignees,
        stage: order.stage,
      });
    }
  }

  return events.sort((a, b) => {
    if (a.dateKey !== b.dateKey) return a.dateKey.localeCompare(b.dateKey);
    return (a.time || "").localeCompare(b.time || "");
  });
}

const SITE_VISIT_ACTIVE = new Set(["Site Visit Pending", "Site Visit Scheduled"]);
const INSTALL_DONE = new Set(["Completed", "Closed"]);
const DEADLINE_DONE = new Set([
  "Ready For Installation",
  "Installation Scheduled",
  "Completed",
  "Closed",
]);

export function eventStatus(
  event: CalendarEvent,
  today: string = todayDateKey()
): "upcoming" | "today" | "overdue" | "done" {
  if (event.type === "site_visit" && !SITE_VISIT_ACTIVE.has(event.stage)) {
    return "done";
  }
  if (event.type === "installation" && INSTALL_DONE.has(event.stage)) {
    return "done";
  }
  if (event.type === "deadline" && DEADLINE_DONE.has(event.stage)) {
    return "done";
  }

  if (event.dateKey === today) return "today";
  if (event.dateKey < today) return "overdue";
  return "upcoming";
}
