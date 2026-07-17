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
    orders = orders?.filter(o => o.date_created && new Date(o.date_created).toISOString().split("T")[0] >= startDate);
    enquiries = enquiries?.filter(e => e.date_received && new Date(e.date_received).toISOString().split("T")[0] >= startDate);
    tickets = tickets?.filter(t => t.created_at && new Date(t.created_at).toISOString().split("T")[0] >= startDate);
  }
  if (endDate) {
    orders = orders?.filter(o => o.date_created && new Date(o.date_created).toISOString().split("T")[0] <= endDate);
    enquiries = enquiries?.filter(e => e.date_received && new Date(e.date_received).toISOString().split("T")[0] <= endDate);
    tickets = tickets?.filter(t => t.created_at && new Date(t.created_at).toISOString().split("T")[0] <= endDate);
  }

  // Helper: get YYYY-MM key from a date string
  const monthKey = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  };

  const monthLabel = (key: string) => {
    const [y, m] = key.split("-");
    return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("en-US", { month: "short", year: "2-digit" });
  };

  // Helper: get revenue from an order (from quotations grand_total or payments amount)
  const getOrderRevenue = (o: any): number => {
    const quotations = Array.isArray(o.quotations) ? o.quotations : (o.quotations ? [o.quotations] : []);
    const approved = quotations.find((q: any) => q.status === "Approved");
    if (approved?.grand_total) return Number(approved.grand_total);
    const payments = Array.isArray(o.payments) ? o.payments : (o.payments ? [o.payments] : []);
    const totalPaid = payments.reduce((sum: number, p: any) => sum + (Number(p.amount) || Number(p.calculated_amount) || 0), 0);
    if (totalPaid > 0) return totalPaid;
    return 0;
  };

  // ─── 1. Orders Over Time (Monthly) ─────────────────────────────────────────
  const ordersByMonthMap: Record<string, { count: number; revenue: number }> = {};
  orders?.forEach((o: any) => {
    if (!o.date_created) return;
    const key = monthKey(o.date_created);
    if (!ordersByMonthMap[key]) ordersByMonthMap[key] = { count: 0, revenue: 0 };
    ordersByMonthMap[key].count += 1;
    ordersByMonthMap[key].revenue += getOrderRevenue(o);
  });
  const ordersByMonth = Object.entries(ordersByMonthMap)
    .map(([key, data]) => ({ month: monthLabel(key), monthKey: key, count: data.count, revenue: Math.round(data.revenue) }))
    .sort((a, b) => a.monthKey.localeCompare(b.monthKey));

  // ─── 2. Orders By Stage (Donut) ────────────────────────────────────────────
  const ordersByStageMap: Record<string, number> = {};
  orders?.forEach((o: any) => {
    const stage = o.stage || "Unknown";
    ordersByStageMap[stage] = (ordersByStageMap[stage] || 0) + 1;
  });
  const ordersByStage = Object.entries(ordersByStageMap).map(([stage, count]) => ({ stage, count }));

  // ─── 3. Pipeline Funnel ────────────────────────────────────────────────────
  const totalEnquiries = enquiries?.length || 0;
  const totalOrders = orders?.length || 0;
  const totalCompleted = orders?.filter((o: any) => o.stage === "Completed" || o.stage === "Closed").length || 0;
  const totalInstallation = orders?.filter((o: any) => ["Installation Scheduled", "Ready For Installation"].includes(o.stage)).length || 0;
  const conversionFunnel = [
    { stage: "Enquiries", count: totalEnquiries },
    { stage: "Orders", count: totalOrders },
    { stage: "Installation", count: totalInstallation },
    { stage: "Completed", count: totalCompleted },
  ];

  // ─── 4. Revenue By Customer (Top 10) ───────────────────────────────────────
  const revenueByCustomerMap: Record<string, number> = {};
  orders?.forEach((o: any) => {
    if (!o.customer_id) return;
    revenueByCustomerMap[o.customer_id] = (revenueByCustomerMap[o.customer_id] || 0) + getOrderRevenue(o);
  });
  const revenueByCustomer = Object.entries(revenueByCustomerMap)
    .map(([customerId, revenue]) => {
      const customer = customers?.find((c: any) => c.id === customerId);
      return { customer: customer?.name || customer?.business_name || customerId.slice(0, 8), revenue: Math.round(revenue) };
    })
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  // ─── 5. Team Performance ───────────────────────────────────────────────────
  const teamPerformanceMap: Record<string, { ordersCompleted: number; ordersAssigned: number }> = {};
  orders?.forEach((o: any) => {
    const empIds: string[] = o.assigned_employees || o.assignedEmployees || [];
    empIds.forEach((empId: string) => {
      if (!teamPerformanceMap[empId]) teamPerformanceMap[empId] = { ordersCompleted: 0, ordersAssigned: 0 };
      teamPerformanceMap[empId].ordersAssigned += 1;
      if (o.stage === "Completed" || o.stage === "Closed") {
        teamPerformanceMap[empId].ordersCompleted += 1;
      }
    });
  });
  const teamPerformance = Object.entries(teamPerformanceMap)
    .map(([empId, data]) => {
      const emp = employees?.find((e: any) => e.id === empId);
      return { employee: emp?.name || empId.slice(0, 8), ordersCompleted: data.ordersCompleted, ordersAssigned: data.ordersAssigned };
    })
    .sort((a, b) => b.ordersCompleted - a.ordersCompleted)
    .slice(0, 10);

  // ─── 6. Ticket Analysis by Priority ───────────────────────────────────────
  const ticketsByPriorityMap: Record<string, number> = {};
  tickets?.forEach((t: any) => {
    const priority = t.priority || "Normal";
    ticketsByPriorityMap[priority] = (ticketsByPriorityMap[priority] || 0) + 1;
  });
  const ticketsByPriority = Object.entries(ticketsByPriorityMap).map(([priority, count]) => ({ priority, count }));

  // ─── 7. Enquiry Sources ────────────────────────────────────────────────────
  const enquirySourcesMap: Record<string, number> = {};
  enquiries?.forEach((e: any) => {
    const source = e.source || "Unknown";
    enquirySourcesMap[source] = (enquirySourcesMap[source] || 0) + 1;
  });
  const enquirySourceBreakdown = Object.entries(enquirySourcesMap).map(([source, count]) => ({ source, count }));

  // ─── 8. Order Health Breakdown ────────────────────────────────────────────
  const healthMap: Record<string, number> = {};
  orders?.forEach((o: any) => {
    const h = o.health || "Active";
    healthMap[h] = (healthMap[h] || 0) + 1;
  });
  const orderHealthBreakdown = Object.entries(healthMap).map(([health, count]) => ({ health, count }));

  // ─── 9. Revenue Trend (last 12 months, with MoM growth) ──────────────────
  const revenueByMonthArr = ordersByMonth.slice(-12);
  const revenueTrend = revenueByMonthArr.map((item, i) => {
    const prev = i > 0 ? revenueByMonthArr[i - 1].revenue : 0;
    const growth = prev > 0 ? Math.round(((item.revenue - prev) / prev) * 100) : 0;
    return { month: item.month, revenue: item.revenue, orders: item.count, growth };
  });

  // ─── 10. Weekly Completions (last 12 weeks) ───────────────────────────────
  const weeklyMap: Record<string, number> = {};
  const now = new Date();
  orders?.forEach((o: any) => {
    if ((o.stage !== "Completed" && o.stage !== "Closed") || !o.date_created) return;
    const d = new Date(o.date_created);
    const diffMs = now.getTime() - d.getTime();
    const weeksAgo = Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000));
    if (weeksAgo > 11) return;
    const label = `W-${11 - weeksAgo}`;
    weeklyMap[label] = (weeklyMap[label] || 0) + 1;
  });
  const weeklyCompletions = Array.from({ length: 12 }, (_, i) => {
    const label = `W-${i}`;
    return { week: i === 11 ? "This week" : i === 10 ? "Last week" : `-${11 - i}w`, completed: weeklyMap[label] || 0 };
  });

  // ─── 11. Conversion Rate by Month ─────────────────────────────────────────
  const enquiriesByMonthMap: Record<string, number> = {};
  enquiries?.forEach((e: any) => {
    const d = e.date_received || e.date_created;
    if (!d) return;
    const key = monthKey(d);
    enquiriesByMonthMap[key] = (enquiriesByMonthMap[key] || 0) + 1;
  });
  const conversionByMonth = Object.entries(ordersByMonthMap)
    .map(([key, data]) => {
      const enqCount = enquiriesByMonthMap[key] || 0;
      const rate = enqCount > 0 ? Math.round((data.count / enqCount) * 100) : 0;
      return { month: monthLabel(key), monthKey: key, orders: data.count, enquiries: enqCount, rate };
    })
    .sort((a, b) => a.monthKey.localeCompare(b.monthKey))
    .slice(-12);

  // ─── 12. Customer Retention (new vs. returning) ───────────────────────────
  const firstOrderByCustomer: Record<string, string> = {};
  const sortedOrders = [...(orders || [])].sort((a: any, b: any) =>
    (a.date_created || "").localeCompare(b.date_created || "")
  );
  sortedOrders.forEach((o: any) => {
    if (!o.customer_id || !o.date_created) return;
    if (!firstOrderByCustomer[o.customer_id]) firstOrderByCustomer[o.customer_id] = monthKey(o.date_created);
  });

  const customerRetentionMap: Record<string, { new: number; returning: number }> = {};
  orders?.forEach((o: any) => {
    if (!o.customer_id || !o.date_created) return;
    const key = monthKey(o.date_created);
    if (!customerRetentionMap[key]) customerRetentionMap[key] = { new: 0, returning: 0 };
    if (firstOrderByCustomer[o.customer_id] === key) customerRetentionMap[key].new += 1;
    else customerRetentionMap[key].returning += 1;
  });
  const customerRetention = Object.entries(customerRetentionMap)
    .map(([key, data]) => ({ month: monthLabel(key), monthKey: key, new: data.new, returning: data.returning }))
    .sort((a, b) => a.monthKey.localeCompare(b.monthKey))
    .slice(-12);

  // ─── 13. Ticket Status Breakdown ──────────────────────────────────────────
  const ticketStatusMap: Record<string, number> = {};
  tickets?.forEach((t: any) => {
    const s = t.status || "Open";
    ticketStatusMap[s] = (ticketStatusMap[s] || 0) + 1;
  });
  const ticketStatusBreakdown = Object.entries(ticketStatusMap).map(([status, count]) => ({ status, count }));

  // ─── KPI Summary ─────────────────────────────────────────────────────────
  const totalRevenue = orders?.reduce((sum: number, o: any) => sum + getOrderRevenue(o), 0) || 0;
  const avgOrderValue = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;
  const conversionRate = totalEnquiries > 0 ? Math.round((totalOrders / totalEnquiries) * 100) : 0;
  const activeOrders = orders?.filter((o: any) => !["Completed", "Closed", "Cancelled"].includes(o.stage)).length || 0;
  const openTickets = tickets?.filter((t: any) => t.status === "Open" || t.status === "In Progress").length || 0;

  // MoM revenue growth (last 2 months)
  const lastTwoMonths = ordersByMonth.slice(-2);
  const revenueGrowth = lastTwoMonths.length === 2 && lastTwoMonths[0].revenue > 0
    ? Math.round(((lastTwoMonths[1].revenue - lastTwoMonths[0].revenue) / lastTwoMonths[0].revenue) * 100)
    : 0;

  return {
    // Summary KPIs
    kpis: {
      totalRevenue: Math.round(totalRevenue),
      totalOrders,
      avgOrderValue,
      conversionRate,
      activeOrders,
      openTickets,
      revenueGrowth,
    },
    // Charts
    ordersByMonth,
    ordersByStage,
    conversionFunnel,
    revenueByCustomer,
    teamPerformance,
    ticketsByPriority,
    enquirySourceBreakdown,
    orderHealthBreakdown,
    revenueTrend,
    weeklyCompletions,
    conversionByMonth,
    customerRetention,
    ticketStatusBreakdown,
  };
}
