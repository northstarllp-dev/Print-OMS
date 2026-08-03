import type { InvoiceProfile } from "@/features/quotations/types/invoiceProfile";
import type { ProductionChecklistItem } from "@/features/settings/productionChecklist";
import type { InvoiceNumberingConfig } from "@/features/invoices/types/invoiceNumbering";

export interface AppSettings {
  siteVisitSchedulingEnabled: boolean;
  installationSchedulingEnabled: boolean;
  /** Google Business / review URL used in post-install feedback messages. */
  googleReviewLink: string;
  invoiceProfile: InvoiceProfile;
  invoiceNumbering: InvoiceNumberingConfig;
  productionChecklistItems: ProductionChecklistItem[];
}

export interface CompanyDetails {
  id: string;
  name: string;
  address?: string | null;
}
