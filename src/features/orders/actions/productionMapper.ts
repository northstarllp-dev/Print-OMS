import type { ProductionDetails } from "@/types";

/** Normalize productions row after deadline → installation_deadline rename. */
export function mapProductionDetails(
  row: Record<string, unknown> | null | undefined
): ProductionDetails | null {
  if (!row) return null;
  const installationDeadline =
    (row.installation_deadline as string | null | undefined) ??
    (row.deadline as string | null | undefined) ??
    null;
  return {
    ...(row as ProductionDetails),
    installation_deadline: installationDeadline,
    deadline: installationDeadline,
  };
}
