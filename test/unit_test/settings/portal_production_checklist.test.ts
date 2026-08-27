import { describe, expect, it } from "vitest";
import {
  CUSTOM_CHECKLIST_META_KEY,
  DEFAULT_PRODUCTION_CHECKLIST_ITEMS,
  portalProductionChecklistRows,
  readCustomProductionChecklistItems,
} from "@/features/settings/productionChecklist";

describe("portal production checklist", () => {
  it("includes floor-added Extra items after template milestones", () => {
    const pd = {
      checklist: {
        stage1: true,
        stage2: false,
        custom_1: true,
        [CUSTOM_CHECKLIST_META_KEY]: [{ id: "custom_1", label: "hi" }],
      },
    };

    expect(readCustomProductionChecklistItems(pd)).toEqual([
      { id: "custom_1", label: "hi", checked: true },
    ]);

    const rows = portalProductionChecklistRows(
      pd,
      DEFAULT_PRODUCTION_CHECKLIST_ITEMS
    );
    expect(rows).toHaveLength(DEFAULT_PRODUCTION_CHECKLIST_ITEMS.length + 1);
    expect(rows[0]).toMatchObject({
      id: "stage1",
      label: "Procurement of Materials",
      done: true,
      extra: false,
    });
    expect(rows[rows.length - 1]).toEqual({
      id: "custom_1",
      label: "hi",
      done: true,
      extra: true,
    });
  });

  it("returns only template rows when no extras exist", () => {
    const rows = portalProductionChecklistRows(
      { checklist: { stage1: true } },
      DEFAULT_PRODUCTION_CHECKLIST_ITEMS.slice(0, 2)
    );
    expect(rows.every((r) => !r.extra)).toBe(true);
    expect(rows).toHaveLength(2);
  });
});
