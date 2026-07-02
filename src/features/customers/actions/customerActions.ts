"use server";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

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

export async function getCustomers() {
  const supabase = await getSupabase();
  const { data, error } = await supabase.from("customers").select("*").order("name", { ascending: true });
  if (error) throw new Error(error.message);
  return data;
}

export async function createCustomer(formData: any) {
  const supabase = await getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  let companyId = "11111111-1111-1111-1111-111111111111"; // default fallback
  if (user) {
    const { data: profile } = await supabase.from("users").select("company_id").eq("id", user.id).single();
    if (profile && profile.company_id) {
      companyId = profile.company_id;
    }
  }
  const customerWithDefaults = {
    company_id: companyId,
    ...formData
  };
  const { data, error } = await supabase.from("customers").insert([customerWithDefaults]).select();
  if (error) throw new Error(error.message);
  revalidatePath("/admin/customers");
  return data;
}

export async function updateCustomer(id: string, updates: any) {
  const supabase = await getSupabase();
  const { data, error } = await supabase.from("customers").update(updates).eq("id", id).select();
  if (error) throw new Error(error.message);
  revalidatePath("/admin/customers");
  return data;
}

export async function deleteCustomer(id: string) {
  const supabase = await getSupabase();
  const { error } = await supabase.from("customers").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/customers");
}
