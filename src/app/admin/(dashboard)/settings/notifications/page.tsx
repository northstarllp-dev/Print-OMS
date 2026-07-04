import { redirect } from "next/navigation";

export default function NotificationsSettingsRedirect() {
  redirect("/admin/settings");
}
