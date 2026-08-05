import React from "react";
import { redirect } from "next/navigation";
import { EmployeeCalendarView } from "@/features/employees/components/EmployeeCalendarView";
import { getOrders } from "@/features/orders/actions/orderActions";
import { getCustomers } from "@/features/customers/actions/customerActions";
import { getCurrentUser } from "@/features/auth/actions/authActions";
import { getEmployees } from "@/features/employees/actions/employeeActions";
import { scheduleSiteVisitAction } from "@/features/orders/actions/orderActions";
import { scheduleInstallationAction } from "@/features/installations/actions/installationActions";
import type { PaymentOutstandingMap } from "@/features/calendar/types";
import { getTasks } from "@/features/tasks/actions/taskActions";
import { getEnquiries } from "@/features/enquiries/actions/enquiryActions";
import { listCalendarReminders } from "@/features/calendar/actions/reminderActions";
import { resolveStagePermission } from "@/features/orders/workspace/shared/permissions";
import { canListEnquiries } from "@/features/enquiries/enquiryListLogic";

function buildPaymentMap(orders: any[]): PaymentOutstandingMap {
  const map: PaymentOutstandingMap = {};
  for (const o of orders) {
    const quotations = o.quotations as any[] | null;
    const payments = o.payments as any[] | null;
    const grandTotal = quotations?.reduce((sum: number, q: any) => {
      if (q.status === "approved" || q.status === "sent") {
        return sum + (Number(q.grand_total) || 0);
      }
      return sum;
    }, 0) ?? 0;
    const paid = payments?.reduce((sum: number, p: any) => {
      if (p.status === "received") {
        return sum + (Number(p.calculated_amount ?? p.amount) || 0);
      }
      return sum;
    }, 0) ?? 0;
    const outstanding = Math.max(0, Math.round((grandTotal - paid) * 100) / 100);
    if (outstanding > 0) {
      map[o.id] = outstanding;
    }
  }
  return map;
}

export default async function StaffCalendarPage() {
  const profile = await getCurrentUser();
  if (!profile || (profile.role !== "staff" && profile.role !== "admin")) {
    redirect("/staff/login");
  }

  const enquiryPerm = resolveStagePermission("enquiry", {
    role: profile.role,
    staff_role: profile.staff_role ?? null,
    company_id: profile.company_id ?? null,
  });
  const includeHoldFollowups = canListEnquiries({
    role: profile.role,
    canView: enquiryPerm.canView,
    canEdit: enquiryPerm.canEdit,
  });

  const [ordersData, customersData, employeesData, tasksData, enquiriesData, remindersData] =
    await Promise.all([
      getOrders(),
      getCustomers(),
      getEmployees(),
      getTasks(),
      includeHoldFollowups ? getEnquiries().catch(() => []) : Promise.resolve([]),
      listCalendarReminders().catch(() => []),
    ]);

  const paymentMap = buildPaymentMap(ordersData || []);

  const mappedEmployee = {
    id: profile.id,
    name: profile.name,
    role: profile.staff_role || "Field Agent",
  };

  const mappedOrders =
    ordersData?.map((o) => ({
      id: o.id,
      clientName: o.client_name,
      businessName: o.business_name || "",
      customerId: o.customer_id,
      stage: o.stage,
      health: o.health || "Active",
      holdNote: o.hold_note || null,
      reachOutAt: o.reach_out_at || null,
      assignedEmployees: o.assigned_employees || [],
      orderCode: o.order_id || o.id,
      orderId: o.order_id || o.id,
      siteVisitDetails: o.siteVisitDetails || null,
      installationDetails: o.installationDetails || null,
      productionDetails: o.productionDetails || null,
    })) || [];

  const mappedCustomers =
    customersData?.map((c) => ({
      id: c.id,
      name: c.name,
      phone: c.phone || "",
      email: c.email || "",
      shippingAddress: c.shipping_address || "",
    })) || [];

  const mappedEmployees =
    employeesData?.map((e) => ({
      id: e.id,
      name: e.name,
    })) || [];

  const mappedTasks =
    tasksData?.map((task) => ({
      id: task.id,
      taskId: task.task_id,
      title: task.title,
      status: task.status,
      assignedAt: task.assigned_at,
      dueDate: task.due_date,
      assigneeId: task.assignee_id,
      orderCode: task.order_code || null,
    })) || [];

  const mappedEnquiries =
    (enquiriesData as any[])?.map((e) => ({
      id: e.id,
      enquireId: e.enquire_id || e.id,
      leadName: e.lead_name,
      businessName: e.business_name || e.lead_name,
      phone: e.phone,
      email: e.email,
      health: e.health || "Active",
      holdNote: e.hold_note || null,
      reachOutAt: e.reach_out_at || null,
      status: e.status,
    })) || [];

  const mappedReminders =
    remindersData?.map((r) => ({
      id: r.id,
      title: r.title,
      note: r.note,
      reminderDate: r.reminder_date,
      createdBy: r.created_by,
      viewerIds: r.viewer_ids || [],
    })) || [];

  return (
    <EmployeeCalendarView
      orders={mappedOrders}
      customers={mappedCustomers}
      currentEmployee={mappedEmployee}
      employees={mappedEmployees}
      paymentMap={paymentMap}
      tasks={mappedTasks}
      enquiries={mappedEnquiries}
      reminders={mappedReminders}
      includeHoldFollowups={includeHoldFollowups}
      enquiryDetailBasePath="/staff/enquiries"
      onRescheduleSiteVisit={scheduleSiteVisitAction}
      onRescheduleInstallation={scheduleInstallationAction}
    />
  );
}
