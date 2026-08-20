import React from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/features/auth/actions/authActions";
import { getAdminSidebarCounts } from "@/features/admin/actions/adminSidebarCounts";
import { AdminLayoutClient } from "./AdminLayoutClient";
import { getOpenServiceTicketCount } from "@/features/service-tickets/actions/serviceTicketActions";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getCurrentUser();

  // Enforce server-side security checks
  if (!profile || profile.role !== "admin") {
    redirect("/admin/login");
  }

  const [sidebarCounts, openServiceTickets] = await Promise.all([
    getAdminSidebarCounts().catch(() => ({
      orders: 0,
      enquiries: 0,
      customers: 0,
      production: 0,
      installation: 0,
    })),
    getOpenServiceTicketCount().catch(() => 0),
  ]);

  const mappedProfile = {
    id: profile.id,
    name: profile.name,
    email: profile.email || "",
    role: profile.role,
  };

  const counts = {
    orders: sidebarCounts.orders,
    enquiries: sidebarCounts.enquiries,
    customers: sidebarCounts.customers,
    production: sidebarCounts.production,
    installation: sidebarCounts.installation,
    payments: 2, // placeholder
    support: openServiceTickets,
  };

  return (
    <AdminLayoutClient profile={mappedProfile} counts={counts}>
      {children}
    </AdminLayoutClient>
  );
}
