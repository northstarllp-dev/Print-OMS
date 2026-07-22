export type ProductionChecklistItem = {
  id: string;
  label: string;
  description: string;
};

export const STAGE_COLUMN_IDS = ["stage1", "stage2", "stage3", "stage4"] as const;

export const DEFAULT_PRODUCTION_CHECKLIST_ITEMS: ProductionChecklistItem[] = [
  {
    id: "stage1",
    label: "Procurement of Materials",
    description: "Sourcing and procuring all required raw materials",
  },
  {
    id: "stage2",
    label: "ACP & Acrylic Cutting",
    description: "Precision cutting of ACP and acrylic sheets",
  },
  {
    id: "stage3",
    label: "Lighting & Wiring",
    description: "Installing LED modules and electrical wiring",
  },
  {
    id: "stage4",
    label: "Quality Check",
    description: "Final inspection and quality assurance",
  },
];

/** Old camelCase column ids → stageN */
const ID_ALIASES: Record<string, string> = {
  procurementOfMaterials: "stage1",
  acpAndAcrylicCutting: "stage2",
  lightingAndWiring: "stage3",
  qualityCheck: "stage4",
};

function slugifyId(label: string): string {
  const base = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
  return base || `step_${Date.now()}`;
}

function canonicalizeItemId(id: string): string {
  return ID_ALIASES[id] || id;
}

export function normalizeProductionChecklistItems(
  raw: unknown
): ProductionChecklistItem[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    return DEFAULT_PRODUCTION_CHECKLIST_ITEMS.map((item) => ({ ...item }));
  }

  const seen = new Set<string>();
  const items: ProductionChecklistItem[] = [];

  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const row = entry as Record<string, unknown>;
    const label = String(row.label || "").trim();
    if (!label) continue;
    let id = canonicalizeItemId(String(row.id || "").trim() || slugifyId(label));
    if (seen.has(id)) id = `${id}_${items.length + 1}`;
    seen.add(id);
    items.push({
      id,
      label,
      description: String(row.description || "").trim(),
    });
  }

  return items.length > 0
    ? items
    : DEFAULT_PRODUCTION_CHECKLIST_ITEMS.map((item) => ({ ...item }));
}

export function createProductionChecklistItemId(
  label: string,
  existingIds: string[]
): string {
  // Prefer unused stage1–stage4 slots for the first four milestones
  for (const stageId of STAGE_COLUMN_IDS) {
    if (!existingIds.includes(stageId)) return stageId;
  }
  let id = slugifyId(label);
  if (!existingIds.includes(id)) return id;
  let n = 2;
  while (existingIds.includes(`${id}_${n}`)) n += 1;
  return `${id}_${n}`;
}

/** Resolve checkbox state from checklist jsonb, falling back to stage columns. */
export function resolveChecklistProgress(
  productionDetails: Record<string, unknown> | null | undefined,
  items: ProductionChecklistItem[]
): Record<string, boolean> {
  const pd = productionDetails || {};
  const fromJson =
    pd.checklist && typeof pd.checklist === "object" && !Array.isArray(pd.checklist)
      ? (pd.checklist as Record<string, unknown>)
      : {};

  const progress: Record<string, boolean> = {};
  items.forEach((item, index) => {
    const stageCol = index < 4 ? STAGE_COLUMN_IDS[index] : null;
    if (typeof fromJson[item.id] === "boolean") {
      progress[item.id] = fromJson[item.id] as boolean;
    } else if (typeof pd[item.id] === "boolean") {
      progress[item.id] = pd[item.id] as boolean;
    } else if (stageCol && typeof pd[stageCol] === "boolean") {
      progress[item.id] = pd[stageCol] as boolean;
    } else {
      progress[item.id] = false;
    }
  });
  return progress;
}

/**
 * Build productions update payload:
 * - checklist jsonb (all items)
 * - stage1–stage4 columns for the first four milestones (by order)
 */
export function buildProductionChecklistUpdate(
  progress: Record<string, boolean>,
  items: ProductionChecklistItem[] = DEFAULT_PRODUCTION_CHECKLIST_ITEMS,
  extra: Record<string, unknown> = {}
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    checklist: progress,
    ...extra,
  };
  items.slice(0, 4).forEach((item, index) => {
    payload[STAGE_COLUMN_IDS[index]] = !!progress[item.id];
  });
  return payload;
}
