export type WarehouseKind = "main" | "production_floor" | "vehicle" | "branch";

export interface WarehouseRecord {
  id: string;
  company_id?: string;
  code: string;
  name: string;
  kind: WarehouseKind;
  is_active: boolean;
  created_at?: string;
}

export type StockDirection = "in" | "out";

export type StockTxnType =
  | "purchase"
  | "customer_return"
  | "adjustment"
  | "transfer_in"
  | "transfer_out"
  | "production_return"
  | "production_yield"
  | "production_consumption"
  | "damage"
  | "scrap"
  | "sample_usage";

export interface StockMovementRecord {
  id: string;
  company_id?: string;
  product_id: string;
  warehouse_id: string;
  direction: StockDirection;
  txn_type: StockTxnType;
  quantity: number;
  balance_after: number | null;
  unit_cost: number | null;
  reference: string | null;
  order_id: string | null;
  notes: string | null;
  actor_id: string | null;
  created_at: string;
  // joined
  product_name?: string;
  product_code?: string;
  warehouse_name?: string;
  actor_name?: string;
}

export interface StockBalanceEntry {
  warehouse_id: string;
  warehouse_name: string;
  quantity: number;
}

export interface InventoryStockRow {
  id: string; // product uuid
  product_code: string;
  name: string;
  category: string | null;
  brand: string | null;
  supplier_name: string | null;
  unit: string | null;
  barcode: string | null;
  purchase_price: number | null;
  min_stock: number | null;
  max_stock: number | null;
  final_prdt: boolean;
  track_inventory: boolean;
  is_active: boolean;
  total_quantity: number;
  balances: StockBalanceEntry[];
}

export const IN_TXN_TYPES: StockTxnType[] = [
  "purchase",
  "customer_return",
  "adjustment",
  "production_return",
  "production_yield",
];

export const OUT_TXN_TYPES: StockTxnType[] = [
  "production_consumption",
  "damage",
  "scrap",
  "sample_usage",
  "adjustment",
];

export const TXN_TYPE_LABELS: Record<StockTxnType, string> = {
  purchase: "Purchase",
  customer_return: "Customer Return",
  adjustment: "Manual Adjustment",
  transfer_in: "Transfer In",
  transfer_out: "Transfer Out",
  production_return: "Production Return",
  production_yield: "Production Yield",
  production_consumption: "Production Consumption",
  damage: "Damage",
  scrap: "Scrap",
  sample_usage: "Sample Usage",
};

export const WAREHOUSE_KIND_LABELS: Record<WarehouseKind, string> = {
  main: "Main",
  production_floor: "Production Floor",
  vehicle: "Vehicle",
  branch: "Branch",
};
