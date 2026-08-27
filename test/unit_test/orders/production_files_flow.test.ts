import { describe, expect, it } from "vitest";
import {
  shouldPersistLinkAfterUpload,
  stageLifecycle,
  appendProductionFiles,
  removeProductionFileById,
  planProductionFileDelete,
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
import { toCustomerVisibleDesign } from "@/features/designs/utils/customerVisibleDesign";
import type { DesignRecord } from "@/types";

/**
 * Production files pipeline:
 * Designer uploads after design approval → production-files bucket (TUS, 6MB chunks)
 * → designs.items[].productionFiles[].url → staff download via signed read
 * → customer never sees production files (stripped by toCustomerVisibleDesign)
 */

const ORDER = "11111111-1111-1111-1111-111111111111";
const MAX_BYTES = configForPurpose("production_asset").maxBytes;

function prodRef(name: string) {
  return toStoredRef("production-files", `${ORDER}/${name}`);
}

describe("production asset lifecycle", () => {
  it("persists to designs.items[].productionFiles immediately after upload", () => {
    expect(shouldPersistLinkAfterUpload("production_asset")).toBe(true);
    expect(stageLifecycle("production_asset")).toMatchObject({
      bucket: "production-files",
      persistMode: "immediate_after_upload",
      dbTarget: { table: "designs", field: "items[].productionFiles[].url" },
      deleteOrder: "db_then_storage",
      cleansStorageOnDelete: true,
    });
  });

  it("uses the production pipeline with 100MB limit", () => {
    expect(configForPurpose("production_asset").pipeline).toBe("production");
    expect(configForPurpose("production_asset").maxBytes).toBe(100 * 1024 * 1024);
  });

  it("uses a private bucket (signed read for download)", () => {
    expect(isPublicBucket("production-files")).toBe(false);
  });
});

describe("production file validation", () => {
  it("accepts all fabrication formats", () => {
    const formats = [
      { fileName: "artwork.ai", mime: "application/octet-stream", size: 40_000_000 },
      { fileName: "vector.eps", mime: "application/postscript", size: 20_000_000 },
      { fileName: "layout.psd", mime: "application/octet-stream", size: 80_000_000 },
      { fileName: "corel.cdr", mime: "application/octet-stream", size: 30_000_000 },
      { fileName: "cut.dxf", mime: "application/octet-stream", size: 5_000_000 },
      { fileName: "plot.plt", mime: "application/octet-stream", size: 8_000_000 },
      { fileName: "bundle.zip", mime: "application/zip", size: 50_000_000 },
      { fileName: "bundle2.zip", mime: "application/x-zip-compressed", size: 50_000_000 },
      { fileName: "doc.pdf", mime: "application/pdf", size: 15_000_000 },
      { fileName: "mark.svg", mime: "image/svg+xml", size: 2_000_000 },
      { fileName: "preview.png", mime: "image/png", size: 1_000_000 },
      { fileName: "preview.jpg", mime: "image/jpeg", size: 1_000_000 },
      { fileName: "preview.webp", mime: "image/webp", size: 500_000 },
    ];
    for (const f of formats) {
      expect(validateUploadForPurpose("production_asset", f).ok).toBe(true);
    }
  });

  it("accepts at the exact 100MB boundary", () => {
    expect(
      validateUploadForPurpose("production_asset", {
        fileName: "huge.ai",
        size: MAX_BYTES,
        mime: "application/octet-stream",
      }).ok
    ).toBe(true);
  });

  it("rejects files over 100MB", () => {
    const r = validateUploadForPurpose("production_asset", {
      fileName: "too-big.ai",
      size: MAX_BYTES + 1,
      mime: "application/octet-stream",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("file_size");
  });

  it("rejects empty files", () => {
    const r = validateUploadForPurpose("production_asset", {
      fileName: "empty.ai",
      size: 0,
      mime: "application/octet-stream",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("file_empty");
  });

  it("rejects disallowed types (video, exe, docx)", () => {
    for (const f of [
      { fileName: "clip.mp4", mime: "video/mp4", size: 1024 },
      { fileName: "malware.exe", mime: "application/x-msdownload", size: 1024 },
      { fileName: "notes.docx", mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", size: 1024 },
      { fileName: "page.html", mime: "text/html", size: 1024 },
    ]) {
      const r = validateUploadForPurpose("production_asset", f);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.reason).toBe("file_type");
    }
  });

  it("accepts by extension when MIME is generic (octet-stream)", () => {
    expect(
      validateUploadForPurpose("production_asset", {
        fileName: "artwork.dxf",
        size: 5_000_000,
        mime: "application/octet-stream",
      }).ok
    ).toBe(true);
    expect(
      validateUploadForPurpose("production_asset", {
        fileName: "plot.plt",
        size: 5_000_000,
        mime: "application/octet-stream",
      }).ok
    ).toBe(true);
  });
});

describe("TUS resumable upload chunking", () => {
  it("uses 6MB chunks required by Supabase", () => {
    expect(TUS_CHUNK_SIZE).toBe(6 * 1024 * 1024);
  });

  it("chunks a 100MB file into 17 parts", () => {
    expect(chunkBytes(100 * 1024 * 1024, TUS_CHUNK_SIZE)).toBe(17);
  });

  it("chunks a 6MB file into 1 part (boundary)", () => {
    expect(chunkBytes(6 * 1024 * 1024, TUS_CHUNK_SIZE)).toBe(1);
  });

  it("chunks a 6MB+1 file into 2 parts", () => {
    expect(chunkBytes(6 * 1024 * 1024 + 1, TUS_CHUNK_SIZE)).toBe(2);
  });

  it("handles zero-size gracefully", () => {
    expect(chunkBytes(0, TUS_CHUNK_SIZE)).toBe(0);
  });
});

describe("production file path generation", () => {
  it("builds order-scoped paths with extension", () => {
    const path = buildOrderObjectPath(ORDER, "ai");
    expect(path).toMatch(new RegExp(`^${ORDER}/\\d+-[a-z0-9]+\\.ai$`));
    expect(isValidOrderScopedPath(ORDER, path)).toBe(true);
  });

  it("derives extensions from name or mime", () => {
    expect(extFromNameOrMime("artwork.AI")).toBe("ai");
    expect(extFromNameOrMime("noext", "application/pdf")).toBe("pdf");
    expect(extFromNameOrMime("noext", "image/jpeg")).toBe("jpg");
    expect(extFromNameOrMime("noext")).toBe("bin");
  });

  it("rejects traversal in paths", () => {
    expect(isValidOrderScopedPath(ORDER, `${ORDER}/../x.ai`)).toBe(false);
    expect(isValidOrderScopedPath("not-a-uuid", `${ORDER}/x.ai`)).toBe(false);
  });
});

describe("production file append / delete", () => {
  it("appends without clobbering existing files", () => {
    const existing = [{ id: "pf-1", name: "old.ai", url: prodRef("old.ai"), createdAt: "2026-01-01" }];
    const uploaded = [{ id: "pf-2", name: "new.pdf", url: prodRef("new.pdf"), createdAt: "2026-01-02" }];
    const files = appendProductionFiles(existing, uploaded);
    expect(files.map((f) => f.id)).toEqual(["pf-1", "pf-2"]);
  });

  it("delete removes from list and plans storage cleanup", () => {
    const files = [
      { id: "pf-1", name: "a.ai", url: prodRef("a.ai"), createdAt: "2026-01-01" },
      { id: "pf-2", name: "b.pdf", url: prodRef("b.pdf"), createdAt: "2026-01-02" },
    ];
    const { remaining, removed } = removeProductionFileById(files, "pf-1");
    expect(remaining.map((f) => f.id)).toEqual(["pf-2"]);
    expect(removed?.id).toBe("pf-1");
    expect(planProductionFileDelete(removed)).toEqual({
      updateDb: true,
      storage: { bucket: "production-files", path: `${ORDER}/a.ai` },
    });
  });

  it("delete unknown id returns no removed file", () => {
    const files = [{ id: "pf-1", name: "a.ai", url: prodRef("a.ai"), createdAt: "2026-01-01" }];
    const { remaining, removed } = removeProductionFileById(files, "missing");
    expect(remaining).toEqual(files);
    expect(removed).toBeUndefined();
    expect(planProductionFileDelete(removed)).toEqual({ updateDb: true, storage: null });
  });

  it("parses both modern refs and legacy URLs for delete", () => {
    const modern = prodRef("final.ai");
    const legacy = `https://xyz.supabase.co/storage/v1/object/public/production-files/${ORDER}/final.ai`;
    expect(planStorageDelete(modern)).toEqual(planStorageDelete(legacy));
  });
});

describe("customer visibility (production files are staff-only)", () => {
  it("strips productionFiles from all items in customer-visible design", () => {
    const design: DesignRecord = {
      id: "d1",
      order_id: ORDER,
      resources: [],
      items: [
        {
          id: "item-1",
          name: "Sign",
          currentVersion: 1,
          versions: [
            { id: "v1", versionNumber: 1, proofUrl: "design-proofs/x/v1.png", fileName: "v1.png", status: "Approved", comments: [], createdAt: "2026-01-01" },
          ],
          productionFiles: [
            { id: "pf-1", name: "final.ai", url: prodRef("final.ai"), createdAt: "2026-01-02" },
            { id: "pf-2", name: "cut.dxf", url: prodRef("cut.dxf"), createdAt: "2026-01-03" },
          ],
          designFiles: [
            { id: "df-1", name: "source.cdr", url: "design-files/x/source.cdr", createdAt: "2026-01-02" },
          ],
          designFilesReady: true,
        },
      ],
      created_at: "2026-01-01",
      updated_at: "2026-01-01",
    };

    const visible = toCustomerVisibleDesign(design)!;
    expect(visible.items[0].productionFiles).toBeUndefined();
    expect(visible.items[0].designFiles).toBeUndefined();
    expect(visible.items[0].designFilesReady).toBeUndefined();
    // Versions are still visible (Approved is customer-visible).
    expect(visible.items[0].versions).toHaveLength(1);
  });
});

describe("storage rollback on DB failure (production uploads)", () => {
  it("plans delete for every uploaded ref when DB write fails", () => {
    const uploaded = [
      { bucket: "production-files", path: `${ORDER}/final.ai` },
      { bucket: "production-files", path: `${ORDER}/cut.dxf` },
    ];
    const refsToDelete = uploaded.map((o) => toStoredRef(o.bucket, o.path));
    expect(refsToDelete).toEqual([
      `production-files/${ORDER}/final.ai`,
      `production-files/${ORDER}/cut.dxf`,
    ]);
    for (const ref of refsToDelete) {
      expect(planStorageDelete(ref)?.bucket).toBe("production-files");
    }
  });
});

describe("delete error handling (DB succeeds, storage cleanup fails)", () => {
  it("DB write removes the record; storage cleanup is best-effort", () => {
    const files = [
      { id: "pf-1", name: "final.ai", url: prodRef("final.ai"), createdAt: "2026-01-01" },
    ];
    const { remaining, removed } = removeProductionFileById(files, "pf-1");
    // DB write would use `remaining` (empty) — succeeds.
    expect(remaining).toEqual([]);
    // Storage cleanup uses `removed` — may fail but DB is already committed.
    const plan = planProductionFileDelete(removed);
    expect(plan.updateDb).toBe(true);
    expect(plan.storage).toEqual({ bucket: "production-files", path: `${ORDER}/final.ai` });
    // Even if deleteStorageFilesAction throws, the DB record is gone.
    // The UI no longer shows the file; the storage object is orphaned (acceptable).
  });
});
