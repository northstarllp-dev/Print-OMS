import { CustomersViewNew } from "@/features/customers/components/CustomersViewNew";
import { getCustomers } from "@/features/customers/actions/customerActions";
import { getOrders } from "@/features/orders/actions/orderActions";
import {
  mapDbCustomerToListRow,
  mapDbOrderToCustomerOrder,
} from "@/features/customers/customerLogic";

export default async function CustomersPage() {
  const customers = await getCustomers();
  const orders = await getOrders();

  const mappedCustomers = customers?.map(mapDbCustomerToListRow) || [];
  const mappedOrders = orders?.map(mapDbOrderToCustomerOrder) || [];

  return <CustomersViewNew initialCustomers={mappedCustomers} initialOrders={mappedOrders} />;
}
