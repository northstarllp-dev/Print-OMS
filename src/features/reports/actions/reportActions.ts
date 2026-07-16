"use server";

import { getOrders } from "@/features/orders/actions/orderActions";
import { getEnquiries } from "@/features/enquiries/actions/enquiryActions";
import { getServiceTickets } from "@/features/service-tickets/actions/serviceTicketActions";
import { getCustomers } from "@/features/customers/actions/customerActions";
import { getEmployees } from "@/features/employees/actions/employeeActions";

export async function getReportData(startDate?: string, endDate?: string) {
  let [orders, enquiries, tickets, customers, employees] = await Promise.all([
    getOrders(),
    getEnquiries(),
    getServiceTickets(),
    getCustomers(),
    getEmployees(),
  ]);

  if (startDate) {
    orders = orders?.filter(o => o.dateCreated && new Date(o.dateCreated).toISOString().split("T")[0] >= startDate);
    enquiries = enquiries?.filter(e => e.dateCreated && new Date(e.dateCreated).toISOString().split("T")[0] >= startDate);
    tickets = tickets?.filter(t => t.created_at && new Date(t.created_at).toISOString().split("T")[0] >= startDate);
  }
  if (endDate) {
    orders = orders?.filter(o => o.dateCreated && new Date(o.dateCreated).toISOString().split("T")[0] <= endDate);
    enquiries = enquiries?.filter(e => e.dateCreated && new Date(e.dateCreated).toISOString().split("T")[0] <= endDate);
    tickets = tickets?.filter(t => t.created_at && new Date(t.created_at).toISOString().split("T")[0] <= endDate);
  }

  // 1. Orders Over Time (Monthly)
  const ordersByMonthMap: Record<string, { count: number; revenue: number }> = {};
  orders?.forEach((o: any) => {
    if (!o.dateCreated) return;
    const date = new Date(o.dateCreated);
    const monthYear = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    if (!ordersByMonthMap[monthYear]) {
      ordersByMonthMap[monthYear] = { count: 0, revenue: 0 };
    }
    ordersByMonthMap[monthYear].count += 1;
    ordersByMonthMap[monthYear].revenue += o.totalAmount || 0;
  });
  const ordersByMonth = Object.entries(ordersByMonthMap)
    .map(([month, data]) => ({ month, count: data.count, revenue: data.revenue }))
    .sort((a, b) => a.month.localeCompare(b.month));

  // 2. Orders By Stage (Pie)
  const ordersByStageMap: Record<string, number> = {};
  orders?.forEach((o: any) => {
    const stage = o.stage || "Unknown";
    ordersByStageMap[stage] = (ordersByStageMap[stage] || 0) + 1;
  });
  const ordersByStage = Object.entries(ordersByStageMap).map(([stage, count]) => ({ stage, count }));

  // 3. Pipeline Funnel
  const totalEnquiries = enquiries?.length || 0;
  const totalOrders = orders?.length || 0;
  const totalCompleted = orders?.filter((o: any) => o.stage === "Completed" || o.stage === "Closed").length || 0;
  const conversionFunnel = [
    { stage: "Enquiries", count: totalEnquiries },
    { stage: "Orders", count: totalOrders },
    { stage: "Completed", count: totalCompleted },
  ];

  // 4. Revenue By Customer (Top 10)
  const revenueByCustomerMap: Record<string, number> = {};
  orders?.forEach((o: any) => {
    if (!o.customerId) return;
    revenueByCustomerMap[o.customerId] = (revenueByCustomerMap[o.customerId] || 0) + (o.totalAmount || 0);
  });
  const revenueByCustomer = Object.entries(revenueByCustomerMap)
    .map(([customerId, revenue]) => {
      const customer = customers?.find((c: any) => c.id === customerId);
      return { customer: customer?.name || customerId, revenue };
    })
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  // 5. Team Performance
  const teamPerformanceMap: Record<string, { ordersCompleted: number }> = {};
  orders?.forEach((o: any) => {
    if (o.stage === "Completed" || o.stage === "Closed") {
      o.assignedEmployees?.forEach((empId: string) => {
        if (!teamPerformanceMap[empId]) {
          teamPerformanceMap[empId] = { ordersCompleted: 0 };
        }
        teamPerformanceMap[empId].ordersCompleted += 1;
      });
    }
  });
  const teamPerformance = Object.entries(teamPerformanceMap)
    .map(([empId, data]) => {
      const emp = employees?.find((e: any) => e.id === empId);
      return { employee: emp?.name || empId, ordersCompleted: data.ordersCompleted };
    })
    .sort((a, b) => b.ordersCompleted - a.ordersCompleted);

  // 6. Ticket Analysis
  const ticketsByPriorityMap: Record<string, number> = {};
  tickets?.forEach((t: any) => {
    const priority = t.priority || "Unknown";
    ticketsByPriorityMap[priority] = (ticketsByPriorityMap[priority] || 0) + 1;
  });
  const ticketsByPriority = Object.entries(ticketsByPriorityMap).map(([priority, count]) => ({ priority, count }));

  // 7. Enquiry Sources
  const enquirySourcesMap: Record<string, number> = {};
  enquiries?.forEach((e: any) => {
    const source = e.source || "Unknown";
    enquirySourcesMap[source] = (enquirySourcesMap[source] || 0) + 1;
  });
  const enquirySourceBreakdown = Object.entries(enquirySourcesMap).map(([source, count]) => ({ source, count }));

  return {
    ordersByMonth,
    ordersByStage,
    conversionFunnel,
    revenueByCustomer,
    teamPerformance,
    ticketsByPriority,
    enquirySourceBreakdown,
  };
}
