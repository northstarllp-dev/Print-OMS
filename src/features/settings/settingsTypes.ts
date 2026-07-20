import type { InvoiceProfile } from "@/features/quotations/types/invoiceProfile";
import type { ProductionChecklistItem } from "@/features/settings/productionChecklist";

export interface AppSettings {
  siteVisitSchedulingEnabled: boolean;
  installationSchedulingEnabled: boolean;
  enableFinalProduct: boolean;
  invoiceProfile: InvoiceProfile;
  productionChecklistItems: ProductionChecklistItem[];
}

export interface CompanyDetails {
  id: string;
  name: string;
  address?: string | null;
}
