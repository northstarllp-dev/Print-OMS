import { describe, expect, it } from "vitest";
import {
  LARGE_FILE_MAX_BYTES,
  STAGE_FILE_MAX_DOWNLOADS,
  STAGE_ITEM_TOTAL_MAX_BYTES,
  stageFileErrors,
  sumStageFileBytes,
  validateUploadForPurpose,
  wouldExceedItemTotal,
} from "@/utils/supabase/storageConfig";

describe("stage file limits", () => {
  it("uses 250 MB per file for design source and production", () => {
    expect(LARGE_FILE_MAX_BYTES).toBe(250 * 1024 * 1024);
    expect(validateUploadForPurpose("production_asset", {
      fileName: "big.cdr",
      size: LARGE_FILE_MAX_BYTES,
      mime: "application/octet-stream",
    }).ok).toBe(true);
    expect(validateUploadForPurpose("design_source_file", {
      fileName: "big.ai",
      size: LARGE_FILE_MAX_BYTES + 1,
      mime: "application/octet-stream",
    }).ok).toBe(false);
  });

  it("sums design + production bytes per item", () => {
    const item = {
      designFiles: [{ id: "1", name: "a.cdr", url: "x", createdAt: "", sizeBytes: 100 * 1024 * 1024 }],
      productionFiles: [{ id: "2", name: "b.ai", url: "y", createdAt: "", sizeBytes: 200 * 1024 * 1024 }],
    };
    expect(sumStageFileBytes(item)).toBe(300 * 1024 * 1024);
    expect(wouldExceedItemTotal(item, 250 * 1024 * 1024)).toBe(true);
    expect(wouldExceedItemTotal(item, 200 * 1024 * 1024)).toBe(false);
  });

  it("allows up to 500 MB total per item", () => {
    expect(STAGE_ITEM_TOTAL_MAX_BYTES).toBe(500 * 1024 * 1024);
  });

  it("caps downloads at 2 per file", () => {
    expect(STAGE_FILE_MAX_DOWNLOADS).toBe(2);
  });
});

describe("stageFileErrors", () => {
  it("fileTooLarge includes file name and 250 MB limit", () => {
    const msg = stageFileErrors.fileTooLarge("signage.cdr", 312);
    expect(msg).toContain("signage.cdr");
    expect(msg).toContain("312 MB");
    expect(msg).toContain("250 MB");
  });

  it("itemTotalExceeded includes item, file, and used sizes", () => {
    const msg = stageFileErrors.itemTotalExceeded({
      itemName: "Main Board",
      usedMb: 900,
      fileName: "final.ai",
      fileMb: 180,
    });
    expect(msg).toContain("Main Board");
    expect(msg).toContain("final.ai");
    expect(msg).toContain("900 MB");
    expect(msg).toContain("180 MB");
    expect(msg).toContain("500 MB");
  });

  it("downloadLimitReached shows 2 of 2", () => {
    const msg = stageFileErrors.downloadLimitReached("source.cdr");
    expect(msg).toContain("source.cdr");
    expect(msg).toContain("2 of 2");
  });

  it("itemAtCapacity mentions 500 MB", () => {
    expect(stageFileErrors.itemAtCapacity("Board A")).toContain("500 MB");
    expect(stageFileErrors.itemAtCapacity("Board A")).toContain("Board A");
  });

  it("fileTypeNotAllowed lists allowed extensions", () => {
    const msg = stageFileErrors.fileTypeNotAllowed("virus.exe");
    expect(msg).toContain("virus.exe");
    expect(msg).toContain(".cdr");
  });

  it("fileEmpty mentions empty file", () => {
    expect(stageFileErrors.fileEmpty("empty.ai")).toContain("empty");
  });
});

describe("validateUploadForPurpose stage messages", () => {
  it("returns clear message for oversize production file", () => {
    const r = validateUploadForPurpose("production_asset", {
      fileName: "huge.cdr",
      size: 260 * 1024 * 1024,
      mime: "application/octet-stream",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.message).toContain("huge.cdr");
      expect(r.message).toContain("250 MB");
    }
  });

  it("returns clear message for disallowed stage file type", () => {
    const r = validateUploadForPurpose("design_source_file", {
      fileName: "bad.exe",
      size: 1024,
      mime: "application/x-msdownload",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.message).toContain("bad.exe");
      expect(r.message).toContain(".cdr");
    }
  });
});
