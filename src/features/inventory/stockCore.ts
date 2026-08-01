import type { SupabaseClient } from "@supabase/supabase-js";
import type { StockDirection, StockTxnType } from "./types";

export interface ApplyStockMovementInput {
  companyId: string;
  productId: string;
  warehouseId: string;
  direction: StockDirection;
  txnType: StockTxnType;
  quantity: number;
  unitCost?: number | null;
  reference?: string | null;
  orderId?: string | null;
  notes?: string | null;
  actorId?: string | null;
  usageKind?: string | null;
  /** When false, outgoing movements may drive the balance negative. */
  enforceStock?: boolean;
}

/**
 * Insert an immutable stock movement and update the matching stock balance.
 * Shared by inventory receive/issue/transfer, production consume/yield, and PO receive.
 */
export async function applyStockMovement(
  supabase: SupabaseClient,
  input: ApplyStockMovementInput
): Promise<{ balanceAfter: number }> {
  const qty = Number(input.quantity);
  if (!Number.isFinite(qty) || qty <= 0) {
    throw new Error("Quantity must be a positive number");
  }

  const { data: balanceRow, error: balanceError } = await supabase
    .from("stock_balances")
    .select("id, quantity")
    .eq("company_id", input.companyId)
    .eq("product_id", input.productId)
    .eq("warehouse_id", input.warehouseId)
    .maybeSingle();
  if (balanceError) throw new Error(balanceError.message);

  const current = Number(balanceRow?.quantity ?? 0);
  const delta = input.direction === "in" ? qty : -qty;
  const next = current + delta;

  if (input.direction === "out" && (input.enforceStock ?? true) && next < 0) {
    throw new Error(
      `Insufficient stock: available ${current}, requested ${qty}`
    );
  }

  if (balanceRow) {
    const { error } = await supabase
      .from("stock_balances")
      .update({ quantity: next })
      .eq("id", balanceRow.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from("stock_balances").insert({
      company_id: input.companyId,
      product_id: input.productId,
      warehouse_id: input.warehouseId,
      quantity: next,
    });
    if (error) throw new Error(error.message);
  }

  const { error: movementError } = await supabase.from("stock_movements").insert({
    company_id: input.companyId,
    product_id: input.productId,
    warehouse_id: input.warehouseId,
    direction: input.direction,
    txn_type: input.txnType,
    quantity: qty,
    balance_after: next,
    unit_cost: input.unitCost ?? null,
    reference: input.reference ?? null,
    order_id: input.orderId ?? null,
    notes: input.notes ?? null,
    actor_id: input.actorId ?? null,
    usage_kind: input.usageKind ?? null,
  });
  if (movementError) throw new Error(movementError.message);

  return { balanceAfter: next };
}
