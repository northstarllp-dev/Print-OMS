import { mapDesignFromDb } from "@/features/designs/actions/designMapper";
import {
  mapSiteVisitFromDb,
  mapSiteVisitMeasurementFromDb,
} from "@/features/orders/actions/siteVisitMapper";
import type { SiteVisitDetails } from "@/types";

export interface OrderDetailPatch {
  stage?: string;
  stageStatus?: string;
  stageAdminNotes?: string;
  chatHistory?: unknown[];
  depositPaid?: number;
  siteVisitDetails?: SiteVisitDetails | null;
  quoteDetails?: Record<string, unknown>;
  design?: ReturnType<typeof mapDesignFromDb>;
  productionDetails?: Record<string, unknown> | null;
  installationDetails?: Record<string, unknown> | null;
}

export function patchFromOrdersRow(row: Record<string, unknown>): OrderDetailPatch {
  return {
    stage: row.stage as string | undefined,
    stageStatus: row.stage_status as string | undefined,
    stageAdminNotes: row.stage_admin_notes as string | undefined,
    chatHistory: (row.chat_history as unknown[]) || undefined,
    depositPaid: row.deposit_paid != null ? Number(row.deposit_paid) : undefined,
  };
}

export function patchFromSiteVisitRow(
  row: Record<string, unknown>,
  existingLocations: SiteVisitDetails["locations"] = []
): OrderDetailPatch {
  const mapped = mapSiteVisitFromDb(row);
  if (!mapped) return { siteVisitDetails: null };
  return {
    siteVisitDetails: {
      ...mapped,
      locations:
        mapped.locations && mapped.locations.length > 0
          ? mapped.locations
          : existingLocations,
    },
  };
}

export function patchFromMeasurementEvent(
  eventType: string,
  newRow: Record<string, unknown> | null,
  oldRow: Record<string, unknown> | null,
  existingLocations: SiteVisitDetails["locations"] = []
): OrderDetailPatch | null {
  if (eventType === "DELETE" && oldRow?.id) {
    const id = String(oldRow.id);
    return {
      siteVisitDetails: {
        locations: (existingLocations || []).filter((loc) => loc.id !== id),
      } as SiteVisitDetails,
    };
  }
  if ((eventType === "INSERT" || eventType === "UPDATE") && newRow) {
    const mapped = mapSiteVisitMeasurementFromDb(newRow);
    const id = mapped.id;
    const without = (existingLocations || []).filter((loc) => loc.id !== id);
    return {
      siteVisitDetails: {
        locations: [...without, mapped],
      } as SiteVisitDetails,
    };
  }
  return null;
}

export function patchFromQuotationRow(row: Record<string, unknown>): OrderDetailPatch {
  return {
    quoteDetails: {
      quotationId: row.quotation_id,
      status: row.status,
      grandTotal: Number(row.grand_total) || 0,
      subtotal: Number(row.subtotal) || 0,
      discount: Number(row.discount) || 0,
      tax: Number(row.tax) || 0,
      signageOptions: row.signage_options || [],
      shipping: Number(row.shipping) || 0,
      notes: row.notes || "",
      terms: row.terms || "",
    },
  };
}

export function patchFromDesignRow(
  eventType: string,
  row: Record<string, unknown> | null
): OrderDetailPatch {
  if (eventType === "DELETE") return { design: undefined };
  const mapped = mapDesignFromDb(row);
  return mapped ? { design: mapped } : {};
}

export function patchFromProductionRow(
  eventType: string,
  row: Record<string, unknown> | null
): OrderDetailPatch {
  if (eventType === "DELETE") return { productionDetails: null };
  return row ? { productionDetails: row } : {};
}

export function patchFromInstallationRow(
  eventType: string,
  row: Record<string, unknown> | null
): OrderDetailPatch {
  if (eventType === "DELETE") return { installationDetails: null };
  return row ? { installationDetails: row } : {};
}

export function mergeOrderDetailPatch<T>(prev: T, patch: OrderDetailPatch): T {
  const next = { ...(prev as object) } as Record<string, unknown>;

  if (patch.stage !== undefined) next.stage = patch.stage;
  if (patch.stageStatus !== undefined) next.stageStatus = patch.stageStatus;
  if (patch.stageAdminNotes !== undefined) next.stageAdminNotes = patch.stageAdminNotes;
  if (patch.chatHistory !== undefined) next.chatHistory = patch.chatHistory;
  if (patch.depositPaid !== undefined) next.depositPaid = patch.depositPaid;

  if (patch.siteVisitDetails !== undefined) {
    if (patch.siteVisitDetails === null) {
      next.siteVisitDetails = undefined;
    } else if (patch.siteVisitDetails.locations && !(patch.siteVisitDetails as SiteVisitDetails).auditDate) {
      const prevSv = next.siteVisitDetails as SiteVisitDetails | undefined;
      next.siteVisitDetails = {
        ...(prevSv || {}),
        ...patch.siteVisitDetails,
        locations: patch.siteVisitDetails.locations,
      };
    } else {
      const prevSv = next.siteVisitDetails as SiteVisitDetails | undefined;
      next.siteVisitDetails = {
        ...(prevSv || {}),
        ...patch.siteVisitDetails,
      };
    }
  }

  if (patch.quoteDetails !== undefined) {
    const prevQd = next.quoteDetails as Record<string, unknown> | undefined;
    next.quoteDetails = { ...(prevQd || {}), ...patch.quoteDetails };
  }

  if (patch.design !== undefined) next.design = patch.design;
  if (patch.productionDetails !== undefined) next.productionDetails = patch.productionDetails;
  if (patch.installationDetails !== undefined) next.installationDetails = patch.installationDetails;

  return next as T;
}
