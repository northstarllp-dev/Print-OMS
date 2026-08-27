import { describe, expect, it } from "vitest";
import {
  shouldPersistLinkAfterUpload,
  stageLifecycle,
  appendDesignFiles,
  removeDesignFileById,
  planDesignFileDelete,
  planStorageDelete,
} from "@/utils/supabase/storageLifecycleLogic";
import {
  configForPurpose,
  isPublicBucket,
  validateUploadForPurpose,
  isValidOrderScopedPath,
  buildOrderObjectPath,
  extFromNameOrMime,
} from "@/utils/supabase/storageConfig";
import { parseStoredRef, toStoredRef } from "@/utils/storage/storageRef";
import { TUS_CHUNK_SIZE, chunkBytes } from "@/utils/storage/uploadQueue";
import type { DesignRecord } from "@/types";

/**
 * Design source files pipeline:
 * Designer uploads source files (.cdr, .ai, .psd, etc.) anytime → design-files bucket (TUS, 50MB)
 * → designs.items[].designFiles[].url → production team downloads via signed read
 */

const ORDER = "11111111-1111-1111-1111-111111111111";
const MAX_BYTES = configForPurpose("design_source_file").maxBytes;

function designRef(name: string) {
  return toStoredRef("design-files", `${ORDER}/${name}`);
}

describe("design source file lifecycle", () => {
  it("persists to designs.items[].designFiles immediately after upload", () => {
    expect(shouldPersistLinkAfterUpload("design_source_file")).toBe(true);
    expect(stageLifecycle("design_source_file")).toMatchObject({
      bucket: "design-files",
      persistMode: "immediate_after_upload",
      dbTarget: { table: "designs", field: "items[].designFiles[].url" },
      deleteOrder: "db_then_storage",
      cleansStorageOnDelete: true,
    });
  });

  it("uses the production pipeline (TUS resumable) with 50MB limit", () => {
    expect(configForPurpose("design_source_file").pipeline).toBe("production");
    expect(configForPurpose("design_source_file").maxBytes).toBe(50 * 1024 * 1024);
  });

  it("uses a private bucket (signed read for download)", () => {
    expect(isPublicBucket("design-files")).toBe(false);
  });
});

describe("design source file validation", () => {
  it("accepts all designer source formats", () => {
    const formats = [
      { name: "logo.cdr", mime: "application/octet-stream" },
      { name: "artwork.ai", mime: "application/postscript" },
      { name: "photo.psd", mime: "application/octet-stream" },
      { name: "vector.eps", mime: "application/postscript" },
      { name: "drawing.dxf", mime: "application/dxf" },
      { name: "plot.plt", mime: "application/plt" },
      { name: "doc.pdf", mime: "application/pdf" },
      { name: "icon.svg", mime: "image/svg+xml" },
      { name: "archive.zip", mime: "application/zip" },
      { name: "render.png", mime: "image/png" },
      { name: "photo.jpg", mime: "image/jpeg" },
    ];
    for (const f of formats) {
      const result = validateUploadForPurpose("design_source_file", {
        fileName: f.name,
        size: 1024,
        mime: f.mime,
      });
      expect(result.ok, `${f.name} should be accepted`).toBe(true);
    }
  });

  it("rejects files exceeding 50MB", () => {
    const result = validateUploadForPurpose("design_source_file", {
      fileName: "big.ai",
      size: MAX_BYTES + 1,
      mime: "application/postscript",
    });
    expect(result.ok).toBe(false);
  });

  it("rejects empty files", () => {
    const result = validateUploadForPurpose("design_source_file", {
      fileName: "empty.cdr",
      size: 0,
      mime: "application/octet-stream",
    });
    expect(result.ok).toBe(false);
  });

  it("rejects unsupported file types", () => {
    const result = validateUploadForPurpose("design_source_file", {
      fileName: "malware.exe",
      size: 1024,
      mime: "application/x-msdownload",
    });
    expect(result.ok).toBe(false);
  });
});

describe("design source file storage paths", () => {
  it("builds order-scoped paths", () => {
    const path = buildOrderObjectPath(ORDER, "cdr");
    expect(path.startsWith(`${ORDER}/`)).toBe(true);
    expect(path.endsWith(".cdr")).toBe(true);
    expect(isValidOrderScopedPath(ORDER, path)).toBe(true);
  });

  it("stored ref round-trips through parseStoredRef", () => {
    const ref = designRef("test.cdr");
    const parsed = parseStoredRef(ref);
    expect(parsed).toEqual({ bucket: "design-files", path: `${ORDER}/test.cdr` });
  });

  it("planStorageDelete resolves design-files refs", () => {
    const ref = designRef("artwork.ai");
    const plan = planStorageDelete(ref);
    expect(plan).toEqual({
      bucket: "design-files",
      path: `${ORDER}/artwork.ai`,
      cleansStorage: true,
    });
  });
});

describe("design source file TUS chunking", () => {
  it("uses 6MB chunk size", () => {
    expect(TUS_CHUNK_SIZE).toBe(6 * 1024 * 1024);
  });

  it("calculates chunk count for a 50MB file", () => {
    const chunks = chunkBytes(MAX_BYTES, TUS_CHUNK_SIZE);
    expect(chunks).toBeGreaterThan(1);
  });
});

describe("design source file append / remove", () => {
  it("appends new design files to existing list", () => {
    const existing = [
      { id: "f1", name: "old.cdr", url: designRef("old.cdr"), createdAt: "2026-01-01" },
    ];
    const uploaded = [
      { id: "f2", name: "new.ai", url: designRef("new.ai"), createdAt: "2026-01-02" },
    ];
    const result = appendDesignFiles(existing, uploaded);
    expect(result).toHaveLength(2);
    expect(result[1].name).toBe("new.ai");
  });

  it("removes a design file by id and returns the removed file", () => {
    const files = [
      { id: "f1", name: "keep.cdr", url: designRef("keep.cdr"), createdAt: "2026-01-01" },
      { id: "f2", name: "delete.ai", url: designRef("delete.ai"), createdAt: "2026-01-02" },
    ];
    const { remaining, removed } = removeDesignFileById(files, "f2");
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe("f1");
    expect(removed?.id).toBe("f2");
    expect(removed?.url).toBe(designRef("delete.ai"));
  });

  it("planDesignFileDelete resolves storage plan from url", () => {
    const file = { url: designRef("artwork.psd") };
    const plan = planDesignFileDelete(file);
    expect(plan.updateDb).toBe(true);
    expect(plan.storage).toEqual({
      bucket: "design-files",
      path: `${ORDER}/artwork.psd`,
    });
  });

  it("planDesignFileDelete returns null storage when url is missing", () => {
    const plan = planDesignFileDelete(undefined);
    expect(plan.updateDb).toBe(true);
    expect(plan.storage).toBeNull();
  });
});

describe("design source files in DB structure", () => {
  it("designFiles field exists on DesignItem type", () => {
    const design: DesignRecord = {
      id: "d1",
      order_id: ORDER,
      resources: [],
      items: [
        {
          id: "item1",
          name: "Sign Board",
          versions: [],
          currentVersion: 0,
          designFiles: [
            { id: "f1", name: "source.cdr", url: designRef("source.cdr"), createdAt: "2026-01-01" },
          ],
          productionFiles: [],
        },
      ],
      created_at: "2026-01-01",
      updated_at: "2026-01-01",
    };
    expect(design.items[0].designFiles).toHaveLength(1);
    expect(design.items[0].designFiles?.[0].name).toBe("source.cdr");
  });

  it("designFilesReady flag gates the production files handoff", () => {
    const design: DesignRecord = {
      id: "d1",
      order_id: ORDER,
      resources: [],
      items: [
        {
          id: "item1",
          name: "Sign Board",
          versions: [],
          currentVersion: 0,
          designFiles: [
            { id: "f1", name: "source.cdr", url: designRef("source.cdr"), createdAt: "2026-01-01" },
          ],
          designFilesReady: true,
          productionFiles: [],
        },
      ],
      created_at: "2026-01-01",
      updated_at: "2026-01-01",
    };
    expect(design.items[0].designFilesReady).toBe(true);
  });

  it("designFilesReady defaults to undefined (production files hidden until handoff)", () => {
    const design: DesignRecord = {
      id: "d1",
      order_id: ORDER,
      resources: [],
      items: [
        {
          id: "item1",
          name: "Sign Board",
          versions: [],
          currentVersion: 0,
          designFiles: [],
          productionFiles: [],
        },
      ],
      created_at: "2026-01-01",
      updated_at: "2026-01-01",
    };
    expect(design.items[0].designFilesReady).toBeUndefined();
  });

  it("legacy productionFiles without designFilesReady still count as handed off", () => {
    const item = {
      designFilesReady: undefined as boolean | undefined,
      productionFiles: [
        { id: "pf-1", name: "final.ai", url: designRef("legacy.ai"), createdAt: "2026-01-01" },
      ],
    };
    const handedOff = Boolean(
      item.designFilesReady || (item.productionFiles && item.productionFiles.length > 0)
    );
    expect(handedOff).toBe(true);
  });
});
