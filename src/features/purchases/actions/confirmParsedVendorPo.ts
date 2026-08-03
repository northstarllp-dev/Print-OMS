"use server";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/features/auth/actions/authActions";
import { applyStockMovement } from "@/features/inventory/stockCore";

export type ConfirmParsedPoLineInput = {
  description: string;
  sku?: string | null;
  quantity: number;
  unitCost: number;
  taxRate: number;
  /** Existing catalog product id, if matching */
  productId?: string | null;
  /** Create a new catalog product from this line */
  createNewProduct?: boolean;
};

export type ConfirmParsedVendorPoInput = {
  vendorId?: string | null;
  createNewVendor?: boolean;
  newVendorName?: string;
  notes?: string;
  warehouseId: string;
  receiveIntoStock: boolean;
  lines: ConfirmParsedPoLineInput[];
};

function nextProductCode(existing: string[]) {
  const maxNum = existing.reduce((max, id) => {
    const match = id?.match(/^PRD-(\d+)$/);
    if (match) return Math.max(max, parseInt(match[1], 10));
    return max;
  }, 0);
  return `PRD-${String(maxNum + 1).padStart(3, "0")}`;
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

/**
 * Confirm a parsed vendor PDF PO:
 * - create vendor if requested
 * - create unmatched products if requested
 * - create the PO
 * - optionally receive into warehouse (updates inventory stock)
 */
export async function confirmParsedVendorPoAction(input: ConfirmParsedVendorPoInput) {
  const profile = await getCurrentUser();
  if (!profile) throw new Error("Unauthorized");
  if (!profile.company_id) throw new Error("Company context missing");
  const supabase = await getSupabase();
  const companyId = profile.company_id;

  const included = (input.lines ?? []).filter((l) => l.quantity > 0);
  if (included.length === 0) throw new Error("Add at least one line with quantity");
  if (!input.warehouseId) throw new Error("Select a warehouse for stock");

  // ── Vendor ────────────────────────────────────────────────────────────────
  let vendorId = input.vendorId || null;
  if (input.createNewVendor) {
    const name = (input.newVendorName || "").trim();
    if (!name) throw new Error("Enter a name for the new vendor");
    const { data: vendor, error } = await supabase
      .from("vendors")
      .insert({
        company_id: companyId,
        name,
        notes: "Created from vendor PO PDF import",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    vendorId = vendor.id;
  }
  if (!vendorId) throw new Error("Select or create a vendor");

  // ── Products ──────────────────────────────────────────────────────────────
  const { data: existingProducts, error: prodErr } = await supabase
    .from("products")
    .select("id, product_id, purchase_price")
    .eq("company_id", companyId);
  if (prodErr) throw new Error(prodErr.message);

  const codes = (existingProducts ?? []).map((p) => p.product_id as string);
  const resolvedLines: {
    productId: string;
    qty: number;
    unitCost: number;
    taxRate: number;
  }[] = [];

  for (const line of included) {
    let productId = line.productId || null;

    if (line.createNewProduct || !productId) {
      if (!line.createNewProduct && !productId) {
        throw new Error(`Match or create a product for: ${line.description.slice(0, 80)}`);
      }
      if (line.createNewProduct) {
        const product_id = nextProductCode(codes);
        codes.push(product_id);
        const name = line.description.trim().slice(0, 180) || product_id;
        const { data: created, error } = await supabase
          .from("products")
          .insert({
            company_id: companyId,
            product_id,
            name,
            description: line.description.trim() || null,
            category: "Raw Materials",
            pricing_type: "per_unit",
            price_per_unit: line.unitCost || null,
            purchase_price: line.unitCost || null,
            gst_rate: line.taxRate || null,
            barcode: line.sku?.trim() || null,
            track_inventory: true,
            is_active: true,
            final_prdt: false,
            images: [],
            supplier_name: input.createNewVendor
              ? (input.newVendorName || null)
              : null,
          })
          .select("id")
          .single();
        if (error) throw new Error(error.message);
        productId = created.id;
      }
    } else if (productId && line.unitCost > 0) {
      // Refresh catalog purchase price from the vendor PO
      await supabase
        .from("products")
        .update({ purchase_price: line.unitCost })
        .eq("id", productId)
        .eq("company_id", companyId);
    }

    if (!productId) {
      throw new Error(`Could not resolve product for: ${line.description.slice(0, 80)}`);
    }

    resolvedLines.push({
      productId,
      qty: line.quantity,
      unitCost: line.unitCost,
      taxRate: line.taxRate || 0,
    });
  }

  // ── Purchase order ────────────────────────────────────────────────────────
  const subtotal = resolvedLines.reduce((sum, l) => sum + l.qty * l.unitCost, 0);
  const tax = resolvedLines.reduce(
    (sum, l) => sum + (l.qty * l.unitCost * l.taxRate) / 100,
    0
  );

  const { data: po, error: poError } = await supabase
    .from("purchase_orders")
    .insert({
      company_id: companyId,
      doc_type: "order",
      vendor_id: vendorId,
      notes: input.notes?.trim() || null,
      lines: resolvedLines.map((l) => ({
        id: crypto.randomUUID(),
        product_id: l.productId,
        qty_ordered: l.qty,
        qty_received: input.receiveIntoStock ? l.qty : 0,
        unit_cost: l.unitCost,
        tax_rate: l.taxRate,
      })),
      receipts: input.receiveIntoStock
        ? [
            {
              id: crypto.randomUUID(),
              warehouse_id: input.warehouseId,
              lines: resolvedLines.map((l) => ({
                product_id: l.productId,
                qty: l.qty,
                unit_cost: l.unitCost,
              })),
              notes: "Auto-received from vendor PO PDF import",
              received_by: profile.id,
              received_at: new Date().toISOString(),
            },
          ]
        : [],
      subtotal,
      tax,
      grand_total: subtotal + tax,
      status: input.receiveIntoStock ? "Received" : "Approved",
      payment_status: "Pending",
      created_by: profile.id,
    })
    .select("id, po_number, lines")
    .single();
  if (poError) throw new Error(poError.message);

  // ── Receive into inventory ────────────────────────────────────────────────
  if (input.receiveIntoStock) {
    for (const line of resolvedLines) {
      await applyStockMovement(supabase, {
        companyId,
        productId: line.productId,
        warehouseId: input.warehouseId,
        direction: "in",
        txnType: "purchase",
        quantity: line.qty,
        unitCost: line.unitCost,
        reference: po.po_number,
        notes: "Received from vendor PO PDF import",
        actorId: profile.id,
      });
    }
  }

  revalidatePath("/admin/purchase-orders");
  revalidatePath("/admin/inventory");
  revalidatePath("/admin/products");

  return {
    poId: po.id,
    poNumber: po.po_number,
    vendorId,
    received: input.receiveIntoStock,
  };
}
