import { EnquiriesViewNew } from "@/features/enquiries/components/EnquiriesViewNew";
import { getEnquiries, flagStalledEnquiriesAction } from "@/features/enquiries/actions/enquiryActions";
import { getCustomers } from "@/features/customers/actions/customerActions";
import { mapDbEnquiryToViewRow } from "@/features/enquiries/enquiryListLogic";

export default async function EnquirePage() {
  await flagStalledEnquiriesAction().catch(() => ({ flagged: 0 }));
  const enquiries = await getEnquiries();
  const customers = await getCustomers();
  
  const mappedEnquiries = enquiries?.map((e: any) => mapDbEnquiryToViewRow(e)) || [];

  const mappedCustomers = customers?.map(c => ({
    id: c.id,
    name: c.name,
    phone: c.phone,
    whatsapp: c.whatsapp,
    email: c.email,
    customerCode: c.customer_id || c.id
  })) || [];

  return <EnquiriesViewNew initialEnquiries={mappedEnquiries} initialCustomers={mappedCustomers} canEdit />;
}
