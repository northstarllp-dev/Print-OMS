import { OrdersManagementDashboard } from "@/features/orders/components/OrdersManagementDashboard";
import { getOrders } from "@/features/orders/actions/orderActions";
import { getCustomers } from "@/features/customers/actions/customerActions";
import { getEnquiries } from "@/features/enquiries/actions/enquiryActions";
import { getUserSession } from "@/features/auth/actions/authActions";
import { getEmployees } from "@/features/employees/actions/employeeActions";

export default async function StaffDesignPage() {
  const orders = await getOrders();
  const customers = await getCustomers();
  const enquiries = await getEnquiries();
  const user = await getUserSession();
  const employeesData = await getEmployees();
  
  // Find current employee info
  const currentEmployee = employeesData?.find(e => e.id === user?.id);
  
  // Filter orders allotted to this staff member & in Design stages
  const designStages = ["Design In Progress", "Design Approved"];
  const allottedOrders = orders?.filter(o => 
    o.assigned_employees?.includes(user?.id) &&
    designStages.includes(o.stage)
  ) || [];
  
  const mappedOrders = allottedOrders.map(o => ({
    id: o.id,
    projectName: o.project_name,
    customerId: o.customer_id,
    stage: o.stage,
    productType: o.product_type,
    requirements: o.requirements,
    assignedEmployees: o.assigned_employees || [],
    dateCreated: o.date_created,
    customerName: o.business_name || "",
    orderCode: o.order_id || o.id,
    orderId: o.order_id || o.id
  }));

  const mappedCustomers = customers?.map(c => ({
    id: c.id,
    name: c.name,
    phone: c.phone,
    customerCode: c.customer_id || c.id,
    customerId: c.customer_id || c.id
  })) || [];

  const mappedEmployees = employeesData?.map(e => ({
    id: e.id,
    name: e.name,
    role: e.staff_role,
    email: e.email
  })) || [];

  const mappedEnquiries = enquiries?.map(e => ({
    id: e.id,
    source: e.source,
    status: e.status
  })) || [];

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Design proof Tasks</h1>
        <p className="text-sm text-slate-500 mt-1">Submit mockups, review feedback, and finalize proofs for customer sign-off.</p>
      </div>
      <OrdersManagementDashboard 
        initialOrders={mappedOrders}
        initialCustomers={mappedCustomers}
        initialEmployees={mappedEmployees}
        initialEnquiries={mappedEnquiries}
        userRole="Employee"
        currentEmployeeName={currentEmployee?.name || ""}
        getOrderDetailHref={(order) =>
          `/staff/orders/${order.orderId || order.id}?entryStage=design`
        }
      />
    </div>
  );
}
