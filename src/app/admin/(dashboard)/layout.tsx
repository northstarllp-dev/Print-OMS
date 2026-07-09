import React from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/features/auth/actions/authActions";
import { getOrders } from "@/features/orders/actions/orderActions";
import { getEnquiries } from "@/features/enquiries/actions/enquiryActions";
import { getCustomers } from "@/features/customers/actions/customerActions";
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

  // Fetch counts for sidebar badges (parallel fetches for performance)
  const [ordersData, enquiriesData, customersData, openServiceTickets] = await Promise.all([
    getOrders().catch(() => []),
    getEnquiries().catch(() => []),
    getCustomers().catch(() => []),
    getOpenServiceTicketCount().catch(() => 0),
  ]);

  const activeOrders = (ordersData || []).filter(
    (o: any) => o.stage !== "Completed" && o.stage !== "Closed"
  ).length;

  const openEnquiries = (enquiriesData || []).filter(
    (e: any) => e.status !== "Converted" && e.status !== "Closed"
  ).length;

  const productionCount = (ordersData || []).filter(
    (o: any) => o.stage === "Production" || o.stage === "Ready For Installation"
  ).length;

  const installationCount = (ordersData || []).filter(
    (o: any) => o.stage === "Installation Scheduled"
  ).length;

  const mappedProfile = {
    id: profile.id,
    name: profile.name,
    email: profile.email || "",
    role: profile.role,
  };

  const counts = {
    orders: activeOrders,
    enquiries: openEnquiries,
    customers: (customersData || []).length,
    production: productionCount,
    installation: installationCount,
    payments: 2, // placeholder
    support: openServiceTickets,
  };

  return (
    <AdminLayoutClient profile={mappedProfile} counts={counts}>
      {children}
    </AdminLayoutClient>
  );
}
