"use server";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/features/auth/actions/authActions";
import { insertOrderActivity } from "@/features/orders/activity/logOrderActivity";
import { applyStockMovement } from "@/features/inventory/stockCore";
import type { StockTxnType } from "@/features/inventory/types";

export type UsageKind = "normal" | "wastage" | "damaged" | "returned" | "scrap";

export interface ConsumptionLineInput {
  productId: string;
  warehouseId: string;
  quantity: number;
  usageKind: UsageKind;
  unitCost?: number | null;
  notes?: string | null;
}

export interface OrderConsumptionRecord {
  id: string;
  order_id: string;
  product_id: string;
  warehouse_id: string;
  quantity: number;
  usage_kind: UsageKind;
  unit_cost: number;
  total_cost: number;
  notes: string | null;
  created_at: string;
  product_name?: string;
  product_code?: string;
  warehouse_name?: string;
}

async function getSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {}
        },
      },
    }
  );
}

async function requireProfile() {
  const profile = await getCurrentUser();
  if (!profile) throw new Error("Unauthorized");
  if (!profile.company_id) throw new Error("Company context missing");
  return profile;
}

/** Maps a material usage kind to the ledger transaction type. Returned goes back into stock. */
function usageToTxn(kind: UsageKind): { direction: "in" | "out"; txnType: StockTxnType } {
  switch (kind) {
    case "returned":
      return { direction: "in", txnType: "production_return" };
    case "damaged":
      return { direction: "out", txnType: "damage" };
    case "scrap":
      return { direction: "out", txnType: "scrap" };
    case "wastage":
    case "normal":
    default:
      return { direction: "out", txnType: "production_consumption" };
  }
}

function revalidateProductionPaths() {
  revalidatePath("/admin/inventory");
  revalidatePath("/admin/orders");
  revalidatePath("/production/orders");
  revalidatePath("/staff/orders");
}

export async function getOrderConsumptions(
  orderId: string
): Promise<OrderConsumptionRecord[]> {
  const profile = await requireProfile();
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from("stock_movements")
    .select(
      `
      id, order_id, product_id, warehouse_id, quantity, usage_kind, unit_cost, notes, created_at,
      product:product_id(name, product_id),
      warehouse:warehouse_id(name)
    `
    )
    .eq("company_id", profile.company_id)
    .eq("order_id", orderId)
    .not("usage_kind", "is", null)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row: any) => {
    const qty = Number(row.quantity);
    const unitCost = Number(row.unit_cost) || 0;
    const usageKind = (row.usage_kind || "normal") as UsageKind;
    return {
      id: row.id,
      order_id: row.order_id,
      product_id: row.product_id,
      warehouse_id: row.warehouse_id,
      quantity: qty,
      usage_kind: usageKind,
      unit_cost: unitCost,
      total_cost: usageKind === "returned" ? -unitCost * qty : unitCost * qty,
      notes: row.notes,
      created_at: row.created_at,
      product_name: row.product?.name ?? "",
      product_code: row.product?.product_id ?? "",
      warehouse_name: row.warehouse?.name ?? "",
    } as OrderConsumptionRecord;
  });
}

/**
 * Record material usage for an order's production run.
 * Deducts (or returns) stock, writes ledger entries with usage_kind,
 * refreshes orders.material_cost, and drops a timeline note.
 */
export async function consumeMaterialsAction(input: {
  orderId: string;
  lines: ConsumptionLineInput[];
}) {
  const profile = await requireProfile();
  const supabase = await getSupabase();

  const lines = (input.lines ?? []).filter((l) => l.productId && l.quantity > 0);
  if (lines.length === 0) throw new Error("Add at least one material line");

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id, order_id, company_id")
    .eq("company_id", profile.company_id)
    .eq("id", input.orderId)
    .single();
  if (orderError) throw new Error(orderError.message);

  const productIds = Array.from(new Set(lines.map((l) => l.productId)));
  const { data: products, error: productsError } = await supabase
    .from("products")
    .select("id, name, purchase_price")
    .eq("company_id", profile.company_id)
    .in("id", productIds);
  if (productsError) throw new Error(productsError.message);
  const productMap = new Map((products ?? []).map((p) => [p.id, p]));

  for (const line of lines) {
    const product = productMap.get(line.productId);
    if (!product) throw new Error("Product not found");
    const unitCost = Number(line.unitCost ?? product.purchase_price ?? 0);
    const { direction, txnType } = usageToTxn(line.usageKind);

    await applyStockMovement(supabase, {
      companyId: profile.company_id,
      productId: line.productId,
      warehouseId: line.warehouseId,
      direction,
      txnType,
      quantity: line.quantity,
      unitCost,
      reference: order.order_id,
      orderId: order.id,
      notes: line.notes ?? null,
      actorId: profile.id,
      usageKind: line.usageKind,
    });
  }

  const { data: allLines, error: sumError } = await supabase
    .from("stock_movements")
    .select("quantity, unit_cost, usage_kind")
    .eq("company_id", profile.company_id)
    .eq("order_id", order.id)
    .not("usage_kind", "is", null);
  if (sumError) throw new Error(sumError.message);
  const materialCost = (allLines ?? []).reduce((sum, r) => {
    const qty = Number(r.quantity) || 0;
    const unitCost = Number(r.unit_cost) || 0;
    const delta = r.usage_kind === "returned" ? -unitCost * qty : unitCost * qty;
    return sum + delta;
  }, 0);
  const { error: updateError } = await supabase
    .from("orders")
    .update({ material_cost: materialCost })
    .eq("id", order.id)
    .eq("company_id", profile.company_id);
  if (updateError) throw new Error(updateError.message);

  const summary = lines
    .map((l) => {
      const name = productMap.get(l.productId)?.name ?? "material";
      return `${name} × ${l.quantity}${l.usageKind !== "normal" ? ` (${l.usageKind})` : ""}`;
    })
    .join(", ");
  await insertOrderActivity(supabase, {
    order_id: order.order_id,
    company_id: order.company_id,
    actor_name: profile.name || "Staff",
    actor_role: profile.role === "admin" ? "Admin" : "Staff",
    actor_id: profile.id,
    content: `Materials consumed: ${summary}. Material cost now ₹${materialCost.toFixed(2)}.`,
    metadata: { action: "materials_consumed", order_uuid: order.id },
  });

  revalidateProductionPaths();
  return { materialCost };
}

/** Record finished goods (final products) produced by this order into stock. */
export async function recordFinalYieldAction(input: {
  orderId: string;
  productId: string;
  warehouseId: string;
  quantity: number;
  unitCost?: number | null;
  notes?: string | null;
}) {
  const profile = await requireProfile();
  const supabase = await getSupabase();

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id, order_id, company_id")
    .eq("company_id", profile.company_id)
    .eq("id", input.orderId)
    .single();
  if (orderError) throw new Error(orderError.message);

  const { data: product, error: productError } = await supabase
    .from("products")
    .select("id, name, final_prdt")
    .eq("company_id", profile.company_id)
    .eq("id", input.productId)
    .single();
  if (productError) throw new Error(productError.message);
  if (!product.final_prdt) {
    throw new Error("Final yield can only be recorded for Final Products");
  }

  const result = await applyStockMovement(supabase, {
    companyId: profile.company_id,
    productId: input.productId,
    warehouseId: input.warehouseId,
    direction: "in",
    txnType: "production_yield",
    quantity: input.quantity,
    unitCost: input.unitCost ?? null,
    reference: order.order_id,
    orderId: order.id,
    notes: input.notes ?? null,
    actorId: profile.id,
  });

  await insertOrderActivity(supabase, {
    order_id: order.order_id,
    company_id: order.company_id,
    actor_name: profile.name || "Staff",
    actor_role: profile.role === "admin" ? "Admin" : "Staff",
    actor_id: profile.id,
    content: `Final yield recorded: ${product.name} × ${input.quantity} into stock.`,
    metadata: { action: "final_yield", order_uuid: order.id },
  });

  revalidateProductionPaths();
  return result;
}

/** Products + warehouses needed by the production materials panel. */
export async function getProductionMaterialContext() {
  const profile = await requireProfile();
  const supabase = await getSupabase();

  const [productsRes, warehousesRes, balancesRes] = await Promise.all([
    supabase
      .from("products")
      .select("id, product_id, name, unit, barcode, purchase_price, gst_rate, final_prdt, track_inventory")
      .eq("company_id", profile.company_id)
      .eq("is_active", true)
      .order("name", { ascending: true }),
    supabase
      .from("warehouses")
      .select("id, code, name, kind, is_active")
      .eq("company_id", profile.company_id)
      .eq("is_active", true)
      .order("created_at", { ascending: true }),
    supabase
      .from("stock_balances")
      .select("product_id, warehouse_id, quantity")
      .eq("company_id", profile.company_id),
  ]);
  if (productsRes.error) throw new Error(productsRes.error.message);
  if (warehousesRes.error) throw new Error(warehousesRes.error.message);
  if (balancesRes.error) throw new Error(balancesRes.error.message);

  return {
    products: productsRes.data ?? [],
    warehouses: warehousesRes.data ?? [],
    balances: (balancesRes.data ?? []).map((b) => ({
      product_id: b.product_id,
      warehouse_id: b.warehouse_id,
      quantity: Number(b.quantity),
    })),
  };
}
