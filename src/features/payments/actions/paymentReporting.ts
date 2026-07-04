"use server";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { Payment } from "@/types";

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
          } catch {
            // ignore
          }
        },
      },
    }
  );
}

function amountOf(p: { calculated_amount?: number | null; amount?: number | null }): number {
  return Number(p.calculated_amount ?? p.amount ?? 0);
}

export interface PaymentTotals {
  totalPending: number;
  totalVerified: number;
  outstandingAmount: number;
  collectedAmount: number;
  countPending: number;
  countVerified: number;
  countWaived: number;
}

function summarize(payments: Payment[]): PaymentTotals {
  let totalPending = 0;
  let totalVerified = 0;
  let outstandingAmount = 0;
  let collectedAmount = 0;
  let countPending = 0;
  let countVerified = 0;
  let countWaived = 0;

  for (const p of payments) {
    const amt = amountOf(p);
    if (p.status === "verified") {
      totalVerified += amt;
      collectedAmount += amt;
      countVerified += 1;
    } else if (p.status === "waived") {
      countWaived += 1;
    } else {
      totalPending += amt;
      outstandingAmount += amt;
      countPending += 1;
    }
  }

  return {
    totalPending: Math.round(totalPending * 100) / 100,
    totalVerified: Math.round(totalVerified * 100) / 100,
    outstandingAmount: Math.round(outstandingAmount * 100) / 100,
    collectedAmount: Math.round(collectedAmount * 100) / 100,
    countPending,
    countVerified,
    countWaived,
  };
}

export async function getPaymentTotalsForOrder(orderId: string): Promise<PaymentTotals> {
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from("payments")
    .select("*")
    .eq("order_id", orderId);
  if (error) throw new Error(error.message);
  return summarize((data || []) as Payment[]);
}

export async function getPaymentTotalsForCustomer(customerId: string): Promise<PaymentTotals> {
  const supabase = await getSupabase();
  const { data: orders, error: ordersError } = await supabase
    .from("orders")
    .select("id")
    .eq("customer_id", customerId);
  if (ordersError) throw new Error(ordersError.message);
  const orderIds = (orders || []).map((o) => o.id);
  if (orderIds.length === 0) {
    return summarize([]);
  }
  const { data, error } = await supabase
    .from("payments")
    .select("*")
    .in("order_id", orderIds);
  if (error) throw new Error(error.message);
  return summarize((data || []) as Payment[]);
}

export async function getPaymentTotalsForMonth(
  year: number,
  month: number
): Promise<PaymentTotals> {
  const supabase = await getSupabase();
  const start = new Date(Date.UTC(year, month - 1, 1)).toISOString();
  const end = new Date(Date.UTC(year, month, 1)).toISOString();
  const { data, error } = await supabase
    .from("payments")
    .select("*")
    .gte("created_at", start)
    .lt("created_at", end);
  if (error) throw new Error(error.message);
  return summarize((data || []) as Payment[]);
}
