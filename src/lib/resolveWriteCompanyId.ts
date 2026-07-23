import { getCurrentUser } from "@/features/auth/actions/authActions";
import { getDeployCompanyId } from "@/config/loadClientConfig";

/**
 * Resolve company_id for inserts: profile → deploy config → throw.
 * Never invents the Printoms UUID.
 */
export async function resolveWriteCompanyId(): Promise<string> {
  const profile = await getCurrentUser();
  if (profile?.company_id) return profile.company_id as string;
  return getDeployCompanyId();
}
