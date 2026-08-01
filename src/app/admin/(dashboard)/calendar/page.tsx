import { getOrders } from "@/features/orders/actions/orderActions";
import { getCustomers } from "@/features/customers/actions/customerActions";
import { getEmployees } from "@/features/employees/actions/employeeActions";
import { CompanyCalendarView } from "@/features/calendar/components/CompanyCalendarView";
import { scheduleSiteVisitAction } from "@/features/orders/actions/orderActions";
import { scheduleInstallationAction } from "@/features/installations/actions/installationActions";
import type { PaymentOutstandingMap } from "@/features/calendar/types";
import { getTasks } from "@/features/tasks/actions/taskActions";

export const metadata = {
  title: "Calendar | Admin",
};

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

export default async function AdminCalendarPage() {
  const [ordersData, customersData, employeesData, tasksData] = await Promise.all([
    getOrders(),
    getCustomers(),
    getEmployees(),
    getTasks(),
  ]);

  const paymentMap = buildPaymentMap(ordersData || []);

  const mappedOrders =
    ordersData?.map((o) => ({
      id: o.id,
      clientName: o.client_name,
      businessName: o.business_name || "",
      customerId: o.customer_id,
      stage: o.stage,
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

  return (
    <div className="flex-1 bg-slate-50 min-h-screen">
      <CompanyCalendarView
        orders={mappedOrders}
        customers={mappedCustomers}
        employees={mappedEmployees}
        paymentMap={paymentMap}
        tasks={mappedTasks}
        title="Company Calendar"
        subtitle="View all site visits, installations, and production deadlines across the team."
        orderDetailBasePath="/admin/orders"
        taskDetailBasePath="/admin/tasks"
        showEmployeeFilter
        isAdmin
        onRescheduleSiteVisit={scheduleSiteVisitAction}
        onRescheduleInstallation={scheduleInstallationAction}
      />
    </div>
  );
}
