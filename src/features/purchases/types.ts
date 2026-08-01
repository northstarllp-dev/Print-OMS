export type PurchaseOrderStatus =
  | "Draft"
  | "Sent"
  | "Approved"
  | "Partially Received"
  | "Received"
  | "Cancelled"
  | "Closed";

export type PoPaymentStatus = "Pending" | "Partially Paid" | "Paid";

export type PurchaseRequestStatus = "Pending" | "Approved" | "Rejected" | "Converted";

export interface VendorRecord {
  id: string;
  company_id?: string;
  name: string;
  gstin: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  rating: number | null;
  notes: string | null;
  is_active: boolean;
  created_at?: string;
  // derived
  po_count?: number;
  outstanding_total?: number;
}

export interface PurchaseRequestLine {
  product_id: string;
  product_name?: string;
  quantity: number;
}

export interface PurchaseRequestRecord {
  id: string;
  status: PurchaseRequestStatus;
  lines: PurchaseRequestLine[];
  notes: string | null;
  requested_by: string | null;
  approved_by: string | null;
  created_at: string;
  requester_name?: string;
  approver_name?: string;
}

export interface PurchaseOrderLine {
  id: string;
  product_id: string;
  qty_ordered: number;
  qty_received: number;
  unit_cost: number;
  tax_rate: number;
  product_name?: string;
  product_code?: string;
  unit?: string | null;
}

/** @deprecated Use PurchaseOrderLine */
export type PurchaseOrderLineRecord = PurchaseOrderLine & { po_id?: string };

export interface PurchaseOrderRecord {
  id: string;
  po_number: string;
  vendor_id: string;
  request_id: string | null;
  doc_type?: "order" | "request";
  status: PurchaseOrderStatus;
  payment_status: PoPaymentStatus;
  order_date: string;
  expected_date: string | null;
  subtotal: number;
  tax: number;
  grand_total: number;
  notes: string | null;
  attachments: string[];
  receipts?: unknown[];
  created_at: string;
  vendor_name?: string;
  lines?: PurchaseOrderLine[];
}

export const PO_STATUSES: PurchaseOrderStatus[] = [
  "Draft",
  "Sent",
  "Approved",
  "Partially Received",
  "Received",
  "Cancelled",
  "Closed",
];
