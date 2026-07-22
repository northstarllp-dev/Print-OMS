"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { OrderWorksheetModal } from "@/features/order-detail/components/OrderWorksheetModal";
import { Order, Customer, Employee } from "@/types";
import type { OrderStage } from "@/features/orders/workspace/shared/types";

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
  /** Queue-scoped entry: when set, only this stage's timeline node is accessible for staff. */
  entryStage?: OrderStage;
  /** Where "Back" navigates to. Defaults to /admin/orders (Admin) or /staff/orders (Employee). */
  backHref?: string;
  companyId?: string | null;
  /** Open Payments tab when landing from collections. */
  openPaymentsTab?: boolean;
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
  entryStage,
  backHref,
  companyId,
  openPaymentsTab,
}: OrderDetailPageClientProps) {
  const router = useRouter();

  return (
    <div className="flex-1 w-full flex flex-col h-full min-h-0">
      <OrderWorksheetModal
        isOpen={true}
        onClose={() => {
          router.refresh();
          router.push(backHref ?? (role === "Admin" ? "/admin/orders" : "/staff/orders"));
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
        entryStage={entryStage}
        companyId={companyId}
        initialStepTab={openPaymentsTab ? 98 /* PAYMENTS_TAB */ : undefined}
      />
    </div>
  );
}
