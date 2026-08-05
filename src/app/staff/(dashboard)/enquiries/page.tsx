import { redirect } from "next/navigation";
import { getCurrentUser } from "@/features/auth/actions/authActions";
import { resolveStagePermission } from "@/features/orders/workspace/shared/permissions";
import { EnquiriesViewNew } from "@/features/enquiries/components/EnquiriesViewNew";
import { getEnquiries, flagStalledEnquiriesAction } from "@/features/enquiries/actions/enquiryActions";
import { getCustomers } from "@/features/customers/actions/customerActions";
import { mapDbEnquiryToViewRow } from "@/features/enquiries/enquiryListLogic";
import { canAccessStaffEnquiriesPage } from "@/features/enquiries/enquiryAssignLogic";

import type { OrderStage } from "@/features/orders/workspace/shared/types";

export const metadata = {
  title: "Enquiries | Staff",
};

export default async function StaffEnquiriesPage() {
  await flagStalledEnquiriesAction().catch(() => ({ flagged: 0 }));

  const profile = await getCurrentUser();
  if (!profile) redirect("/staff/login");

  const actor = {
    role: profile.role,
    staff_role: profile.staff_role ?? null,
    company_id: profile.company_id ?? null,
  };

  const perm = resolveStagePermission("enquiry", actor);
  if (!canAccessStaffEnquiriesPage(perm)) {
    redirect("/staff/my-orders");
  }

  const stages: OrderStage[] = [
    "site_visit", "design", "quotation", "production", "invoice", "installation", "service_tickets"
  ];
  let canViewOrder = false;
  for (const stage of stages) {
    const p = resolveStagePermission(stage, actor);
    if (p.canView || p.canEdit) {
      canViewOrder = true;
      break;
    }
  }

  const [enquiries, customers] = await Promise.all([
    getEnquiries(),
    getCustomers(),
  ]);

  const mappedEnquiries =
    enquiries?.map((e: any) => mapDbEnquiryToViewRow(e)) || [];

  const mappedCustomers =
    customers?.map((c) => ({
      id: c.id,
      name: c.name,
      phone: c.phone,
      whatsapp: c.whatsapp,
      email: c.email,
      customerCode: c.customer_id || c.id,
    })) || [];

  return (
    <EnquiriesViewNew
      initialEnquiries={mappedEnquiries}
      initialCustomers={mappedCustomers}
      canEdit={perm.canEdit}
      canViewOrder={canViewOrder}
      orderBasePath="/staff/orders"
    />
  );
}
