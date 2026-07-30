import type { InvoiceProfile } from "@/features/quotations/types/invoiceProfile";
import type { ProductionChecklistItem } from "@/features/settings/productionChecklist";
import type { InvoiceNumberingConfig } from "@/features/invoices/types/invoiceNumbering";

export interface AppSettings {
  siteVisitSchedulingEnabled: boolean;
  installationSchedulingEnabled: boolean;
  enableFinalProduct: boolean;
  invoiceProfile: InvoiceProfile;
  invoiceNumbering: InvoiceNumberingConfig;
  productionChecklistItems: ProductionChecklistItem[];
}

export interface CompanyDetails {
  id: string;
  name: string;
  address?: string | null;
}
