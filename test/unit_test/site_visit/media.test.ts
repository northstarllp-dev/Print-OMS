import { describe, expect, it } from "vitest";
import {
  buildSiteVisitStoragePath,
  defaultSiteVisitConfig,
  isUploadAllowed,
  mediaDeletePlan,
  validateSiteVisitSave,
} from "@/features/orders/workspace/modules/site-visit/siteVisitChecklistLogic";
import { bucketForPurpose } from "@/utils/supabase/serverStorageUpload";

describe("site visit media", () => {
  describe("storage paths + bucket isolation", () => {
    it("routes site_visit_photo to site-visit-photos bucket", () => {
      expect(bucketForPurpose("site_visit_photo")).toBe("site-visit-photos");
      expect(bucketForPurpose("installation_photo")).toBe("installation-photos");
    });

    it("storage path company/order/site-visit/measurement/file", () => {
      expect(
        buildSiteVisitStoragePath({
          companyId: "co-1",
          orderId: "ord-1",
          measurementId: "m-1",
          fileName: "img1.jpg",
        })
      ).toBe("co-1/ord-1/site-visit/m-1/img1.jpg");
    });
  });

  describe("upload validation + orphan delete", () => {
    it("upload type/size validation (jpg/png/pdf, 20MB)", () => {
      const cfg = defaultSiteVisitConfig();
      expect(isUploadAllowed({ name: "a.jpg", sizeBytes: 1024 }, cfg).ok).toBe(true);
      expect(isUploadAllowed({ name: "a.pdf", sizeBytes: 1024 }, cfg).ok).toBe(true);
      expect(isUploadAllowed({ name: "a.exe", sizeBytes: 1024 }, cfg).reason).toBe("file_type");
      expect(
        isUploadAllowed({ name: "a.jpg", sizeBytes: 21 * 1024 * 1024 }, cfg).reason
      ).toBe("file_size");
    });

    it("deleting measurement plans DB + storage object removal (no orphans)", () => {
      expect(
        mediaDeletePlan({
          measurementDeleted: true,
          photoPaths: ["co/ord/site-visit/m1/a.jpg", "co/ord/site-visit/m1/b.jpg"],
        })
      ).toEqual({
        deleteDbRow: true,
        storagePaths: ["co/ord/site-visit/m1/a.jpg", "co/ord/site-visit/m1/b.jpg"],
      });
      expect(mediaDeletePlan({ measurementDeleted: false, photoPaths: ["x"] })).toEqual({
        deleteDbRow: false,
        storagePaths: [],
      });
    });

    it("upload hardening + gps required when configured", () => {
      const cfg = defaultSiteVisitConfig({ gpsRequired: true });
      expect(isUploadAllowed({ name: "x.svg", sizeBytes: 10 }, cfg).ok).toBe(false);
      expect(
        validateSiteVisitSave({ address: "A", gps: "bad", locationsCount: 0, config: cfg })
      ).toContain("gps_required");
    });
  });
});
