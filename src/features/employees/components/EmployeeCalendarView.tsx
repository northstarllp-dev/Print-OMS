"use client";

import React from "react";
import { CompanyCalendarView } from "@/features/calendar/components/CompanyCalendarView";
import type {
  CalendarCustomerInput,
  CalendarEmployeeInput,
  CalendarOrderInput,
} from "@/features/calendar/types";

interface EmployeeCalendarViewProps {
  orders: CalendarOrderInput[];
  customers: CalendarCustomerInput[];
  currentEmployee: CalendarEmployeeInput & { role?: string };
  employees?: CalendarEmployeeInput[];
}

export const EmployeeCalendarView: React.FC<EmployeeCalendarViewProps> = ({
  orders,
  customers,
  currentEmployee,
  employees,
}) => {
  return (
    <CompanyCalendarView
      orders={orders}
      customers={customers}
      employees={employees || [currentEmployee]}
      title="Schedule & Site Visits"
      subtitle="Your assigned site audits, installations, and production deadlines."
      orderDetailBasePath="/staff/orders"
      lockedEmployeeId={currentEmployee.id}
      showEmployeeFilter={false}
    />
  );
};
