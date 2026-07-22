export type CalendarEventType = "site_visit" | "installation" | "deadline";

export interface CalendarEvent {
  id: string;
  orderId: string;
  orderCode: string;
  type: CalendarEventType;
  /** Local calendar day key YYYY-MM-DD */
  dateKey: string;
  time?: string | null;
  projectName: string;
  clientName: string;
  clientPhone?: string;
  address?: string;
  assigneeIds: string[];
  stage: string;
}

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
