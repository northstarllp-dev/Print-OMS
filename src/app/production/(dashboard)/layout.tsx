import React from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/features/auth/actions/authActions";
import { canAccessProductionPortal } from "@/features/orders/workspace/shared/stageGrants";
import { ProductionLayoutClient } from "./ProductionLayoutClient";

export default async function ProductionLayout({
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

  if (!profile || !canAccessProductionPortal(actor)) {
    redirect("/production/login");
  }

  const mappedProfile = {
    id: profile.id,
    name: profile.name,
    email: profile.email || "",
    role: profile.role,
    staff_role: profile.staff_role || "Production",
    company_id: profile.company_id ?? null,
  };

  return (
    <ProductionLayoutClient profile={mappedProfile}>
      {children}
    </ProductionLayoutClient>
  );
}
