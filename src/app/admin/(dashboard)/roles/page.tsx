import { redirect } from "next/navigation";

export const metadata = {
  title: "Roles | Admin",
};

export default function AdminRolesPage() {
  redirect("/admin/employees?tab=roles");
}
