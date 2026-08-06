import { describe, expect, it } from "vitest";
import {
  shouldPersistLinkAfterUpload,
  stageLifecycle,
  appendProofVersion,
  removeProofVersionById,
  planStorageDelete,
  removeProductionFileById,
  planProductionFileDelete,
  appendProductionFiles,
} from "@/utils/supabase/storageLifecycleLogic";
import {
  configForPurpose,
  isPublicBucket,
  validateUploadForPurpose,
} from "@/utils/supabase/storageConfig";
import { parseStoredRef, toStoredRef } from "@/utils/storage/storageRef";
import { toCustomerVisibleDesign } from "@/features/designs/utils/customerVisibleDesign";
import type { DesignRecord, DesignVersion } from "@/types";

/**
 * Designer → Customer proof flow:
 * Staff uploads proof → design-proofs bucket → designs.items[].versions[].proofUrl
 * → "Send to Customer" flips Draft → "Sent to Customer"
 * → customer portal sees it (toCustomerVisibleDesign strips Draft/Pending Admin)
 * → customer views / downloads / approves
 */

const ORDER = "11111111-1111-1111-1111-111111111111";

function proofRef(name: string) {
  return toStoredRef("design-proofs", `${ORDER}/${name}`);
}

function makeVersion(overrides: Partial<DesignVersion> = {}): DesignVersion {
  return {
    id: crypto.randomUUID(),
    versionNumber: 1,
    proofUrl: proofRef("v1.png"),
    fileName: "v1.png",
    status: "Draft",
    comments: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("design proof lifecycle (designer → customer)", () => {
  it("persists the proof URL to designs.items immediately after upload", () => {
    expect(shouldPersistLinkAfterUpload("design_proof")).toBe(true);
    expect(stageLifecycle("design_proof")).toMatchObject({
      bucket: "design-proofs",
      persistMode: "immediate_after_upload",
      dbTarget: { table: "designs", field: "items[].versions[].proofUrl" },
      deleteOrder: "db_then_storage",
      cleansStorageOnDelete: true,
    });
  });

  it("uses the image pipeline and a private bucket", () => {
    expect(configForPurpose("design_proof").pipeline).toBe("image");
    expect(configForPurpose("design_proof").bucket).toBe("design-proofs");
    expect(isPublicBucket("design-proofs")).toBe(false);
  });
});

describe("design proof upload validation", () => {
  it("accepts images and PDF within 50MB", () => {
    for (const f of [
      { fileName: "proof.png", mime: "image/png", size: 2_000_000 },
      { fileName: "proof.jpg", mime: "image/jpeg", size: 5_000_000 },
      { fileName: "proof.webp", mime: "image/webp", size: 800_000 },
      { fileName: "proof.pdf", mime: "application/pdf", size: 10_000_000 },
    ]) {
      expect(validateUploadForPurpose("design_proof", f).ok).toBe(true);
    }
  });

  it("rejects oversize, empty, and disallowed types", () => {
    const max = configForPurpose("design_proof").maxBytes;
    expect(validateUploadForPurpose("design_proof", { fileName: "big.pdf", mime: "application/pdf", size: max + 1 }).ok).toBe(false);
    expect(validateUploadForPurpose("design_proof", { fileName: "x.png", mime: "image/png", size: 0 }).ok).toBe(false);
    expect(validateUploadForPurpose("design_proof", { fileName: "malware.exe", mime: "application/x-msdownload", size: 1024 }).ok).toBe(false);
    expect(validateUploadForPurpose("design_proof", { fileName: "clip.mp4", mime: "video/mp4", size: 1024 }).ok).toBe(false);
  });

  it("rejects production-only formats (ai, psd, cdr, zip) for proofs", () => {
    for (const ext of ["ai", "psd", "cdr", "zip"]) {
      const r = validateUploadForPurpose("design_proof", {
        fileName: `file.${ext}`,
        size: 1024,
        mime: "application/octet-stream",
      });
      expect(r.ok).toBe(false);
    }
  });
});

describe("proof version append / delete", () => {
  it("appends new versions without clobbering existing ones", () => {
    const v1 = makeVersion({ id: "v1", versionNumber: 1 });
    const v2 = makeVersion({ id: "v2", versionNumber: 2, proofUrl: proofRef("v2.png"), fileName: "v2.png" });
    const versions = appendProofVersion([v1], v2);
    expect(versions.map((v) => v.id)).toEqual(["v1", "v2"]);
    expect(versions[1].proofUrl).toBe(proofRef("v2.png"));
  });

  it("delete removes version from list and plans storage cleanup", () => {
    const v1 = makeVersion({ id: "v1", versionNumber: 1, proofUrl: proofRef("a.png"), fileName: "a.png" });
    const v2 = makeVersion({ id: "v2", versionNumber: 2, proofUrl: proofRef("b.png"), fileName: "b.png" });
    const remaining = removeProofVersionById([v1, v2], "v1");
    expect(remaining.map((v) => v.id)).toEqual(["v2"]);
    expect(planStorageDelete(v1.proofUrl)).toEqual({
      bucket: "design-proofs",
      path: `${ORDER}/a.png`,
      cleansStorage: true,
    });
  });

  it("deleting unknown id is a no-op", () => {
    const v1 = makeVersion({ id: "v1" });
    expect(removeProofVersionById([v1], "missing")).toEqual([v1]);
  });

  it("parses both modern refs and legacy public URLs for delete", () => {
    const modern = proofRef("v1.png");
    const legacy = `https://xyz.supabase.co/storage/v1/object/public/design-proofs/${ORDER}/v1.png`;
    expect(planStorageDelete(modern)).toEqual(planStorageDelete(legacy));
  });
});

describe("Send to Customer — status visibility", () => {
  it("Draft and Pending Admin are hidden from customer; Sent/Changes Requested/Approved visible", () => {
    const design: DesignRecord = {
      id: "d1",
      order_id: ORDER,
      resources: [],
      items: [{
        id: "item-1",
        name: "Sign",
        currentVersion: 3,
        versions: [
          makeVersion({ id: "v-draft", versionNumber: 1, status: "Draft" }),
          makeVersion({ id: "v-pending", versionNumber: 2, status: "Pending Admin" }),
          makeVersion({ id: "v-sent", versionNumber: 3, status: "Sent to Customer" }),
        ],
      }],
      created_at: "2026-01-01",
      updated_at: "2026-01-01",
    };

    const visible = toCustomerVisibleDesign(design)!;
    expect(visible.items[0].versions.map((v) => v.id)).toEqual(["v-sent"]);
  });

  it("customer sees Approved versions (can still view/download after approval)", () => {
    const design: DesignRecord = {
      id: "d1",
      order_id: ORDER,
      resources: [],
      items: [{
        id: "item-1",
        name: "Sign",
        currentVersion: 2,
        versions: [
          makeVersion({ id: "v-sent", versionNumber: 1, status: "Sent to Customer" }),
          makeVersion({ id: "v-approved", versionNumber: 2, status: "Approved" }),
        ],
      }],
      created_at: "2026-01-01",
      updated_at: "2026-01-01",
    };

    const visible = toCustomerVisibleDesign(design)!;
    expect(visible.items[0].versions.map((v) => v.id)).toEqual(["v-sent", "v-approved"]);
  });
});

describe("customer download / open of proof refs", () => {
  it("parseStoredRef resolves design-proofs refs for signed read", () => {
    const ref = proofRef("v1.png");
    const parsed = parseStoredRef(ref);
    expect(parsed).toEqual({ bucket: "design-proofs", path: `${ORDER}/v1.png` });
  });

  it("returns null for traversal and non-storage URLs", () => {
    expect(parseStoredRef("design-proofs/../x.png")).toBeNull();
    expect(parseStoredRef("https://cdn.example/x.png")).toBeNull();
    expect(parseStoredRef("")).toBeNull();
  });
});

describe("production files (designer upload after approval)", () => {
  it("persists to designs.items[].productionFiles immediately after upload", () => {
    expect(shouldPersistLinkAfterUpload("production_asset")).toBe(true);
    expect(stageLifecycle("production_asset").dbTarget).toEqual({
      table: "designs",
      field: "items[].productionFiles[].url",
    });
  });

  it("uses the production pipeline with 100MB limit and TUS", () => {
    expect(configForPurpose("production_asset").pipeline).toBe("production");
    expect(configForPurpose("production_asset").maxBytes).toBe(100 * 1024 * 1024);
  });

  it("accepts production formats (ai, eps, psd, cdr, zip, pdf, svg)", () => {
    for (const ext of ["ai", "eps", "psd", "cdr", "zip", "pdf", "svg", "png"]) {
      const r = validateUploadForPurpose("production_asset", {
        fileName: `file.${ext}`,
        size: 5_000_000,
        mime: "application/octet-stream",
      });
      expect(r.ok).toBe(true);
    }
  });

  it("appends production files without clobbering existing", () => {
    const existing = [{ id: "pf-1", name: "old.ai", url: "production-files/x/old.ai", createdAt: "2026-01-01" }];
    const uploaded = [{ id: "pf-2", name: "new.pdf", url: "production-files/x/new.pdf", createdAt: "2026-01-02" }];
    const files = appendProductionFiles(existing, uploaded);
    expect(files.map((f) => f.id)).toEqual(["pf-1", "pf-2"]);
  });

  it("delete removes from list and plans storage cleanup", () => {
    const files = [
      { id: "pf-1", name: "a.ai", url: toStoredRef("production-files", `${ORDER}/a.ai`), createdAt: "2026-01-01" },
      { id: "pf-2", name: "b.pdf", url: toStoredRef("production-files", `${ORDER}/b.pdf`), createdAt: "2026-01-02" },
    ];
    const { remaining, removed } = removeProductionFileById(files, "pf-1");
    expect(remaining.map((f) => f.id)).toEqual(["pf-2"]);
    expect(planProductionFileDelete(removed)).toEqual({
      updateDb: true,
      storage: { bucket: "production-files", path: `${ORDER}/a.ai` },
    });
  });

  it("production files are stripped from customer-visible design", () => {
    const design: DesignRecord = {
      id: "d1",
      order_id: ORDER,
      resources: [],
      items: [{
        id: "item-1",
        name: "Sign",
        currentVersion: 1,
        versions: [makeVersion({ id: "v1", status: "Approved" })],
        productionFiles: [{ id: "pf-1", name: "final.ai", url: "production-files/x/f.ai", createdAt: "2026-01-03" }],
      }],
      created_at: "2026-01-01",
      updated_at: "2026-01-01",
    };
    const visible = toCustomerVisibleDesign(design)!;
    expect(visible.items[0].productionFiles).toBeUndefined();
  });
});

describe("storage rollback on DB failure (designer uploads)", () => {
  it("plans delete for every uploaded ref when DB write fails", () => {
    const uploaded = [
      { bucket: "design-proofs", path: `${ORDER}/v1.png` },
      { bucket: "design-proofs", path: `${ORDER}/v2.png` },
    ];
    const refsToDelete = uploaded.map((o) => toStoredRef(o.bucket, o.path));
    expect(refsToDelete).toEqual([
      `design-proofs/${ORDER}/v1.png`,
      `design-proofs/${ORDER}/v2.png`,
    ]);
    for (const ref of refsToDelete) {
      expect(planStorageDelete(ref)?.bucket).toBe("design-proofs");
    }
  });

  it("plans delete for production files on rollback", () => {
    const uploaded = [{ bucket: "production-files", path: `${ORDER}/final.ai` }];
    const ref = toStoredRef(uploaded[0].bucket, uploaded[0].path);
    expect(planStorageDelete(ref)).toEqual({
      bucket: "production-files",
      path: `${ORDER}/final.ai`,
      cleansStorage: true,
    });
  });
});
