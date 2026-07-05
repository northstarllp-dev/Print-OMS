import React from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/features/auth/actions/authActions";
import { canAccessInstallationPortal } from "@/features/orders/workspace/shared/stageGrants";
import { InstallationLayoutClient } from "./InstallationLayoutClient";

export default async function InstallationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getCurrentUser();
  const actor = {
    role: profile?.role ?? "",
    staff_role: profile?.staff_role ?? null,
    company_id: profile?.company_id ?? null,
  };

  if (!profile || !canAccessInstallationPortal(actor)) {
    redirect("/installation/login");
  }

  const mappedProfile = {
    id: profile.id,
    name: profile.name,
    email: profile.email || "",
    role: profile.role,
    staff_role: profile.staff_role || "Installation",
    company_id: profile.company_id ?? null,
  };

  return (
    <InstallationLayoutClient profile={mappedProfile}>
      {children}
    </InstallationLayoutClient>
  );
}
