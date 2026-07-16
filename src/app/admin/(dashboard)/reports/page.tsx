import React from "react";
import { getReportData } from "@/features/reports/actions/reportActions";
import { ReportsPageClient } from "@/features/reports/components/ReportsPageClient";

export const metadata = {
  title: "Reports | Admin",
  description: "Automated insights and AI-powered custom reports.",
};

export default async function ReportsPage(props: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const searchParams = await props.searchParams;
  const from = searchParams?.from;
  const to = searchParams?.to;
  const reportData = await getReportData(from, to);

  return (
    <div className="flex-1 bg-slate-50 min-h-screen">
      <ReportsPageClient reportData={reportData} initialFrom={from} initialTo={to} />
    </div>
  );
}
