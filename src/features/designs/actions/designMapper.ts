import { DesignRecord, DesignItem, DesignVersion } from "@/types";

export function mapDesignFromDb(d: unknown): DesignRecord {
  const record = d as Record<string, unknown>;
  const resources = (record.resources || []) as DesignRecord["resources"];
  let items = (record.items || []) as DesignItem[];

  // Legacy safety net: if items is empty but top-level versions exist, expose a General Design item.
  const versions = record.versions as DesignVersion[] | undefined;
  if (items.length === 0 && versions && Array.isArray(versions)) {
    items = [{
      id: "general",
      name: "General Design",
      versions,
      currentVersion: (record.currentVersion as number) || 0,
      productionFiles: (record.productionFiles || []) as { id: string; name: string; url: string; createdAt: string }[]
    }];
  }

  return {
    id: record.id as string,
    order_id: record.order_id as string,
    resources,
    items,
    created_at: record.created_at as string,
    updated_at: record.updated_at as string
  };
}
