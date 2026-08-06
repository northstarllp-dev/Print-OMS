import { Wallet } from "lucide-react";
import { ComingSoonPage } from "@/features/admin/components/ComingSoonPage";
import { getCurrentUser } from "@/features/auth/actions/authActions";
import {
  getFinanceExpenses,
  getFinanceFormOptions,
  getFinanceOtherIncome,
  getFinancePayments,
  getFinanceReceipts,
  getFinanceSummary,
} from "@/features/finance/actions/financeActions";
import { FinanceDashboard } from "@/features/finance/components/FinanceDashboard";
import type { FinanceSummary } from "@/features/finance/types";

export const metadata = {
  title: "Finance | Admin",
};

const EMPTY_SUMMARY: FinanceSummary = {
  revenue: 0,
  otherIncome: 0,
  expenses: 0,
  outgoingPaid: 0,
  profit: 0,
  receivables: 0,
  payables: 0,
  upcomingPayments: 0,
  gstCollected: 0,
  gstPaid: 0,
  monthlySeries: [],
  expenseByCategory: [],
};

export default async function AdminFinancePage() {
  const profile = await getCurrentUser();
  const [summary, receipts, payments, expenses, otherIncome, rawOptions] =
    await Promise.all([
      getFinanceSummary().catch(() => EMPTY_SUMMARY),
      getFinanceReceipts().catch(() => []),
      getFinancePayments().catch(() => []),
      getFinanceExpenses().catch(() => []),
      getFinanceOtherIncome().catch(() => []),
      getFinanceFormOptions().catch(() => ({
        customers: [] as any[],
        orders: [] as any[],
        invoices: [] as any[],
        vendors: [] as any[],
        purchaseOrders: [] as any[],
      })),
    ]);

  const options = {
    customers: (rawOptions.customers ?? []).map((c: any) => ({
      id: c.id,
      label: c.label ?? c.name ?? c.id,
    })),
    orders: (rawOptions.orders ?? []).map((o: any) => ({
      id: o.id,
      label: o.label ?? `${o.order_id || o.id}${o.business_name ? ` · ${o.business_name}` : ""}`,
    })),
    invoices: (rawOptions.invoices ?? []).map((i: any) => ({
      id: i.id,
      label: i.label ?? i.invoice_id ?? i.id,
    })),
    vendors: (rawOptions.vendors ?? []).map((v: any) => ({
      id: v.id,
      label: v.label ?? v.name ?? v.id,
    })),
    purchaseOrders: (rawOptions.purchaseOrders ?? []).map((p: any) => ({
      id: p.id,
      label: p.label ?? p.po_number ?? p.id,
    })),
  };

  return (
    <ComingSoonPage
      title="Finance"
      description="This section is under development and is not available for use yet. Receipts, payments, expenses, and reports will open here once the module is ready."
      icon={Wallet}
    >
      <FinanceDashboard
        summary={summary}
        receipts={receipts}
        payments={payments}
        expenses={expenses}
        otherIncome={otherIncome}
        options={options}
        isAdmin={profile?.role === "admin"}
      />
    </ComingSoonPage>
  );
}
