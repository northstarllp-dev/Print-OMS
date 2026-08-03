export type CalendarEventType = "site_visit" | "installation" | "deadline" | "task";

export interface CalendarEvent {
  id: string;
  orderId?: string;
  orderCode?: string;
  taskId?: string;
  type: CalendarEventType;
  /** Local calendar day key YYYY-MM-DD */
  dateKey: string;
  time?: string | null;
  projectName: string;
  clientName: string;
  clientPhone?: string;
  address?: string;
  /** Google Maps link for the event location */
  gmapLink?: string | null;
  /** Outstanding payment amount for this order (₹) */
  outstandingAmount?: number;
  assigneeIds: string[];
  stage: string;
  metaLabel?: string;
}

/** Map of order UUID → outstanding payment amount */
export type PaymentOutstandingMap = Record<string, number>;

export interface CalendarOrderInput {
  id: string;
  orderCode?: string;
  orderId?: string;
  customerId?: string;
  clientName: string;
  businessName: string;
  stage: string;
  assignedEmployees: string[];
  siteVisitDetails?: {
    preferredDate?: string | null;
    preferredTime?: string | null;
    auditDate?: string | null;
    auditTime?: string | null;
    customerAddress?: string | null;
    gpsLocation?: string | null;
  } | null;
  installationDetails?: {
    scheduledDate?: string | null;
    scheduledTime?: string | null;
    scheduled_date?: string | null;
    scheduled_time?: string | null;
    gmapLink?: string | null;
  } | null;
  productionDetails?: {
    deadline?: string | null;
  } | null;
}

export interface CalendarCustomerInput {
  id: string;
  name: string;
  phone?: string;
  shippingAddress?: string;
}

export interface CalendarEmployeeInput {
  id: string;
  name: string;
}

export interface CalendarTaskInput {
  id: string;
  taskId?: string;
  title: string;
  status: string;
  assignedAt?: string | null;
  dueDate?: string | null;
  assigneeId: string;
  orderCode?: string | null;
}
