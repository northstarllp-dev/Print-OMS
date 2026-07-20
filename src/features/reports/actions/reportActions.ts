"use server";

import { getOrders } from "@/features/orders/actions/orderActions";
import { getEnquiries } from "@/features/enquiries/actions/enquiryActions";
import { getServiceTickets } from "@/features/service-tickets/actions/serviceTicketActions";
import { getCustomers } from "@/features/customers/actions/customerActions";
import { getEmployees } from "@/features/employees/actions/employeeActions";

const DONE = new Set(["Completed", "Closed", "Cancelled"]);
const STUCK_DAYS = 7;

function daysBetween(from: string | Date, to = new Date()): number {
  const d = typeof from === "string" ? new Date(from) : from;
  if (Number.isNaN(d.getTime())) return 0;
  return Math.max(0, Math.floor((to.getTime() - d.getTime()) / (24 * 60 * 60 * 1000)));
}

function monthKey(dateStr: string) {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** e.g. "Jul 2026" — avoids "Jul 26" looking like a day */
function monthLabel(key: string) {
  const [y, m] = key.split("-");
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  });
}

function getApprovedQuoteTotal(o: any): number {
  const quotations = Array.isArray(o.quotations) ? o.quotations : o.quotations ? [o.quotations] : [];
  const approved = quotations.find((q: any) => q.status === "Approved");
  return approved?.grand_total ? Number(approved.grand_total) : 0;
}

function getCollected(o: any): number {
  const payments = Array.isArray(o.payments) ? o.payments : o.payments ? [o.payments] : [];
  return payments.reduce((sum: number, p: any) => {
    if (p.status && p.status !== "received") return sum;
    return sum + (Number(p.amount) || Number(p.calculated_amount) || 0);
  }, 0);
}

function getOrderRevenue(o: any): number {
  const quote = getApprovedQuoteTotal(o);
  if (quote > 0) return quote;
  return getCollected(o);
}

function shortStage(stage: string): string {
  const map: Record<string, string> = {
    "Site Visit Pending": "Site Visit",
    "Site Visit Scheduled": "SV Scheduled",
    "Site Visit Completed": "SV Done",
    "Quotation In Progress": "Quoting",
    "Quotation Sent": "Quote Sent",
    "Quotation Negotiation": "Negotiating",
    "Quotation Approved": "Quote OK",
    "Design In Progress": "Design",
    "Design Approved": "Design OK",
    Production: "Production",
    "Ready For Installation": "Ready Install",
    "Installation Scheduled": "Install Sched.",
    Completed: "Completed",
    Closed: "Closed",
    Cancelled: "Cancelled",
  };
  return map[stage] || stage;
}

export async function getReportData(startDate?: string, endDate?: string) {
  let [orders, enquiries, tickets, customers, employees] = await Promise.all([
    getOrders(),
    getEnquiries(),
    getServiceTickets(),
    getCustomers(),
    getEmployees(),
  ]);

  if (startDate) {
    orders = orders?.filter((o) => o.date_created && new Date(o.date_created).toISOString().split("T")[0] >= startDate);
    enquiries = enquiries?.filter((e) => e.date_received && new Date(e.date_received).toISOString().split("T")[0] >= startDate);
    tickets = tickets?.filter((t) => t.created_at && new Date(t.created_at).toISOString().split("T")[0] >= startDate);
  }
  if (endDate) {
    orders = orders?.filter((o) => o.date_created && new Date(o.date_created).toISOString().split("T")[0] <= endDate);
    enquiries = enquiries?.filter((e) => e.date_received && new Date(e.date_received).toISOString().split("T")[0] <= endDate);
    tickets = tickets?.filter((t) => t.created_at && new Date(t.created_at).toISOString().split("T")[0] <= endDate);
  }

  const list = orders || [];
  const activeOrders = list.filter((o: any) => !DONE.has(o.stage || ""));
  const now = new Date();

  // ── Cash: collected vs outstanding (approved quotes) ─────────────────────
  let cashCollected = 0;
  let cashOutstanding = 0;
  list.forEach((o: any) => {
    const quote = getApprovedQuoteTotal(o);
    const collected = getCollected(o);
    cashCollected += collected;
    if (quote > 0) cashOutstanding += Math.max(0, quote - collected);
    else if (!DONE.has(o.stage || "")) cashOutstanding += 0;
  });
  const cashPosition = [
    { label: "Collected", amount: Math.round(cashCollected) },
    { label: "Outstanding", amount: Math.round(cashOutstanding) },
  ];

  // ── Pipeline bottleneck: active orders by stage + avg age ────────────────
  const bottleneckMap: Record<string, { count: number; totalDays: number }> = {};
  activeOrders.forEach((o: any) => {
    const stage = o.stage || "Unknown";
    if (!bottleneckMap[stage]) bottleneckMap[stage] = { count: 0, totalDays: 0 };
    bottleneckMap[stage].count += 1;
    bottleneckMap[stage].totalDays += daysBetween(o.date_created || now, now);
  });
  const pipelineBottleneck = Object.entries(bottleneckMap)
    .map(([stage, d]) => ({
      stage: shortStage(stage),
      fullStage: stage,
      count: d.count,
      avgAgeDays: d.count > 0 ? Math.round(d.totalDays / d.count) : 0,
    }))
    .sort((a, b) => b.count - a.count || b.avgAgeDays - a.avgAgeDays);

  // ── Aging risk buckets (active only) ─────────────────────────────────────
  const agingBuckets = [
    { bucket: "0–3 days", min: 0, max: 3, count: 0 },
    { bucket: "4–7 days", min: 4, max: 7, count: 0 },
    { bucket: "8–14 days", min: 8, max: 14, count: 0 },
    { bucket: "15–30 days", min: 15, max: 30, count: 0 },
    { bucket: "30+ days", min: 31, max: 99999, count: 0 },
  ];
  activeOrders.forEach((o: any) => {
    const age = daysBetween(o.date_created || now, now);
    const b = agingBuckets.find((x) => age >= x.min && age <= x.max);
    if (b) b.count += 1;
  });
  const orderAging = agingBuckets.map(({ bucket, count }) => ({ bucket, count }));

  const stuckOrders = activeOrders.filter((o: any) => daysBetween(o.date_created || now, now) >= STUCK_DAYS).length;

  // ── Lead source conversion (decision: where to spend marketing) ──────────
  const sourceStats: Record<string, { enquiries: number; converted: number }> = {};
  (enquiries || []).forEach((e: any) => {
    const source = e.source || "Unknown";
    if (!sourceStats[source]) sourceStats[source] = { enquiries: 0, converted: 0 };
    sourceStats[source].enquiries += 1;
    if (e.status === "Converted" || e.orderId || e.order_id) sourceStats[source].converted += 1;
  });
  const sourceConversion = Object.entries(sourceStats)
    .map(([source, d]) => ({
      source,
      enquiries: d.enquiries,
      converted: d.converted,
      rate: d.enquiries > 0 ? Math.round((d.converted / d.enquiries) * 100) : 0,
    }))
    .sort((a, b) => b.rate - a.rate || b.enquiries - a.enquiries);

  // ── Team workload: open vs done ──────────────────────────────────────────
  const teamMap: Record<string, { open: number; done: number }> = {};
  list.forEach((o: any) => {
    const empIds: string[] = o.assigned_employees || o.assignedEmployees || [];
    empIds.forEach((empId: string) => {
      if (!teamMap[empId]) teamMap[empId] = { open: 0, done: 0 };
      if (DONE.has(o.stage || "")) teamMap[empId].done += 1;
      else teamMap[empId].open += 1;
    });
  });
  const teamWorkload = Object.entries(teamMap)
    .map(([empId, d]) => {
      const emp = employees?.find((e: any) => e.id === empId);
      return {
        employee: emp?.name || empId.slice(0, 8),
        open: d.open,
        done: d.done,
        total: d.open + d.done,
      };
    })
    .sort((a, b) => b.open - a.open)
    .slice(0, 10);

  // ── Collection trend (monthly cash received) ─────────────────────────────
  const collectionMap: Record<string, number> = {};
  list.forEach((o: any) => {
    const payments = Array.isArray(o.payments) ? o.payments : o.payments ? [o.payments] : [];
    payments.forEach((p: any) => {
      if (p.status && p.status !== "received") return;
      const when = p.paid_at || p.updated_at || p.created_at || o.date_created;
      if (!when) return;
      const key = monthKey(when);
      collectionMap[key] = (collectionMap[key] || 0) + (Number(p.amount) || Number(p.calculated_amount) || 0);
    });
  });
  const collectionTrend = Object.entries(collectionMap)
    .map(([key, amount]) => ({ month: monthLabel(key), monthKey: key, collected: Math.round(amount) }))
    .sort((a, b) => a.monthKey.localeCompare(b.monthKey))
    .slice(-12);

  // ── Funnel with drop-off ─────────────────────────────────────────────────
  const totalEnquiries = enquiries?.length || 0;
  const totalOrders = list.length;
  const totalCompleted = list.filter((o: any) => o.stage === "Completed" || o.stage === "Closed").length;
  const inInstall = list.filter((o: any) =>
    ["Installation Scheduled", "Ready For Installation"].includes(o.stage)
  ).length;
  const conversionFunnel = [
    { stage: "Enquiries", count: totalEnquiries },
    { stage: "Orders", count: totalOrders },
    { stage: "Install", count: inInstall + totalCompleted },
    { stage: "Completed", count: totalCompleted },
  ];

  // ── Customers: revenue + outstanding (who to chase) ──────────────────────
  const customerMoney: Record<string, { revenue: number; outstanding: number }> = {};
  list.forEach((o: any) => {
    if (!o.customer_id) return;
    if (!customerMoney[o.customer_id]) customerMoney[o.customer_id] = { revenue: 0, outstanding: 0 };
    const quote = getApprovedQuoteTotal(o);
    const collected = getCollected(o);
    customerMoney[o.customer_id].revenue += getOrderRevenue(o);
    if (quote > 0) customerMoney[o.customer_id].outstanding += Math.max(0, quote - collected);
  });
  const topCustomersByRevenue = Object.entries(customerMoney)
    .map(([customerId, d]) => {
      const customer = customers?.find((c: any) => c.id === customerId);
      return {
        customer: customer?.name || customer?.business_name || customerId.slice(0, 8),
        revenue: Math.round(d.revenue),
        outstanding: Math.round(d.outstanding),
      };
    })
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  const customersToChase = Object.entries(customerMoney)
    .map(([customerId, d]) => {
      const customer = customers?.find((c: any) => c.id === customerId);
      return {
        customer: customer?.name || customer?.business_name || customerId.slice(0, 8),
        outstanding: Math.round(d.outstanding),
      };
    })
    .filter((c) => c.outstanding > 0)
    .sort((a, b) => b.outstanding - a.outstanding)
    .slice(0, 10);

  // ── Open tickets by priority (action queue) ──────────────────────────────
  const openTicketPriority: Record<string, number> = {};
  let highPriorityOpen = 0;
  (tickets || []).forEach((t: any) => {
    const status = (t.status || "Open").toLowerCase();
    if (status === "resolved" || status === "closed" || status === "completed") return;
    const priority = t.priority || "Normal";
    openTicketPriority[priority] = (openTicketPriority[priority] || 0) + 1;
    if (/high|urgent|critical/i.test(priority)) highPriorityOpen += 1;
  });
  const openTicketsByPriority = Object.entries(openTicketPriority).map(([priority, count]) => ({
    priority,
    count,
  }));

  // ── Monthly conversion (enquiry → order) ─────────────────────────────────
  const enquiriesByMonth: Record<string, number> = {};
  (enquiries || []).forEach((e: any) => {
    const d = e.date_received || e.date_created;
    if (!d) return;
    const key = monthKey(d);
    enquiriesByMonth[key] = (enquiriesByMonth[key] || 0) + 1;
  });
  const ordersByMonthMap: Record<string, number> = {};
  list.forEach((o: any) => {
    if (!o.date_created) return;
    const key = monthKey(o.date_created);
    ordersByMonthMap[key] = (ordersByMonthMap[key] || 0) + 1;
  });
  const allMonthKeys = Array.from(
    new Set([...Object.keys(enquiriesByMonth), ...Object.keys(ordersByMonthMap)])
  ).sort();
  const conversionByMonth = allMonthKeys.slice(-12).map((key) => {
    const enq = enquiriesByMonth[key] || 0;
    const ord = ordersByMonthMap[key] || 0;
    return {
      month: monthLabel(key),
      monthKey: key,
      enquiries: enq,
      orders: ord,
      rate: enq > 0 ? Math.round((ord / enq) * 100) : 0,
    };
  });

  const totalRevenue = list.reduce((sum: number, o: any) => sum + getOrderRevenue(o), 0);
  const conversionRate = totalEnquiries > 0 ? Math.round((totalOrders / totalEnquiries) * 100) : 0;
  const openTickets = (tickets || []).filter((t: any) => {
    const s = (t.status || "Open").toLowerCase();
    return s !== "resolved" && s !== "closed" && s !== "completed";
  }).length;

  const avgAgeActive =
    activeOrders.length > 0
      ? Math.round(
          activeOrders.reduce((s: number, o: any) => s + daysBetween(o.date_created || now, now), 0) /
            activeOrders.length
        )
      : 0;

  return {
    kpis: {
      outstanding: Math.round(cashOutstanding),
      collected: Math.round(cashCollected),
      stuckOrders,
      conversionRate,
      activeOrders: activeOrders.length,
      avgAgeDays: avgAgeActive,
      highPriorityTickets: highPriorityOpen,
      openTickets,
      totalRevenue: Math.round(totalRevenue),
      totalOrders,
    },
    pipelineBottleneck,
    orderAging,
    cashPosition,
    sourceConversion,
    teamWorkload,
    collectionTrend,
    conversionFunnel,
    topCustomersByRevenue,
    customersToChase,
    openTicketsByPriority,
    conversionByMonth,
  };
}
