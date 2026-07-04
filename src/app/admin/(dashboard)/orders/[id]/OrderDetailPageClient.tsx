"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { OrderWorksheetModal } from "@/features/order-detail/components/OrderWorksheetModal";
import { Order, Customer, Employee } from "@/types";

interface Product {
  id: string;
  product_id: string;
  name: string;
  category: string | null;
  pricing_type?: string | null;
  is_active: boolean;
  price_per_sqft?: number | null;
  price_per_unit?: number | null;
  images?: string[];
}

interface SiteVisitItem {
  id: string;
  name: string;
  width?: number | null;
  height?: number | null;
  depth?: number | null;
  notes?: string | null;
}

interface OrderDetailPageClientProps {
  order: Order;
  customers: Customer[];
  employees: Employee[];
  allOrders: any[];
  role: "Admin" | "Employee";
  currentEmployee: Employee | null;
  products?: Product[];
  initialQuotation?: any;
  siteVisitItems?: SiteVisitItem[];
}

export function OrderDetailPageClient({
  order,
  customers,
  employees,
  allOrders,
  role,
  currentEmployee,
  products = [],
  initialQuotation = null,
  siteVisitItems = [],
}: OrderDetailPageClientProps) {
  const router = useRouter();

  return (
    <div className="flex-1 w-full flex flex-col h-full min-h-0">
      <OrderWorksheetModal
        isOpen={true}
        onClose={() => {
          router.push(role === "Admin" ? "/admin/orders" : "/staff/orders");
        }}
        order={order}
        customers={customers}
        employees={employees}
        allOrders={allOrders}
        currentUserRole={role}
        currentEmployee={currentEmployee}
        products={products}
        initialQuotation={initialQuotation}
        siteVisitItems={siteVisitItems}
      />
    </div>
  );
}
