import { loadClientConfig } from "@/config/loadClientConfig";

/** Customer-visible product name. Slug, base path, and URLs stay printoms. */
export function portalDisplayName(): string {
  const { id, name } = loadClientConfig();
  if (id === "printoms" || /^print\s*oms$/i.test(name.trim())) {
    return "PrintOps";
  }
  return name;
}
