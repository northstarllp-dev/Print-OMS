import type {
  CalendarTaskInput,
  CalendarCustomerInput,
  CalendarEnquiryInput,
  CalendarEvent,
  CalendarOrderInput,
  CalendarReminderInput,
  PaymentOutstandingMap,
} from "./types";
import {
  buildGoogleMapsSearchUrl,
  resolveSiteVisitInstallationAddress,
} from "@/features/orders/actions/siteVisitMapper";

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

/** Build a Google Maps search URL from an address string. */
function buildGmapSearch(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

export function buildHoldFollowUpEvents(
  orders: CalendarOrderInput[],
  enquiries: CalendarEnquiryInput[] = [],
  customerById?: Map<string, CalendarCustomerInput>
): CalendarEvent[] {
  const events: CalendarEvent[] = [];

  for (const order of orders) {
    if (order.health !== "On Hold") continue;
    const dateKey = toDateKey(order.reachOutAt);
    if (!dateKey) continue;
    const orderCode = order.orderCode || order.orderId || order.id;
    const customer = order.customerId && customerById ? customerById.get(order.customerId) : undefined;
    
    events.push({
      id: `${order.id}-hold_followup`,
      orderId: order.id,
      orderCode,
      type: "hold_followup",
      dateKey,
      time: null,
      projectName: order.businessName || order.clientName || "Order",
      clientName: order.clientName || "Unknown client",
      clientPhone: customer?.phone || undefined,
      clientEmail: customer?.email || undefined,
      assigneeIds: [],
      stage: order.stage,
      metaLabel: "Order hold",
      note: order.holdNote || null,
    });
  }

  for (const enq of enquiries) {
    if (enq.health !== "On Hold") continue;
    if (enq.status === "Converted") continue;
    const dateKey = toDateKey(enq.reachOutAt);
    if (!dateKey) continue;
    events.push({
      id: `${enq.id}-hold_followup`,
      enquiryId: enq.id,
      enquiryCode: enq.enquireId || enq.id,
      orderCode: enq.enquireId || undefined,
      type: "hold_followup",
      dateKey,
      time: null,
      projectName: enq.businessName || enq.leadName || "Enquiry",
      clientName: enq.leadName || enq.businessName || "Lead",
      clientPhone: enq.phone || undefined,
      clientEmail: enq.email || undefined,
      assigneeIds: [],
      stage: enq.status || "On Hold",
      metaLabel: "Enquiry hold",
      note: enq.holdNote || null,
    });
  }

  return events;
}

export function buildReminderCalendarEvents(
  reminders: CalendarReminderInput[]
): CalendarEvent[] {
  return reminders
    .map((r) => {
      const dateKey = toDateKey(r.reminderDate);
      if (!dateKey) return null;
      const viewers = Array.from(new Set([r.createdBy, ...(r.viewerIds || [])]));
      return {
        id: `${r.id}-reminder`,
        reminderId: r.id,
        type: "reminder" as const,
        dateKey,
        time: null,
        projectName: r.title,
        clientName: "Reminder",
        assigneeIds: viewers,
        stage: "Reminder",
        metaLabel: "Reminder",
        note: r.note || null,
      };
    })
    .filter(Boolean) as CalendarEvent[];
}

export function buildCalendarEvents(
  orders: CalendarOrderInput[],
  customers: CalendarCustomerInput[] = [],
  paymentMap?: PaymentOutstandingMap,
  tasks: CalendarTaskInput[] = [],
  options?: {
    enquiries?: CalendarEnquiryInput[];
    reminders?: CalendarReminderInput[];
    includeHoldFollowups?: boolean;
  }
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
    const clientEmail = customer?.email || "";
    const fallbackAddress = customer?.shippingAddress || "";
    const assignees = order.assignedEmployees || [];
    const outstanding = paymentMap?.[order.id] ?? 0;

    const sv = order.siteVisitDetails;
    if (sv) {
      const visitDate = toDateKey(sv.auditDate || sv.preferredDate || null);
      if (visitDate) {
        const svAddress = sv.customerAddress || fallbackAddress || undefined;
        let svGmap: string | null = null;
        if (sv.gpsLocation) {
          svGmap = buildGmapSearch(sv.gpsLocation);
        } else if (svAddress) {
          svGmap = buildGmapSearch(svAddress);
        }
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
          clientEmail,
          address: svAddress,
          gmapLink: svGmap,
          outstandingAmount: outstanding,
          assigneeIds: assignees,
          stage: order.stage,
        });
      }
    }

    const inst = order.installationDetails;
    if (inst) {
      const installDate = toDateKey(inst.scheduledDate || inst.scheduled_date || null);
      if (installDate) {
        const instAddress =
          resolveSiteVisitInstallationAddress(sv, fallbackAddress) ||
          fallbackAddress ||
          undefined;
        const instGmap =
          buildGoogleMapsSearchUrl(sv?.gpsLocation) ||
          inst.gmapLink ||
          (instAddress ? buildGmapSearch(instAddress) : null);
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
          clientEmail,
          address: instAddress,
          gmapLink: instGmap,
          outstandingAmount: outstanding,
          assigneeIds: assignees,
          stage: order.stage,
        });
      }
    }

    const deadline = toDateKey(
      order.productionDetails?.installation_deadline ||
        order.productionDetails?.deadline ||
        null
    );
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
        clientEmail,
        address: fallbackAddress || undefined,
        gmapLink: fallbackAddress ? buildGmapSearch(fallbackAddress) : null,
        outstandingAmount: outstanding,
        assigneeIds: assignees,
        stage: order.stage,
      });
    }
  }

  const holdEvents =
    options?.includeHoldFollowups === false
      ? []
      : buildHoldFollowUpEvents(orders, options?.enquiries || [], customerById);
  const reminderEvents = buildReminderCalendarEvents(options?.reminders || []);
  const allEvents = [
    ...events,
    ...buildTaskCalendarEvents(tasks),
    ...holdEvents,
    ...reminderEvents,
  ];

  return allEvents.sort((a, b) => {
    if (a.dateKey !== b.dateKey) return a.dateKey.localeCompare(b.dateKey);
    return (a.time || "").localeCompare(b.time || "");
  });
}

export function buildTaskCalendarEvents(tasks: CalendarTaskInput[]): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  for (const task of tasks) {
    const assigneeIds = [task.assigneeId];
    const assignedDate = toDateKey(task.assignedAt);
    const dueDate = toDateKey(task.dueDate);

    if (assignedDate) {
      events.push({
        id: `${task.id}-assigned`,
        taskId: task.id,
        orderCode: task.taskId || undefined,
        type: "task",
        dateKey: assignedDate,
        time: null,
        projectName: task.title,
        clientName: "Assigned Task",
        assigneeIds,
        stage: task.status,
        metaLabel: "Assigned",
      });
    }

    if (dueDate) {
      events.push({
        id: `${task.id}-due`,
        taskId: task.id,
        orderCode: task.taskId || undefined,
        type: "task",
        dateKey: dueDate,
        time: null,
        projectName: task.title,
        clientName: "Task Deadline",
        assigneeIds,
        stage: task.status,
        metaLabel: "Due",
      });
    }
  }
  return events;
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
  if (event.type === "task" && (event.stage === "Completed" || event.stage === "Cancelled")) {
    return "done";
  }

  if (event.dateKey === today) return "today";
  if (event.dateKey < today) return "overdue";
  return "upcoming";
}
