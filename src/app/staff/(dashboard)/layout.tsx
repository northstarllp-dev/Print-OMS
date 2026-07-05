import React, { Suspense } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/features/auth/actions/authActions";
import { StaffLayoutClient } from "./StaffLayoutClient";

export default async function StaffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getCurrentUser();

  // Enforce server-side security checks
  if (!profile || profile.role !== "staff") {
    redirect("/staff/login");
  }

  const mappedProfile = {
    id: profile.id,
    name: profile.name,
    email: profile.email || "",
    role: profile.role,
    staff_role: profile.staff_role || "Field Agent",
    company_id: profile.company_id ?? null,
  };

  return (
    <Suspense fallback={null}>
      <StaffLayoutClient profile={mappedProfile}>
        {children}
      </StaffLayoutClient>
    </Suspense>
  );
}
