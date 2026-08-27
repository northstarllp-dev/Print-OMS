import { redirect } from "next/navigation";

/** Payment gate settings removed payments are financial tracking only. */
export default function PaymentsSettingsRedirect() {
  redirect("/admin/settings");
}
