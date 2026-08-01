"use client";

import React from "react";
import { CompanyCalendarView } from "@/features/calendar/components/CompanyCalendarView";
import type {
  CalendarCustomerInput,
  CalendarEmployeeInput,
  CalendarOrderInput,
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
      title="Schedule & Site Visits"
      subtitle="Your assigned site audits, installations, and production deadlines."
      orderDetailBasePath="/staff/orders"
      taskDetailBasePath="/staff/tasks"
      lockedEmployeeId={currentEmployee.id}
      showEmployeeFilter={false}
      isAdmin={false}
      onRescheduleSiteVisit={onRescheduleSiteVisit}
      onRescheduleInstallation={onRescheduleInstallation}
    />
  );
};
