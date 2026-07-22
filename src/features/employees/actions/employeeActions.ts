"use server";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { assertAdminOnly } from "@/features/orders/workspace/shared/serverPermissions";

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

export async function getEmployees() {
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from("users")
    .select("*, order_assignments(id)")
    .eq("role", "staff");
  if (error) throw new Error(error.message);
  
  return data.map(user => ({
    ...user,
    employeeId: user.employee_id,
    jobsAssigned: user.order_assignments ? user.order_assignments.length : 0
  }));
}

export async function createEmployee(employeeData: any) {
  const supabase = await getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  let companyId = "11111111-1111-1111-1111-111111111111"; // default fallback
  if (user) {
    const { data: profile } = await supabase.from("users").select("company_id").eq("id", user.id).single();
    if (profile && profile.company_id) {
      companyId = profile.company_id;
    }
  }
  const { data, error } = await supabase
    .from("users")
    .insert([
      {
        company_id: companyId,
        ...employeeData,
        role: "staff",
      },
    ])
    .select();
  if (error) throw new Error(error.message);
  revalidatePath("/admin/employees");
  return data;
}

export async function updateEmployee(id: string, updates: any) {
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from("users")
    .update(updates)
    .eq("id", id)
    .select();
  if (error) throw new Error(error.message);
  revalidatePath("/admin/employees");
  return data;
}

export type EmployeeAccountStatus = "Active" | "Inactive";

/** Freeze (Inactive) or reactivate (Active) a staff employee. Admin only. */
export async function setEmployeeStatus(
  id: string,
  status: EmployeeAccountStatus
): Promise<{ id: string; status: string }> {
  await assertAdminOnly();

  if (status !== "Active" && status !== "Inactive") {
    throw new Error("Invalid status. Use Active or Inactive.");
  }

  const supabase = await getSupabase();
  const { data: target, error: fetchError } = await supabase
    .from("users")
    .select("id, role, status")
    .eq("id", id)
    .maybeSingle();

  if (fetchError) throw new Error(fetchError.message);
  if (!target) throw new Error("Employee not found.");
  if (target.role !== "staff") {
    throw new Error("Only staff employees can be frozen or reactivated.");
  }

  const { data, error } = await supabase
    .from("users")
    .update({ status })
    .eq("id", id)
    .eq("role", "staff")
    .select("id, status")
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/admin/employees");
  return data;
}

export async function deleteEmployee(id: string) {
  const supabase = await getSupabase();
  const { error } = await supabase.from("users").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/employees");
}
