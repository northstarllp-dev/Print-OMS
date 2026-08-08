export type ProductionChecklistItem = {
  id: string;
  label: string;
  description: string;
};

/** Checklist items keyed by business operation id (signage, flex_printing, …). */
export type ProductionChecklistsByOp = Record<string, ProductionChecklistItem[]>;

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

export const DEFAULT_FLEX_PRINTING_CHECKLIST_ITEMS: ProductionChecklistItem[] = [
  {
    id: "stage1",
    label: "Print File Ready",
    description: "Artwork approved and print-ready file prepared",
  },
  {
    id: "stage2",
    label: "Media Loading & Printing",
    description: "Load flex/vinyl and complete print run",
  },
  {
    id: "stage3",
    label: "Lamination & Finishing",
    description: "Lamination, cutting, eyelets, or other finishing",
  },
  {
    id: "stage4",
    label: "Quality Check & Packing",
    description: "Final inspection and packing for dispatch",
  },
];

export const DEFAULT_PRODUCTION_CHECKLISTS_BY_OP: ProductionChecklistsByOp = {
  signage: DEFAULT_PRODUCTION_CHECKLIST_ITEMS.map((item) => ({ ...item })),
  flex_printing: DEFAULT_FLEX_PRINTING_CHECKLIST_ITEMS.map((item) => ({ ...item })),
};

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

function cloneItems(items: ProductionChecklistItem[]): ProductionChecklistItem[] {
  return items.map((item) => ({ ...item }));
}

export function normalizeProductionChecklistItems(
  raw: unknown
): ProductionChecklistItem[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    return cloneItems(DEFAULT_PRODUCTION_CHECKLIST_ITEMS);
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
    : cloneItems(DEFAULT_PRODUCTION_CHECKLIST_ITEMS);
}

function defaultItemsForOp(opId: string): ProductionChecklistItem[] {
  const fromDefaults = DEFAULT_PRODUCTION_CHECKLISTS_BY_OP[opId];
  if (fromDefaults?.length) return cloneItems(fromDefaults);
  return cloneItems(DEFAULT_PRODUCTION_CHECKLIST_ITEMS);
}

/**
 * Normalize DB jsonb which may be:
 * - legacy array → applied as the shared/default checklist for all ops
 * - object map of opId → items[]
 */
export function normalizeProductionChecklistsByOp(
  raw: unknown,
  opIds: string[] = Object.keys(DEFAULT_PRODUCTION_CHECKLISTS_BY_OP)
): ProductionChecklistsByOp {
  const ids = opIds.length > 0 ? opIds : ["signage"];
  const result: ProductionChecklistsByOp = {};

  if (Array.isArray(raw)) {
    const shared = normalizeProductionChecklistItems(raw);
    for (const opId of ids) {
      // Legacy single list was the signage workshop checklist — keep other ops on their defaults.
      result[opId] =
        opId === "signage" || ids.length === 1
          ? cloneItems(shared)
          : defaultItemsForOp(opId);
    }
    return result;
  }

  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const map = raw as Record<string, unknown>;
    for (const opId of ids) {
      if (opId in map) {
        result[opId] = normalizeProductionChecklistItems(map[opId]);
      } else {
        result[opId] = defaultItemsForOp(opId);
      }
    }
    // Preserve any extra op keys already stored
    for (const key of Object.keys(map)) {
      if (!(key in result)) {
        result[key] = normalizeProductionChecklistItems(map[key]);
      }
    }
    return result;
  }

  for (const opId of ids) {
    result[opId] = defaultItemsForOp(opId);
  }
  return result;
}

export function getChecklistForBusinessOp(
  byOp: ProductionChecklistsByOp | ProductionChecklistItem[] | null | undefined,
  businessOperationId?: string | null
): ProductionChecklistItem[] {
  const opId = (businessOperationId || "signage").trim() || "signage";

  if (Array.isArray(byOp)) {
    return normalizeProductionChecklistItems(byOp);
  }

  if (byOp && typeof byOp === "object") {
    if (byOp[opId]?.length) return cloneItems(byOp[opId]);
    if (byOp.signage?.length) return cloneItems(byOp.signage);
  }

  return defaultItemsForOp(opId);
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
  productionDetails: object | null | undefined,
  items: ProductionChecklistItem[]
): Record<string, boolean> {
  const pd = (productionDetails || {}) as Record<string, unknown>;
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

/** True when every workshop checklist milestone is checked. */
export function isProductionChecklistComplete(
  productionDetails: object | null | undefined,
  items: ProductionChecklistItem[] = DEFAULT_PRODUCTION_CHECKLIST_ITEMS
): boolean {
  if (!items.length) return false;
  const progress = resolveChecklistProgress(productionDetails, items);
  return items.every((item) => !!progress[item.id]);
}

export function productionChecklistAdvanceGate(
  productionDetails: object | null | undefined,
  items: ProductionChecklistItem[] = DEFAULT_PRODUCTION_CHECKLIST_ITEMS
): { ok: boolean; tooltip: string } {
  const ok = isProductionChecklistComplete(productionDetails, items);
  return {
    ok,
    tooltip: ok
      ? ""
      : "Complete all workshop production checklist items before requesting approval.",
  };
}
