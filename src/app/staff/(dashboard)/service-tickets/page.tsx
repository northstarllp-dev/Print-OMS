import React from "react";
import { getCurrentUser } from "@/features/auth/actions/authActions";
import { getServiceTickets } from "@/features/service-tickets/actions/serviceTicketActions";
import { resolveTicketPermission } from "@/features/service-tickets/ticketGrants";
import { ServiceTicketsView } from "@/features/service-tickets/components/ServiceTicketsView";

export default async function StaffServiceTicketsPage() {
  const profile = await getCurrentUser();
  const ticketPerm = resolveTicketPermission({
    role: profile?.role || "",
    staff_role: profile?.staff_role ?? null,
    company_id: profile?.company_id ?? null,
  });

  const tickets = await getServiceTickets();

  return (
    <ServiceTicketsView
      initialTickets={tickets}
      companyId={profile?.company_id ?? ""}
      isAdmin={false}
      canManage={ticketPerm.canManage}
    />
  );
}

