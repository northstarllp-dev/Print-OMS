"use server";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/features/auth/actions/authActions";
import { applyStockMovement } from "@/features/inventory/stockCore";
import type {
  InventoryStockRow,
  StockDirection,
  StockMovementRecord,
  StockTxnType,
  WarehouseKind,
  WarehouseRecord,
} from "@/features/inventory/types";

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

function revalidateInventoryPaths() {
  revalidatePath("/admin/inventory");
  revalidatePath("/admin/products");
}

// ── Warehouses ───────────────────────────────────────────────────────────────

export async function getWarehouses(): Promise<WarehouseRecord[]> {
  const profile = await requireProfile();
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from("warehouses")
    .select("*")
    .eq("company_id", profile.company_id)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as WarehouseRecord[];
}

export async function createWarehouseAction(input: {
  code: string;
  name: string;
  kind: WarehouseKind;
}): Promise<WarehouseRecord> {
  const profile = await requireProfile();
  if (profile.role !== "admin") throw new Error("Only admins can manage warehouses");
  const supabase = await getSupabase();

  const { data, error } = await supabase
    .from("warehouses")
    .insert({
      company_id: profile.company_id,
      code: input.code.trim().toUpperCase(),
      name: input.name.trim(),
      kind: input.kind,
    })
    .select("*")
    .single();
  if (error) {
    if (error.code === "23505") throw new Error("Warehouse code already exists.");
    throw new Error(error.message);
  }
  revalidateInventoryPaths();
  return data as WarehouseRecord;
}

export async function setWarehouseActiveAction(id: string, isActive: boolean) {
  const profile = await requireProfile();
  if (profile.role !== "admin") throw new Error("Only admins can manage warehouses");
  const supabase = await getSupabase();
  const { error } = await supabase
    .from("warehouses")
    .update({ is_active: isActive })
    .eq("id", id)
    .eq("company_id", profile.company_id);
  if (error) throw new Error(error.message);
  revalidateInventoryPaths();
}

// ── Stock overview ───────────────────────────────────────────────────────────

export async function getInventoryOverview(): Promise<InventoryStockRow[]> {
  const profile = await requireProfile();
  const supabase = await getSupabase();

  const [productsRes, balancesRes, warehousesRes] = await Promise.all([
    supabase
      .from("products")
      .select(
        "id, product_id, name, category, brand, supplier_name, unit, barcode, purchase_price, min_stock, max_stock, final_prdt, track_inventory, is_active"
      )
      .eq("company_id", profile.company_id)
      .order("name", { ascending: true }),
    supabase
      .from("stock_balances")
      .select("product_id, warehouse_id, quantity")
      .eq("company_id", profile.company_id),
    supabase
      .from("warehouses")
      .select("id, name")
      .eq("company_id", profile.company_id),
  ]);

  if (productsRes.error) throw new Error(productsRes.error.message);
  if (balancesRes.error) throw new Error(balancesRes.error.message);
  if (warehousesRes.error) throw new Error(warehousesRes.error.message);

  const warehouseNames = new Map(
    (warehousesRes.data ?? []).map((w) => [w.id, w.name])
  );
  const balancesByProduct = new Map<
    string,
    { warehouse_id: string; warehouse_name: string; quantity: number }[]
  >();
  for (const b of balancesRes.data ?? []) {
    const list = balancesByProduct.get(b.product_id) ?? [];
    list.push({
      warehouse_id: b.warehouse_id,
      warehouse_name: warehouseNames.get(b.warehouse_id) ?? "Unknown",
      quantity: Number(b.quantity),
    });
    balancesByProduct.set(b.product_id, list);
  }

  return (productsRes.data ?? []).map((p) => {
    const balances = balancesByProduct.get(p.id) ?? [];
    return {
      id: p.id,
      product_code: p.product_id ?? "",
      name: p.name,
      category: p.category ?? null,
      brand: p.brand ?? null,
      supplier_name: p.supplier_name ?? null,
      unit: p.unit ?? null,
      barcode: p.barcode ?? null,
      purchase_price: p.purchase_price != null ? Number(p.purchase_price) : null,
      min_stock: p.min_stock != null ? Number(p.min_stock) : null,
      max_stock: p.max_stock != null ? Number(p.max_stock) : null,
      final_prdt: p.final_prdt ?? false,
      track_inventory: p.track_inventory ?? true,
      is_active: p.is_active ?? true,
      total_quantity: balances.reduce((sum, b) => sum + b.quantity, 0),
      balances,
    };
  });
}

// ── Ledger ───────────────────────────────────────────────────────────────────

export async function getStockLedger(filters?: {
  productId?: string;
  warehouseId?: string;
  limit?: number;
}): Promise<StockMovementRecord[]> {
  const profile = await requireProfile();
  const supabase = await getSupabase();

  let query = supabase
    .from("stock_movements")
    .select(
      `
      *,
      product:product_id(name, product_id),
      warehouse:warehouse_id(name),
      actor:actor_id(name)
    `
    )
    .eq("company_id", profile.company_id)
    .order("created_at", { ascending: false })
    .limit(filters?.limit ?? 200);

  if (filters?.productId) query = query.eq("product_id", filters.productId);
  if (filters?.warehouseId) query = query.eq("warehouse_id", filters.warehouseId);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []).map((row: any) => ({
    ...row,
    quantity: Number(row.quantity),
    balance_after: row.balance_after != null ? Number(row.balance_after) : null,
    unit_cost: row.unit_cost != null ? Number(row.unit_cost) : null,
    product_name: row.product?.name ?? "",
    product_code: row.product?.product_id ?? "",
    warehouse_name: row.warehouse?.name ?? "",
    actor_name: row.actor?.name ?? "",
  })) as StockMovementRecord[];
}

// ── Movements ────────────────────────────────────────────────────────────────

export async function recordStockMovementAction(input: {
  productId: string;
  warehouseId: string;
  direction: StockDirection;
  txnType: StockTxnType;
  quantity: number;
  unitCost?: number | null;
  reference?: string | null;
  notes?: string | null;
}) {
  const profile = await requireProfile();
  const supabase = await getSupabase();

  const result = await applyStockMovement(supabase, {
    companyId: profile.company_id,
    productId: input.productId,
    warehouseId: input.warehouseId,
    direction: input.direction,
    txnType: input.txnType,
    quantity: input.quantity,
    unitCost: input.unitCost,
    reference: input.reference,
    notes: input.notes,
    actorId: profile.id,
  });

  revalidateInventoryPaths();
  return result;
}

export async function transferStockAction(input: {
  productId: string;
  fromWarehouseId: string;
  toWarehouseId: string;
  quantity: number;
  reference?: string | null;
  notes?: string | null;
}) {
  if (input.fromWarehouseId === input.toWarehouseId) {
    throw new Error("Source and destination warehouses must differ");
  }
  const profile = await requireProfile();
  const supabase = await getSupabase();

  await applyStockMovement(supabase, {
    companyId: profile.company_id,
    productId: input.productId,
    warehouseId: input.fromWarehouseId,
    direction: "out",
    txnType: "transfer_out",
    quantity: input.quantity,
    reference: input.reference,
    notes: input.notes,
    actorId: profile.id,
  });
  const result = await applyStockMovement(supabase, {
    companyId: profile.company_id,
    productId: input.productId,
    warehouseId: input.toWarehouseId,
    direction: "in",
    txnType: "transfer_in",
    quantity: input.quantity,
    reference: input.reference,
    notes: input.notes,
    actorId: profile.id,
  });

  revalidateInventoryPaths();
  return result;
}

export async function updateProductMinStockAction(
  productId: string,
  minStock: number | null
) {
  const profile = await requireProfile();
  if (profile.role !== "admin") throw new Error("Only admins can edit min stock");
  const supabase = await getSupabase();

  if (minStock != null && (!Number.isFinite(minStock) || minStock < 0)) {
    throw new Error("Min stock must be a non-negative number");
  }

  const { error } = await supabase
    .from("products")
    .update({ min_stock: minStock })
    .eq("id", productId)
    .eq("company_id", profile.company_id);
  if (error) throw new Error(error.message);

  revalidateInventoryPaths();
  return { min_stock: minStock };
}

// ── Barcode lookup ───────────────────────────────────────────────────────────

export async function findProductByBarcodeAction(code: string) {
  const trimmed = code.trim();
  if (!trimmed) return null;
  const profile = await requireProfile();
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from("products")
    .select("id, product_id, name, barcode, unit")
    .eq("company_id", profile.company_id)
    .or(`barcode.eq.${trimmed},product_id.eq.${trimmed}`)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}
