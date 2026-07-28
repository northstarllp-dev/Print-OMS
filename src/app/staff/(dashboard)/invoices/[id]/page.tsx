import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/features/auth/actions/authActions";
import { resolveStagePermission } from "@/features/orders/workspace/shared/permissions";
import { getInvoiceById } from "@/features/invoices/actions/invoiceActions";
import { InvoiceBuilder } from "@/features/invoices/components/InvoiceBuilder";
import { getAppSettings } from "@/features/settings/actions/settingsActions";
import { normalizeInvoiceProfile } from "@/features/quotations/types/invoiceProfile";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export const metadata = {
  title: "Invoice | Staff",
};

async function getActiveProducts() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {},
      },
    }
  );
  const { data } = await supabase
    .from("products")
    .select("id, product_id, name, category, pricing_type, price_per_sqft, price_per_unit, is_active")
    .eq("is_active", true)
    .order("name");
  return data || [];
}

export default async function StaffInvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const profile = await getCurrentUser();
  if (!profile) redirect("/staff/login");

  const perm = resolveStagePermission("invoice", {
    role: profile.role,
    staff_role: profile.staff_role ?? null,
    company_id: profile.company_id ?? null,
  });
  if (!perm.canView && !perm.canEdit) {
    redirect("/staff/orders");
  }

  const { id } = await params;
  const invoice = await getInvoiceById(id);
  if (!invoice) notFound();

  const [products, settings] = await Promise.all([
    getActiveProducts(),
    getAppSettings(),
  ]);
  const invoiceProfile = normalizeInvoiceProfile(
    settings?.invoiceProfile
  );

  return (
    <div className="flex-1 bg-slate-50 min-h-screen">
      <InvoiceBuilder
        invoice={invoice}
        products={products}
        invoiceProfile={invoiceProfile}
        basePath="/staff/invoices"
        orderBasePath="/staff/orders"
        canEdit={perm.canEdit}
      />
    </div>
  );
}
