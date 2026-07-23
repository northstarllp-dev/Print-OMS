import { clientRegistry } from "@/config/registry";
import { loadClientConfig, getDeployCompanyId } from "@/config/loadClientConfig";
import { mergeConfig } from "@/config/mergeConfig";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Public service-ticket URLs may use either the company UUID or the client slug
 * (older Copy Link used slug). Always resolve to a company UUID for DB queries.
 */
export function resolvePublicCompanyId(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  if (UUID_RE.test(value)) return value;

  const override = clientRegistry[value];
  if (override) {
    const companyId = mergeConfig(override).companyId;
    if (companyId) return companyId;
  }

  try {
    const deploy = loadClientConfig();
    if (deploy.id === value) return getDeployCompanyId();
  } catch {
    // ignore — caller treats null as unknown company
  }

  return null;
}
