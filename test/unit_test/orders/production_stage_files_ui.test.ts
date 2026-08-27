import { describe, expect, it } from "vitest";
import { fileExtensionLabel, productionStageFileItems } from "@/features/orders/workspace/modules/production/productionFilesUi";

describe("productionStageFileItems", () => {
  it("shows each design item with both file groups even if one side is empty", () => {
    const items = [
      {
        id: "a",
        name: "Sign A",
        versions: [{ id: "v1" }],
        designFiles: [{ id: "d1", name: "a.cdr" }],
        productionFiles: [],
      },
      {
        id: "b",
        name: "Sign B",
        versions: [{ id: "v2" }],
        designFiles: [],
        productionFiles: [{ id: "p1", name: "b.ai" }],
      },
    ];
    const shown = productionStageFileItems(items);
    expect(shown.map((i) => i.id)).toEqual(["a", "b"]);
    expect(shown[0].designFiles).toHaveLength(1);
    expect(shown[0].productionFiles).toHaveLength(0);
    expect(shown[1].designFiles).toHaveLength(0);
    expect(shown[1].productionFiles).toHaveLength(1);
  });

  it("drops empty site-visit stubs with no proofs and no files", () => {
    const items = [
      { id: "stub", name: "Unused location", versions: [], designFiles: [], productionFiles: [] },
      { id: "real", name: "Board", versions: [{ id: "v1" }], designFiles: [], productionFiles: [] },
    ];
    expect(productionStageFileItems(items).map((i) => i.id)).toEqual(["real"]);
  });

  it("keeps an item that only has design source files", () => {
    const items = [
      { id: "only-design", versions: [], designFiles: [{ id: "d1" }], productionFiles: [] },
    ];
    expect(productionStageFileItems(items)).toHaveLength(1);
  });
});

describe("fileExtensionLabel", () => {
  it("returns the uppercase extension", () => {
    expect(fileExtensionLabel("artwork.cdr")).toBe("CDR");
    expect(fileExtensionLabel("print.AI")).toBe("AI");
  });

  it("returns FILE when the name has no extension", () => {
    expect(fileExtensionLabel("untitled")).toBe("FILE");
    expect(fileExtensionLabel(undefined)).toBe("FILE");
  });
});
