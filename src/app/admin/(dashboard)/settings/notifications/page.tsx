import { redirect } from "next/navigation";

/** Legacy path — payment gate settings live under /admin/settings/payments */
export default function NotificationsSettingsRedirect() {
  redirect("/admin/settings/payments");
}
