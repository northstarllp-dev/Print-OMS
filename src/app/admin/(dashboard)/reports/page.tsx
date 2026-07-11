import React from "react";
import { getReportData } from "@/features/reports/actions/reportActions";
import { ReportsPageClient } from "@/features/reports/components/ReportsPageClient";

export const metadata = {
  title: "Reports | Admin",
  description: "Automated insights and AI-powered custom reports.",
};

export default async function ReportsPage({ searchParams }: { searchParams: { from?: string; to?: string } }) {
  const params = await searchParams; // Await in next 15 if applicable, or just use directly. Wait, next 15 requires awaiting searchParams, next 14 doesn't care if you await it (it's sync but allows await mostly? No, awaiting an object is fine).
  const from = params?.from;
  const to = params?.to;
  const reportData = await getReportData(from, to);

  return (
    <div className="flex-1 bg-slate-50 min-h-screen">
      <ReportsPageClient reportData={reportData} initialFrom={from} initialTo={to} />
    </div>
  );
}
