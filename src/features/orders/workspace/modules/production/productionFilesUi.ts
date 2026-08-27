/**
 * Which design items to show on the production stage file panel.
 * Drops empty site-visit stubs that have no proofs and no files.
 */
export function productionStageFileItems<
  T extends {
    versions?: unknown[];
    designFiles?: unknown[];
    productionFiles?: unknown[];
  },
>(items: T[] | null | undefined): T[] {
  return (items || []).filter((item) => {
    const hasVersions = Array.isArray(item.versions) && item.versions.length > 0;
    const hasDesign = Array.isArray(item.designFiles) && item.designFiles.length > 0;
    const hasProduction = Array.isArray(item.productionFiles) && item.productionFiles.length > 0;
    return hasVersions || hasDesign || hasProduction;
  });
}

export function fileExtensionLabel(name: string | undefined): string {
  const ext = (name || "").split(".").pop()?.trim();
  if (!ext || ext === name) return "FILE";
  return ext.toUpperCase();
}
