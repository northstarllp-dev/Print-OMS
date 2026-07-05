import { redirect } from "next/navigation";
import { getCurrentUser } from "@/features/auth/actions/authActions";
import { getStaffHomePath } from "@/features/orders/workspace/shared/stageGrants";

export default async function StaffPage() {
  const profile = await getCurrentUser();
  if (!profile || profile.role !== "staff") {
    redirect("/staff/login");
  }

  const actor = {
    role: profile.role,
    staff_role: profile.staff_role ?? null,
    company_id: profile.company_id ?? null,
  };
  redirect(getStaffHomePath(actor));
}
