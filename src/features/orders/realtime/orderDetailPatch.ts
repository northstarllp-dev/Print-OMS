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
  siteVisitUpdateEvent?: { row: Record<string, unknown> };
  siteVisitMeasurementEvent?: {
    eventType: string;
    newRow: Record<string, unknown> | null;
    oldRow: Record<string, unknown> | null;
  };
  quoteDetails?: Record<string, unknown>;
  /** Raw quotations row for QuotationModule realtime apply (snake_case DB shape). */
  quotationRow?: Record<string, unknown>;
  design?: ReturnType<typeof mapDesignFromDb> | null;
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
  row: Record<string, unknown>
): OrderDetailPatch {
  return { siteVisitUpdateEvent: { row } };
}

export function patchFromMeasurementEvent(
  eventType: string,
  newRow: Record<string, unknown> | null,
  oldRow: Record<string, unknown> | null
): OrderDetailPatch {
  return { siteVisitMeasurementEvent: { eventType, newRow, oldRow } };
}

export function patchFromQuotationRow(row: Record<string, unknown>): OrderDetailPatch {
  return {
    quotationRow: row,
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
      rejectionReason: row.rejection_reason || "",
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    },
  };
}

export function patchFromDesignRow(
  eventType: string,
  row: Record<string, unknown> | null
): OrderDetailPatch {
  if (eventType === "DELETE") return { design: null };
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
    next.siteVisitDetails = patch.siteVisitDetails;
  }

  if (patch.siteVisitUpdateEvent) {
    const mapped = mapSiteVisitFromDb(patch.siteVisitUpdateEvent.row);
    if (!mapped) {
      next.siteVisitDetails = undefined;
    } else {
      const prevSv = next.siteVisitDetails as SiteVisitDetails | undefined;
      const existingLocations = prevSv?.locations || [];
      next.siteVisitDetails = {
        ...(prevSv || {}),
        ...mapped,
        locations: mapped.locations && mapped.locations.length > 0 ? mapped.locations : existingLocations,
      };
    }
  }

  if (patch.siteVisitMeasurementEvent) {
    const { eventType, newRow, oldRow } = patch.siteVisitMeasurementEvent;
    const prevSv = next.siteVisitDetails as SiteVisitDetails | undefined;
    const existingLocations = prevSv?.locations || [];

    if (eventType === "DELETE") {
      const id = oldRow?.id != null ? String(oldRow.id) : null;
      if (id) {
        next.siteVisitDetails = {
          ...(prevSv || {}),
          locations: existingLocations.filter((loc) => String(loc.id) !== id),
        } as SiteVisitDetails;
      }
    } else if ((eventType === "INSERT" || eventType === "UPDATE") && newRow) {
      const mapped = mapSiteVisitMeasurementFromDb(newRow);
      const id = mapped.id != null ? String(mapped.id) : null;
      if (!id) return next as T;
      const existsIndex = existingLocations.findIndex((loc) => String(loc.id) === id);
      const newLocations = [...existingLocations];

      if (existsIndex >= 0) {
        newLocations[existsIndex] = mapped;
      } else {
        newLocations.push(mapped);
      }

      next.siteVisitDetails = {
        ...(prevSv || {}),
        locations: newLocations,
      } as SiteVisitDetails;
    }
  }

  if (patch.quoteDetails !== undefined) {
    const prevQd = next.quoteDetails as Record<string, unknown> | undefined;
    next.quoteDetails = { ...(prevQd || {}), ...patch.quoteDetails };
  }

  if (patch.design !== undefined) next.design = patch.design ?? undefined;
  if (patch.productionDetails !== undefined) next.productionDetails = patch.productionDetails;
  if (patch.installationDetails !== undefined) next.installationDetails = patch.installationDetails;

  return next as T;
}
