import { Shield } from "lucide-react";
import { ComingSoonPage } from "@/features/admin/components/ComingSoonPage";

export const metadata = {
  title: "Roles | Admin",
};

export default function AdminRolesPage() {
  return (
    <ComingSoonPage
      title="Roles & Permissions"
      description="Control who can approve Design, Production, and other stage gates with finer access rules."
      icon={Shield}
    />
  );
}
