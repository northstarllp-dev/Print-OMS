import React from "react";
import { getTasks } from "@/features/tasks/actions/taskActions";
import { getEmployees } from "@/features/employees/actions/employeeActions";
import { getOrders } from "@/features/orders/actions/orderActions";
import { TasksDashboard } from "@/features/tasks/components/TasksDashboard";

export const metadata = {
  title: "Tasks | Admin",
};

export default async function AdminTasksPage() {
  const [tasks, employeesData, orders] = await Promise.all([
    getTasks(),
    getEmployees(),
    getOrders(),
  ]);

  const employees = (employeesData || []).map((item: any) => ({
    id: item.id,
    name: item.name || item.email || "Employee",
  }));

  const orderOptions = (orders || []).map((item: any) => ({
    id: item.id,
    label:
      [item.order_id, item.business_name, item.client_name].filter(Boolean).join(" - ") ||
      item.order_id ||
      item.id,
  }));

  return (
    <TasksDashboard
      tasks={tasks}
      employees={employees}
      orders={orderOptions}
      isAdmin={true}
    />
  );
}
