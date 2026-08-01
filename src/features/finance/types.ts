export type InvoiceType =
  | "GST Invoice"
  | "Tax Invoice"
  | "Actual Invoice"
  | "Proforma Invoice"
  | "Credit Note"
  | "Debit Note";

export type ReceiptMode = "Cash" | "UPI" | "Bank" | "Cheque" | "Online";

export type OutgoingPaymentCategory =
  | "Supplier"
  | "PO"
  | "Contractor"
  | "Freelancer"
  | "Salary"
  | "Rent"
  | "Electricity"
  | "Misc";

export type OutgoingPaymentStatus = "Pending" | "Approved" | "Paid";

export type ExpenseCategory =
  | "Office"
  | "Travel"
  | "Fuel"
  | "Marketing"
  | "Maintenance"
  | "Repairs"
  | "Subscriptions"
  | "Miscellaneous";

export type OtherIncomeCategory =
  | "Interest"
  | "Asset Sale"
  | "Commission"
  | "Consultancy"
  | "Misc";

export interface FinanceReceiptRecord {
  id: string;
  receipt_no: string;
  customer_id: string | null;
  order_id: string | null;
  invoice_id: string | null;
  amount: number;
  mode: ReceiptMode;
  received_at: string;
  notes: string | null;
  payment_name?: string;
  created_at: string;
  customer_name?: string;
  order_code?: string;
  invoice_code?: string;
  source_ref?: string | null;
}

export interface FinancePaymentRecord {
  id: string;
  category: OutgoingPaymentCategory;
  payee: string | null;
  vendor_id: string | null;
  po_id: string | null;
  amount: number;
  gst_amount: number;
  due_date: string | null;
  status: OutgoingPaymentStatus;
  paid_at: string | null;
  attachments: string[];
  notes: string | null;
  created_at: string;
  vendor_name?: string;
  po_number?: string;
}

export interface FinanceExpenseRecord {
  id: string;
  category: ExpenseCategory;
  expense_date: string;
  amount: number;
  gst_amount: number;
  attachment_url: string | null;
  notes: string | null;
  created_at: string;
}

export interface FinanceOtherIncomeRecord {
  id: string;
  category: OtherIncomeCategory;
  income_date: string;
  amount: number;
  notes: string | null;
  created_at: string;
}

export interface FinanceSummary {
  revenue: number;
  otherIncome: number;
  expenses: number;
  outgoingPaid: number;
  profit: number;
  receivables: number;
  payables: number;
  upcomingPayments: number;
  gstCollected: number;
  gstPaid: number;
  monthlySeries: { month: string; income: number; expense: number }[];
  expenseByCategory: { category: string; amount: number }[];
}

export const RECEIPT_MODES: ReceiptMode[] = ["Cash", "UPI", "Bank", "Cheque", "Online"];

export const OUTGOING_CATEGORIES: OutgoingPaymentCategory[] = [
  "Supplier",
  "PO",
  "Contractor",
  "Freelancer",
  "Salary",
  "Rent",
  "Electricity",
  "Misc",
];

export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  "Office",
  "Travel",
  "Fuel",
  "Marketing",
  "Maintenance",
  "Repairs",
  "Subscriptions",
  "Miscellaneous",
];

export const OTHER_INCOME_CATEGORIES: OtherIncomeCategory[] = [
  "Interest",
  "Asset Sale",
  "Commission",
  "Consultancy",
  "Misc",
];

export const INVOICE_TYPES: InvoiceType[] = [
  "GST Invoice",
  "Tax Invoice",
  "Actual Invoice",
  "Proforma Invoice",
  "Credit Note",
  "Debit Note",
];
