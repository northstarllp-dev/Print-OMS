"use server";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

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

/**
 * Lightweight sidebar badge counts — avoids loading full nested order/enquiry
 * graphs on every admin navigation.
 */
export async function getAdminSidebarCounts(): Promise<{
  orders: number;
  enquiries: number;
  customers: number;
  production: number;
  installation: number;
}> {
  const supabase = await getSupabase();

  const [ordersRes, enquiriesRes, customersRes] = await Promise.all([
    supabase.from("orders").select("stage"),
    supabase.from("enquiries").select("status"),
    supabase.from("customers").select("id", { count: "exact", head: true }),
  ]);

  const orders = ordersRes.data || [];
  const enquiries = enquiriesRes.data || [];

  const activeOrders = orders.filter(
    (o) => o.stage !== "Completed" && o.stage !== "Closed"
  ).length;
  const openEnquiries = enquiries.filter(
    (e) => e.status !== "Converted" && e.status !== "Closed"
  ).length;
  const productionCount = orders.filter((o) => o.stage === "Production").length;
  const installationCount = orders.filter(
    (o) =>
      o.stage === "Ready For Installation" ||
      o.stage === "Installation Scheduled"
  ).length;

  return {
    orders: activeOrders,
    enquiries: openEnquiries,
    customers: customersRes.count ?? 0,
    production: productionCount,
    installation: installationCount,
  };
}
