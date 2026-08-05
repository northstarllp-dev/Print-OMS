import { getCurrentUser } from "@/features/auth/actions/authActions";
import { getDeployCompanyId } from "@/config/loadClientConfig";

/**
 * Resolve company_id for inserts. Requires an authenticated user — mutations must
 * never silently fall back to the deploy company id, since that would let an
 * unauthenticated request write data scoped to this tenant.
 */
export async function resolveWriteCompanyId(): Promise<string> {
  const profile = await getCurrentUser();
  if (!profile?.company_id) {
    throw new Error("resolveWriteCompanyId: authenticated user required");
  }
  // Defense in depth: the caller's company must match this deploy.
  const deployId = getDeployCompanyId();
  if (profile.company_id !== deployId) {
    throw new Error("resolveWriteCompanyId: user company does not match deploy");
  }
  return profile.company_id as string;
}
