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
  const { resolveWriteCompanyId } = await import("@/lib/resolveWriteCompanyId");
  const companyId = await resolveWriteCompanyId();
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

export type EmployeeAccountStatus = "Active" | "Inactive" | "Archived";

/** Freeze (Inactive) / reactivate (Active) / archive a staff employee. Admin only. */
export async function setEmployeeStatus(
  id: string,
  status: EmployeeAccountStatus
): Promise<{ id: string; status: string }> {
  await assertAdminOnly();

  if (status !== "Active" && status !== "Inactive" && status !== "Archived") {
    throw new Error("Invalid status. Use Active, Inactive, or Archived.");
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
    throw new Error("Only staff employees can be frozen, reactivated, or archived.");
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

/** Soft-delete: archive employee. Never hard-deletes the users row. */
export async function archiveEmployee(id: string) {
  return setEmployeeStatus(id, "Archived");
}

/** Restore an archived employee to Active. */
export async function restoreEmployee(id: string) {
  return setEmployeeStatus(id, "Active");
}
