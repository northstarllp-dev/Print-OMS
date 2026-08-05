import { redirect } from "next/navigation";

export const metadata = {
  title: "Roles | Admin",
};

/** Roles editor is not ready — keep nav on employees directory. */
export default function AdminRolesPage() {
  redirect("/admin/employees");
}
