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
    payment_verified: (record.payment_verified as boolean) || false,
    created_at: record.created_at as string,
    updated_at: record.updated_at as string
  };
}

export function mapDesignToDb(design: Partial<DesignRecord>): Record<string, unknown> {
  return {
    ...(design.id ? { id: design.id } : {}),
    ...(design.order_id ? { order_id: design.order_id } : {}),
    ...(design.resources !== undefined ? { resources: design.resources } : {}),
    ...(design.items !== undefined ? { items: design.items } : {}),
    ...(design.payment_verified !== undefined ? { payment_verified: design.payment_verified } : {})
  };
}
