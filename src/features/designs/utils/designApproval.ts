import type { DesignItem } from "@/types";

export function getDesignItemsWithVersions(items: DesignItem[] = []): DesignItem[] {
  return items.filter((item) => Array.isArray(item.versions) && item.versions.length > 0);
}

export function areAllDesignItemsApproved(items: DesignItem[] = []): boolean {
  const activeItems = getDesignItemsWithVersions(items);
  if (activeItems.length === 0) return false;
  return activeItems.every((item) => {
    const latest = item.versions[item.versions.length - 1];
    return latest?.status === "Approved";
  });
}
