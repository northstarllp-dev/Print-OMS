import { describe, expect, it } from "vitest";
import { bucketForPurpose } from "@/utils/supabase/serverStorageUpload";
import {
  allStageLifecycles,
  appendPhotoUrls,
  appendProductionFiles,
  appendProofVersion,
  assertLifecycleBucketsAligned,
  buildDesignResourceRecord,
  planProductionFileDelete,
  planStorageDelete,
  removeDesignResourceById,
  removePhotoUrl,
  removeProductionFileById,
  removeProofVersionById,
  shouldPersistLinkAfterUpload,
  stageLifecycle,
} from "@/utils/supabase/storageLifecycleLogic";

const ORDER = "11111111-1111-1111-1111-111111111111";

function publicUrl(bucket: string, path: string) {
  return `https://xyz.supabase.co/storage/v1/object/public/${bucket}/${path}`;
}

describe("storage upload → DB link → delete lifecycle", () => {
  it("keeps lifecycle buckets aligned with bucketForPurpose for all stages", () => {
    expect(() => assertLifecycleBucketsAligned()).not.toThrow();
    expect(allStageLifecycles().length).toBeGreaterThanOrEqual(5);
    for (const life of allStageLifecycles()) {
      expect(bucketForPurpose(life.purpose)).toBe(life.bucket);
    }
  });

  describe("when the DB link is written", () => {
    it("site visit: upload hits storage now, DB link only on Save Draft", () => {
      const life = stageLifecycle("site_visit_photo");
      expect(life.persistMode).toBe("deferred_until_save");
      expect(shouldPersistLinkAfterUpload("site_visit_photo")).toBe(false);
      expect(life.dbTarget).toEqual({
        table: "site_visit_measurements",
        field: "photos",
      });
    });

    it("design resource / proof / production / installation: persist link immediately after upload", () => {
      for (const purpose of [
        "design_resource",
        "design_proof",
        "production_asset",
        "installation_photo",
      ] as const) {
        expect(shouldPersistLinkAfterUpload(purpose)).toBe(true);
        expect(stageLifecycle(purpose).persistMode).toBe("immediate_after_upload");
      }
    });
  });

  describe("site_visit_photo", () => {
    it("upload appends URLs locally without implying a DB write", () => {
      const uploaded = [
        publicUrl("site-visit-photos", `${ORDER}/a.jpg`),
        publicUrl("site-visit-photos", `${ORDER}/b.jpg`),
      ];
      expect(appendPhotoUrls([], uploaded)).toEqual(uploaded);
      expect(shouldPersistLinkAfterUpload("site_visit_photo")).toBe(false);
    });

    it("delete removes storage object and drops URL from local list", () => {
      const url = publicUrl("site-visit-photos", `${ORDER}/a.jpg`);
      expect(planStorageDelete(url)).toEqual({
        bucket: "site-visit-photos",
        path: `${ORDER}/a.jpg`,
        cleansStorage: true,
      });
      expect(removePhotoUrl([url, publicUrl("site-visit-photos", `${ORDER}/b.jpg`)], url)).toEqual([
        publicUrl("site-visit-photos", `${ORDER}/b.jpg`),
      ]);
      expect(stageLifecycle("site_visit_photo").deleteOrder).toBe("storage_then_local_or_db");
      expect(stageLifecycle("site_visit_photo").cleansStorageOnDelete).toBe(true);
    });
  });

  describe("design_resource", () => {
    it("after upload, builds a resources[] record that carries the storage URL for DB save", () => {
      const url = publicUrl("order-resources", `${ORDER}/logo.png`);
      const record = buildDesignResourceRecord({
        id: "res-1",
        url,
        name: "logo.png",
        createdAt: "2026-01-01T00:00:00.000Z",
      });
      expect(record).toMatchObject({
        id: "res-1",
        url,
        name: "logo.png",
        type: "file",
        uploadedBy: "Customer",
      });
      expect(shouldPersistLinkAfterUpload("design_resource")).toBe(true);
      expect(stageLifecycle("design_resource").dbTarget).toEqual({
        table: "designs",
        field: "resources",
      });
    });

    it("delete drops the DB resource then plans storage removal", () => {
      const url = publicUrl("order-resources", `${ORDER}/logo.png`);
      const resources = [
        buildDesignResourceRecord({ id: "res-1", url, name: "logo.png" }),
        buildDesignResourceRecord({
          id: "res-2",
          url: publicUrl("order-resources", `${ORDER}/mood.jpg`),
          name: "mood.jpg",
        }),
      ];
      const remaining = removeDesignResourceById(resources, "res-1");
      expect(remaining.map((r) => r.id)).toEqual(["res-2"]);
      expect(planStorageDelete(url)).toEqual({
        bucket: "order-resources",
        path: `${ORDER}/logo.png`,
        cleansStorage: true,
      });
      expect(stageLifecycle("design_resource").deleteOrder).toBe("db_then_storage");
    });
  });

  describe("design_proof", () => {
    it("after upload, proof version stores proofUrl for immediate DB persist", () => {
      const url = publicUrl("design-proofs", `${ORDER}/v1.png`);
      const versions = appendProofVersion([], {
        id: "ver-1",
        proofUrl: url,
        versionNumber: 1,
      });
      expect(versions[0].proofUrl).toBe(url);
      expect(shouldPersistLinkAfterUpload("design_proof")).toBe(true);
      expect(stageLifecycle("design_proof").dbTarget.field).toContain("proofUrl");
    });

    it("delete removes version from items then plans storage cleanup", () => {
      const url = publicUrl("design-proofs", `${ORDER}/v1.png`);
      const versions = [
        { id: "ver-1", proofUrl: url, versionNumber: 1 },
        {
          id: "ver-2",
          proofUrl: publicUrl("design-proofs", `${ORDER}/v2.png`),
          versionNumber: 2,
        },
      ];
      expect(removeProofVersionById(versions, "ver-1").map((v) => v.id)).toEqual(["ver-2"]);
      expect(planStorageDelete(url)?.bucket).toBe("design-proofs");
      expect(stageLifecycle("design_proof").cleansStorageOnDelete).toBe(true);
      expect(stageLifecycle("design_proof").deleteOrder).toBe("db_then_storage");
    });
  });

  describe("production_asset", () => {
    it("after upload, productionFiles[] entries carry url for immediate DB persist", () => {
      const url = publicUrl("production-files", `${ORDER}/print.pdf`);
      const files = appendProductionFiles([], [
        {
          id: "pf-1",
          name: "print.pdf",
          url,
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      ]);
      expect(files[0].url).toBe(url);
      expect(shouldPersistLinkAfterUpload("production_asset")).toBe(true);
    });

    it("delete removes DB link AND plans storage object removal (no orphans)", () => {
      const url = publicUrl("production-files", `${ORDER}/print.pdf`);
      const files = [
        { id: "pf-1", name: "print.pdf", url, createdAt: "2026-01-01T00:00:00.000Z" },
        {
          id: "pf-2",
          name: "cut.pdf",
          url: publicUrl("production-files", `${ORDER}/cut.pdf`),
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      ];
      const { remaining, removed } = removeProductionFileById(files, "pf-1");
      expect(remaining.map((f) => f.id)).toEqual(["pf-2"]);
      expect(planProductionFileDelete(removed)).toEqual({
        updateDb: true,
        storage: { bucket: "production-files", path: `${ORDER}/print.pdf` },
      });
      expect(stageLifecycle("production_asset").cleansStorageOnDelete).toBe(true);
      expect(stageLifecycle("production_asset").deleteOrder).toBe("db_then_storage");
    });
  });

  describe("installation_photo", () => {
    it("upload appends URLs then requires immediate DB persist to photos + afterPhotos", () => {
      const url = publicUrl("installation-photos", `${ORDER}/after.jpg`);
      expect(appendPhotoUrls([], [url])).toEqual([url]);
      expect(shouldPersistLinkAfterUpload("installation_photo")).toBe(true);
      expect(stageLifecycle("installation_photo").dbTarget).toEqual({
        table: "installations",
        field: "photos|afterPhotos",
      });
    });

    it("delete cleans storage then updates DB photo lists", () => {
      const url = publicUrl("installation-photos", `${ORDER}/after.jpg`);
      expect(planStorageDelete(url)).toEqual({
        bucket: "installation-photos",
        path: `${ORDER}/after.jpg`,
        cleansStorage: true,
      });
      expect(removePhotoUrl([url], url)).toEqual([]);
      expect(stageLifecycle("installation_photo").deleteOrder).toBe(
        "storage_then_local_or_db"
      );
      expect(stageLifecycle("installation_photo").cleansStorageOnDelete).toBe(true);
    });
  });

  describe("legacy URLs still delete", () => {
    it("parses nested site-visit-photos paths used before bucket split", () => {
      const url = publicUrl("site-visit-photos", `${ORDER}/resources/old.png`);
      expect(planStorageDelete(url)).toEqual({
        bucket: "site-visit-photos",
        path: `${ORDER}/resources/old.png`,
        cleansStorage: true,
      });
    });

    it("returns null for non-storage URLs so callers skip storage.remove", () => {
      expect(planStorageDelete("https://cdn.example/photo.jpg")).toBeNull();
      expect(planProductionFileDelete(undefined)).toEqual({
        updateDb: true,
        storage: null,
      });
    });
  });
});
