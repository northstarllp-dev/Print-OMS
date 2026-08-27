/**
 * Pure lifecycle contracts for order-stage file uploads.
 * Encodes: storage upload timing, when the DB link is written, and delete order.
 */

import {
  bucketForPurpose,
  type StorageUploadPurpose,
} from "@/utils/supabase/serverStorageUpload";
import { parseStoredRef } from "@/utils/storage/storageRef";

export type PersistMode = "immediate_after_upload" | "deferred_until_save";
export type DeleteOrder = "storage_then_local_or_db" | "db_then_storage";

export interface StageLifecycle {
  purpose: StorageUploadPurpose;
  bucket: string;
  /** When the public URL is written to Postgres. */
  persistMode: PersistMode;
  /** Table / JSON field that stores the link. */
  dbTarget: { table: string; field: string };
  deleteOrder: DeleteOrder;
  /** Storage object must be removed on delete. */
  cleansStorageOnDelete: boolean;
}

const LIFECYCLES: Record<StorageUploadPurpose, StageLifecycle> = {
  site_visit_photo: {
    purpose: "site_visit_photo",
    bucket: "site-visit-photos",
    // Uploaded to storage immediately; URL stays in React state until Save Draft.
    persistMode: "deferred_until_save",
    dbTarget: { table: "site_visit_measurements", field: "photos" },
    deleteOrder: "storage_then_local_or_db",
    cleansStorageOnDelete: true,
  },
  design_resource: {
    purpose: "design_resource",
    bucket: "order-resources",
    persistMode: "immediate_after_upload",
    dbTarget: { table: "designs", field: "resources" },
    deleteOrder: "db_then_storage",
    cleansStorageOnDelete: true,
  },
  design_proof: {
    purpose: "design_proof",
    bucket: "design-proofs",
    persistMode: "immediate_after_upload",
    dbTarget: { table: "designs", field: "items[].versions[].proofUrl" },
    deleteOrder: "db_then_storage",
    cleansStorageOnDelete: true,
  },
  design_source_file: {
    purpose: "design_source_file",
    bucket: "design-files",
    persistMode: "immediate_after_upload",
    dbTarget: { table: "designs", field: "items[].designFiles[].url" },
    deleteOrder: "db_then_storage",
    cleansStorageOnDelete: true,
  },
  production_asset: {
    purpose: "production_asset",
    bucket: "production-files",
    persistMode: "immediate_after_upload",
    dbTarget: { table: "designs", field: "items[].productionFiles[].url" },
    deleteOrder: "db_then_storage",
    cleansStorageOnDelete: true,
  },
  installation_photo: {
    purpose: "installation_photo",
    bucket: "installation-photos",
    persistMode: "immediate_after_upload",
    dbTarget: { table: "installations", field: "photos|afterPhotos" },
    deleteOrder: "storage_then_local_or_db",
    cleansStorageOnDelete: true,
  },
  service_ticket_photo: {
    purpose: "service_ticket_photo",
    bucket: "service-ticket-photos",
    persistMode: "deferred_until_save",
    dbTarget: { table: "service_tickets", field: "photos" },
    deleteOrder: "db_then_storage",
    cleansStorageOnDelete: true,
  },
  service_ticket_resolution_photo: {
    purpose: "service_ticket_resolution_photo",
    bucket: "service-ticket-resolution-photos",
    persistMode: "deferred_until_save",
    dbTarget: { table: "service_tickets", field: "resolution_photos" },
    deleteOrder: "db_then_storage",
    cleansStorageOnDelete: true,
  },
};

export function stageLifecycle(purpose: StorageUploadPurpose): StageLifecycle {
  return LIFECYCLES[purpose];
}

export function allStageLifecycles(): StageLifecycle[] {
  return Object.values(LIFECYCLES);
}

/** After a successful storage upload, should we write the URL to the DB now? */
export function shouldPersistLinkAfterUpload(purpose: StorageUploadPurpose): boolean {
  return stageLifecycle(purpose).persistMode === "immediate_after_upload";
}

/**
 * Plan a delete for a stored public URL.
 * Returns null when the URL is not a recognized public storage object.
 */
export function planStorageDelete(publicUrl: string): {
  bucket: string;
  path: string;
  cleansStorage: true;
} | null {
  const parsed = parseStoredRef(publicUrl);
  if (!parsed) return null;
  return { bucket: parsed.bucket, path: parsed.path, cleansStorage: true };
}

/** Append uploaded URLs into a photo URL list (site visit / installation). */
export function appendPhotoUrls(existing: string[], uploaded: string[]): string[] {
  return [...existing, ...uploaded];
}

/** Remove one URL from a photo list. */
export function removePhotoUrl(existing: string[], urlToRemove: string): string[] {
  return existing.filter((u) => u !== urlToRemove);
}

export interface DesignResourceRecord {
  id: string;
  url: string;
  name: string;
  type: "file";
  uploadedBy: "Customer";
  createdAt: string;
}

/** Build the designs.resources row entry after a successful upload. */
export function buildDesignResourceRecord(input: {
  id: string;
  url: string;
  name: string;
  createdAt?: string;
}): DesignResourceRecord {
  return {
    id: input.id,
    url: input.url,
    name: input.name,
    type: "file",
    uploadedBy: "Customer",
    createdAt: input.createdAt || new Date().toISOString(),
  };
}

export function removeDesignResourceById<T extends { id: string }>(
  resources: T[],
  resourceId: string
): T[] {
  return resources.filter((r) => r.id !== resourceId);
}

export interface ProofVersionLike {
  id: string;
  proofUrl: string;
  versionNumber: number;
}

/** After storage upload, append a proof version that carries the public URL. */
export function appendProofVersion<T extends ProofVersionLike>(
  versions: T[],
  next: T
): T[] {
  return [...versions, next];
}

export function removeProofVersionById<T extends { id: string }>(
  versions: T[],
  versionId: string
): T[] {
  return versions.filter((v) => v.id !== versionId);
}

export interface ProductionFileLike {
  id: string;
  name: string;
  url: string;
  createdAt: string;
}

export function appendProductionFiles<T extends ProductionFileLike>(
  existing: T[],
  uploaded: T[]
): T[] {
  return [...existing, ...uploaded];
}

export function removeProductionFileById<T extends { id: string; url?: string }>(
  files: T[],
  fileId: string
): { remaining: T[]; removed: T | undefined } {
  const removed = files.find((f) => f.id === fileId);
  return {
    remaining: files.filter((f) => f.id !== fileId),
    removed,
  };
}

/**
 * Full delete plan for a production file: strip DB link + remove storage object.
 */
export function planProductionFileDelete(file: { url: string } | undefined): {
  updateDb: true;
  storage: { bucket: string; path: string } | null;
} {
  if (!file?.url) return { updateDb: true, storage: null };
  const parsed = parseStoredRef(file.url);
  return {
    updateDb: true,
    storage: parsed ? { bucket: parsed.bucket, path: parsed.path } : null,
  };
}

/** Append design source files to an item's designFiles array. */
export function appendDesignFiles<T extends ProductionFileLike>(
  existing: T[],
  uploaded: T[]
): T[] {
  return [...existing, ...uploaded];
}

/** Remove one design source file by id. */
export function removeDesignFileById<T extends { id: string; url?: string }>(
  files: T[],
  fileId: string
): { remaining: T[]; removed: T | undefined } {
  const removed = files.find((f) => f.id === fileId);
  return {
    remaining: files.filter((f) => f.id !== fileId),
    removed,
  };
}

/** Full delete plan for a design source file: strip DB link + remove storage object. */
export function planDesignFileDelete(file: { url: string } | undefined): {
  updateDb: true;
  storage: { bucket: string; path: string } | null;
} {
  if (!file?.url) return { updateDb: true, storage: null };
  const parsed = parseStoredRef(file.url);
  return {
    updateDb: true,
    storage: parsed ? { bucket: parsed.bucket, path: parsed.path } : null,
  };
}

/** Sanity: lifecycle bucket always matches bucketForPurpose. */
export function assertLifecycleBucketsAligned(): void {
  for (const life of allStageLifecycles()) {
    if (bucketForPurpose(life.purpose) !== life.bucket) {
      throw new Error(`Bucket mismatch for ${life.purpose}`);
    }
  }
}
