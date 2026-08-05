"use client";

import React from "react";
import { CompanyCalendarView } from "@/features/calendar/components/CompanyCalendarView";
import type {
  CalendarCustomerInput,
  CalendarEmployeeInput,
  CalendarEnquiryInput,
  CalendarOrderInput,
  CalendarReminderInput,
  CalendarTaskInput,
  PaymentOutstandingMap,
} from "@/features/calendar/types";

interface EmployeeCalendarViewProps {
  orders: CalendarOrderInput[];
  customers: CalendarCustomerInput[];
  currentEmployee: CalendarEmployeeInput & { role?: string };
  employees?: CalendarEmployeeInput[];
  paymentMap?: PaymentOutstandingMap;
  tasks?: CalendarTaskInput[];
  enquiries?: CalendarEnquiryInput[];
  reminders?: CalendarReminderInput[];
  includeHoldFollowups?: boolean;
  enquiryDetailBasePath?: string;
  onRescheduleSiteVisit?: (orderId: string, data: any) => Promise<any>;
  onRescheduleInstallation?: (orderId: string, data: any) => Promise<any>;
}

export const EmployeeCalendarView: React.FC<EmployeeCalendarViewProps> = ({
  orders,
  customers,
  currentEmployee,
  employees,
  paymentMap,
  tasks,
  enquiries,
  reminders,
  includeHoldFollowups = false,
  enquiryDetailBasePath = "/staff/enquiries",
  onRescheduleSiteVisit,
  onRescheduleInstallation,
}) => {
  return (
    <CompanyCalendarView
      orders={orders}
      customers={customers}
      employees={employees || [currentEmployee]}
      paymentMap={paymentMap}
      tasks={tasks}
      enquiries={enquiries}
      reminders={reminders}
      includeHoldFollowups={includeHoldFollowups}
      currentUserId={currentEmployee.id}
      title="Schedule & Site Visits"
      subtitle="Your assigned site audits, installations, hold follow-ups, and reminders."
      orderDetailBasePath="/staff/orders"
      enquiryDetailBasePath={enquiryDetailBasePath}
      taskDetailBasePath="/staff/tasks"
      lockedEmployeeId={currentEmployee.id}
      showEmployeeFilter={false}
      isAdmin={false}
      onRescheduleSiteVisit={onRescheduleSiteVisit}
      onRescheduleInstallation={onRescheduleInstallation}
    />
  );
};
