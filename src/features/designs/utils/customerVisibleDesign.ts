import type { DesignItem, DesignRecord, DesignVersion } from "@/types";

const STAFF_ONLY_VERSION_STATUSES = new Set<DesignVersion["status"]>([
  "Draft",
  "Pending Admin",
]);

export function isDesignVersionVisibleToCustomer(
  status: DesignVersion["status"]
): boolean {
  return !STAFF_ONLY_VERSION_STATUSES.has(status);
}

/** Strip staff-only versions (and production files) before customer portal render/sync. */
export function toCustomerVisibleDesign(
  design: DesignRecord | null | undefined
): DesignRecord | null {
  if (!design) return null;

  const items = (design.items || []).map(
    (item): DesignItem => ({
      ...item,
      versions: (item.versions || []).filter((version) =>
        isDesignVersionVisibleToCustomer(version.status)
      ),
      productionFiles: undefined,
      designFiles: undefined,
      designFilesReady: undefined,
    })
  );

  return { ...design, items };
}

/**
 * Portal clients may omit staff-only draft versions. Re-attach them from the DB
 * snapshot so customer actions never wipe in-progress designer uploads.
 */
export function mergePortalDesignItemsPreservingStaffDrafts(
  existingItems: DesignItem[] = [],
  incomingItems: DesignItem[] = []
): DesignItem[] {
  const existingById = new Map(existingItems.map((item) => [item.id, item]));
  const incomingIds = new Set(incomingItems.map((item) => item.id));

  const merged = incomingItems.map((incoming) => {
    const existing = existingById.get(incoming.id);
    if (!existing) return incoming;

    const staffOnlyVersions = (existing.versions || []).filter(
      (version) => !isDesignVersionVisibleToCustomer(version.status)
    );
    const incomingVersionIds = new Set((incoming.versions || []).map((version) => version.id));
    const preservedStaffVersions = staffOnlyVersions.filter(
      (version) => !incomingVersionIds.has(version.id)
    );
    const mergedVersions = [...(incoming.versions || []), ...preservedStaffVersions].sort(
      (a, b) => a.versionNumber - b.versionNumber
    );

    return {
      ...existing,
      ...incoming,
      versions: mergedVersions,
      productionFiles: existing.productionFiles,
      designFiles: existing.designFiles,
      designFilesReady: existing.designFilesReady,
    };
  });

  for (const [id, existing] of existingById) {
    if (!incomingIds.has(id)) {
      merged.push(existing);
    }
  }

  return merged;
}
