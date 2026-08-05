export type CalendarEventType =
  | "site_visit"
  | "installation"
  | "deadline"
  | "task"
  | "hold_followup"
  | "reminder";

export interface CalendarEvent {
  id: string;
  orderId?: string;
  orderCode?: string;
  enquiryId?: string;
  enquiryCode?: string;
  taskId?: string;
  reminderId?: string;
  type: CalendarEventType;
  /** Local calendar day key YYYY-MM-DD */
  dateKey: string;
  time?: string | null;
  projectName: string;
  clientName: string;
  clientPhone?: string;
  clientEmail?: string;
  address?: string;
  /** Google Maps link for the event location */
  gmapLink?: string | null;
  /** Outstanding payment amount for this order (₹) */
  outstandingAmount?: number;
  assigneeIds: string[];
  stage: string;
  metaLabel?: string;
  /** Hold / reminder note shown in agenda */
  note?: string | null;
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
  health?: string | null;
  holdNote?: string | null;
  reachOutAt?: string | null;
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
    installation_deadline?: string | null;
    deadline?: string | null;
  } | null;
}

export interface CalendarEnquiryInput {
  id: string;
  enquireId?: string | null;
  leadName?: string | null;
  businessName?: string | null;
  phone?: string | null;
  health?: string | null;
  holdNote?: string | null;
  reachOutAt?: string | null;
  status?: string | null;
  email?: string | null;
}

export interface CalendarCustomerInput {
  id: string;
  name: string;
  phone?: string;
  email?: string;
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

export interface CalendarReminderInput {
  id: string;
  title: string;
  note?: string | null;
  reminderDate: string;
  createdBy: string;
  viewerIds: string[];
}
