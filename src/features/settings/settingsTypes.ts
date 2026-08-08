import type { InvoiceProfile } from "@/features/quotations/types/invoiceProfile";
import type {
  ProductionChecklistItem,
  ProductionChecklistsByOp,
} from "@/features/settings/productionChecklist";
import type { InvoiceNumberingConfig } from "@/features/invoices/types/invoiceNumbering";

export interface AppSettings {
  siteVisitSchedulingEnabled: boolean;
  installationSchedulingEnabled: boolean;
  /** Google Business / review URL used in post-install feedback messages. */
  googleReviewLink: string;
  invoiceProfile: InvoiceProfile;
  invoiceNumbering: InvoiceNumberingConfig;
  /**
   * Workshop production checklist per business operation.
   * Legacy single-list settings are normalized into this map on read.
   */
  productionChecklistsByOp: ProductionChecklistsByOp;
  /**
   * @deprecated Prefer productionChecklistsByOp. Kept as signage/default list for older callers.
   */
  productionChecklistItems: ProductionChecklistItem[];
}

export interface CompanyDetails {
  id: string;
  name: string;
  address?: string | null;
}
