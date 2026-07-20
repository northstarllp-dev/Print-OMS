import type { ReportType } from "../components/ReportCard";

export type ReportRegistryEntry = {
  id: ReportType;
  title: string;
  desc: string;
  dataKey: string;
};

/** Shared catalog for dashboard cards + AI Report Builder */
export const REPORT_REGISTRY: Record<ReportType, ReportRegistryEntry> = {
  REVENUE_TREND: {
    id: "REVENUE_TREND",
    title: "Revenue & Order Trend",
    desc: "Monthly revenue bars + order count line",
    dataKey: "revenueTrend",
  },
  ORDERS_OVER_TIME: {
    id: "ORDERS_OVER_TIME",
    title: "Orders Over Time",
    desc: "Monthly order volume and estimated revenue",
    dataKey: "ordersByMonth",
  },
  PIPELINE_FUNNEL: {
    id: "PIPELINE_FUNNEL",
    title: "Pipeline Funnel",
    desc: "Enquiry → Order → Installation → Completed",
    dataKey: "conversionFunnel",
  },
  REVENUE_BY_CUSTOMER: {
    id: "REVENUE_BY_CUSTOMER",
    title: "Top 10 Customers",
    desc: "Highest revenue generating customers",
    dataKey: "revenueByCustomer",
  },
  TEAM_PERFORMANCE: {
    id: "TEAM_PERFORMANCE",
    title: "Team Performance",
    desc: "Assigned vs completed orders per employee",
    dataKey: "teamPerformance",
  },
  ORDER_STAGE: {
    id: "ORDER_STAGE",
    title: "Order Stage Breakdown",
    desc: "Distribution of orders by pipeline stage",
    dataKey: "ordersByStage",
  },
  TICKET_ANALYSIS: {
    id: "TICKET_ANALYSIS",
    title: "Tickets by Priority",
    desc: "Support ticket distribution by priority",
    dataKey: "ticketsByPriority",
  },
  ENQUIRY_SOURCES: {
    id: "ENQUIRY_SOURCES",
    title: "Enquiry Sources",
    desc: "Where your leads are coming from",
    dataKey: "enquirySourceBreakdown",
  },
  ORDER_HEALTH: {
    id: "ORDER_HEALTH",
    title: "Order Health",
    desc: "Active, on-hold, lost & completed breakdown",
    dataKey: "orderHealthBreakdown",
  },
  CONVERSION_BY_MONTH: {
    id: "CONVERSION_BY_MONTH",
    title: "Monthly Conversion Trend",
    desc: "Enquiries vs orders with conversion rate",
    dataKey: "conversionByMonth",
  },
  CUSTOMER_RETENTION: {
    id: "CUSTOMER_RETENTION",
    title: "Customer Retention",
    desc: "New vs returning customers per month",
    dataKey: "customerRetention",
  },
  WEEKLY_COMPLETIONS: {
    id: "WEEKLY_COMPLETIONS",
    title: "Weekly Completions",
    desc: "Orders completed per week (last 12 weeks)",
    dataKey: "weeklyCompletions",
  },
  TICKET_STATUS: {
    id: "TICKET_STATUS",
    title: "Ticket Status Mix",
    desc: "Open, in-progress, and resolved breakdown",
    dataKey: "ticketStatusBreakdown",
  },
};

export const REPORT_IDS = Object.keys(REPORT_REGISTRY) as ReportType[];

export const QUICK_SUGGESTIONS = [
  "Show revenue trend",
  "Top customers by revenue",
  "Team performance",
  "Pipeline funnel",
  "Customer retention",
  "Ticket analysis",
];
