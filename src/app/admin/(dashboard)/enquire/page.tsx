import { EnquiriesViewNew } from "@/features/enquiries/components/EnquiriesViewNew";
import { getEnquiries } from "@/features/enquiries/actions/enquiryActions";
import { getCustomers } from "@/features/customers/actions/customerActions";

export default async function EnquirePage() {
  const enquiries = await getEnquiries();
  const customers = await getCustomers();
  
  const mappedEnquiries = enquiries?.map((e: any) => ({
    id: e.id,
    dateReceived: e.date_received,
    leadName: e.lead_name,
    businessName: e.business_name || e.lead_name,
    phone: e.phone,
    whatsapp: e.whatsapp,
    email: e.email,
    source: e.source,
    status: e.status,
    notes: e.notes,
    primaryCommunicationMode: e.primary_communication_mode,
    location: e.location,
    customerId: e.customers?.customer_id || e.customer_id,
    orderId: e.orders?.order_id || e.order_id,
    enquireId: e.enquire_id || e.id,
    addedBy: e.added_by
  })) || [];

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
