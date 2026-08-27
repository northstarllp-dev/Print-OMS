import type { ReportType } from "../components/ReportCard";

export type ReportRegistryEntry = {
  id: ReportType;
  title: string;
  desc: string;
  dataKey: string;
};

/** Shared catalog for dashboard cards + AI Report Builder */
export const REPORT_REGISTRY: Record<ReportType, ReportRegistryEntry> = {
  PIPELINE_BOTTLENECK: {
    id: "PIPELINE_BOTTLENECK",
    title: "Pipeline Bottlenecks",
    desc: "Where active orders are stuck bar = count, label = avg days open",
    dataKey: "pipelineBottleneck",
  },
  ORDER_AGING: {
    id: "ORDER_AGING",
    title: "Order Aging Risk",
    desc: "Active orders by how long they have been open chase 8+ day jobs first",
    dataKey: "orderAging",
  },
  CASH_POSITION: {
    id: "CASH_POSITION",
    title: "Cash Position",
    desc: "Collected vs outstanding against approved quotations",
    dataKey: "cashPosition",
  },
  SOURCE_CONVERSION: {
    id: "SOURCE_CONVERSION",
    title: "Lead Source Conversion",
    desc: "Which enquiry sources actually convert to orders double down here",
    dataKey: "sourceConversion",
  },
  TEAM_WORKLOAD: {
    id: "TEAM_WORKLOAD",
    title: "Team Workload",
    desc: "Open work vs completed per assignee spot overload",
    dataKey: "teamWorkload",
  },
  COLLECTION_TREND: {
    id: "COLLECTION_TREND",
    title: "Cash Collection Trend",
    desc: "Money actually received per month",
    dataKey: "collectionTrend",
  },
  CONVERSION_FUNNEL: {
    id: "CONVERSION_FUNNEL",
    title: "Pipeline Funnel",
    desc: "Enquiry → Order → Install → Completed drop-off",
    dataKey: "conversionFunnel",
  },
  TOP_CUSTOMERS: {
    id: "TOP_CUSTOMERS",
    title: "Top Customers by Revenue",
    desc: "Highest value accounts protect and upsell",
    dataKey: "topCustomersByRevenue",
  },
  CUSTOMERS_TO_CHASE: {
    id: "CUSTOMERS_TO_CHASE",
    title: "Customers to Chase",
    desc: "Largest outstanding balances call these first",
    dataKey: "customersToChase",
  },
  OPEN_TICKETS: {
    id: "OPEN_TICKETS",
    title: "Open Tickets by Priority",
    desc: "Unresolved service tickets needing action",
    dataKey: "openTicketsByPriority",
  },
  CONVERSION_BY_MONTH: {
    id: "CONVERSION_BY_MONTH",
    title: "Monthly Conversion",
    desc: "Enquiries vs orders and conversion rate over time",
    dataKey: "conversionByMonth",
  },
};

export const REPORT_IDS = Object.keys(REPORT_REGISTRY) as ReportType[];

export const QUICK_SUGGESTIONS = [
  "Where are orders stuck?",
  "Show cash outstanding",
  "Which lead sources convert?",
  "Customers to chase for payment",
  "Team workload",
  "Order aging risk",
];
