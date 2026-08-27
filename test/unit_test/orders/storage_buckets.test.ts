import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  bucketForPurpose,
  parsePublicStorageUrl,
  uploadBytesToStorageBucket,
  type StorageUploadPurpose,
} from "@/utils/supabase/serverStorageUpload";
import { portalScopeForPurpose } from "@/utils/supabase/parseUploadRequest";

const STAGE_BUCKETS: Array<{
  purpose: StorageUploadPurpose;
  bucket: string;
  portalScope: "approve_design" | "schedule_visit";
}> = [
  {
    purpose: "site_visit_photo",
    bucket: "site-visit-photos",
    portalScope: "schedule_visit",
  },
  {
    purpose: "design_resource",
    bucket: "order-resources",
    portalScope: "approve_design",
  },
  {
    purpose: "design_proof",
    bucket: "design-proofs",
    portalScope: "approve_design",
  },
  {
    purpose: "production_asset",
    bucket: "production-files",
    portalScope: "approve_design",
  },
  {
    purpose: "installation_photo",
    bucket: "installation-photos",
    portalScope: "schedule_visit",
  },
];

describe("order stage storage buckets (5 stages)", () => {
  describe("bucketForPurpose", () => {
    it("maps each upload purpose to its dedicated bucket", () => {
      for (const stage of STAGE_BUCKETS) {
        expect(bucketForPurpose(stage.purpose)).toBe(stage.bucket);
      }
    });

    it("uses five distinct buckets (no shared catch-all)", () => {
      const buckets = STAGE_BUCKETS.map((s) => s.bucket);
      expect(new Set(buckets).size).toBe(5);
    });
  });

  describe("portalScopeForPurpose", () => {
    it("scopes portal access per stage purpose", () => {
      for (const stage of STAGE_BUCKETS) {
        expect(portalScopeForPurpose(stage.purpose)).toBe(stage.portalScope);
      }
    });
  });

  describe("parsePublicStorageUrl", () => {
    it("parses public URLs for every stage bucket", () => {
      const orderId = "11111111-1111-1111-1111-111111111111";
      for (const stage of STAGE_BUCKETS) {
        const url = `https://xyz.supabase.co/storage/v1/object/public/${stage.bucket}/${orderId}/file.jpg`;
        expect(parsePublicStorageUrl(url)).toEqual({
          bucket: stage.bucket,
          path: `${orderId}/file.jpg`,
        });
      }
    });

    it("parses legacy nested paths still living in site-visit-photos", () => {
      const url =
        "https://xyz.supabase.co/storage/v1/object/public/site-visit-photos/ord/resources/a.png";
      expect(parsePublicStorageUrl(url)).toEqual({
        bucket: "site-visit-photos",
        path: "ord/resources/a.png",
      });
    });

    it("strips query strings and decodes path segments", () => {
      const url =
        "https://xyz.supabase.co/storage/v1/object/public/design-proofs/ord/my%20file.jpg?token=abc";
      expect(parsePublicStorageUrl(url)).toEqual({
        bucket: "design-proofs",
        path: "ord/my file.jpg",
      });
    });

    it("returns null for non-storage URLs", () => {
      expect(parsePublicStorageUrl("https://example.com/photo.jpg")).toBeNull();
      expect(parsePublicStorageUrl("")).toBeNull();
    });
  });

  describe("uploadBytesToStorageBucket path + bucket", () => {
    const orderId = "22222222-2222-2222-2222-222222222222";
    let uploadMock: ReturnType<typeof vi.fn>;
    let getPublicUrlMock: ReturnType<typeof vi.fn>;
    let fromMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      uploadMock = vi.fn().mockResolvedValue({ error: null });
      getPublicUrlMock = vi.fn((path: string) => ({
        data: { publicUrl: `https://example.supabase.co/storage/v1/object/public/BUCKET/${path}` },
      }));
      fromMock = vi.fn((bucket: string) => {
        getPublicUrlMock.mockImplementation((path: string) => ({
          data: {
            publicUrl: `https://example.supabase.co/storage/v1/object/public/${bucket}/${path}`,
          },
        }));
        return { upload: uploadMock, getPublicUrl: getPublicUrlMock };
      });
    });

    it("uploads each stage into its own bucket with a flat {orderId}/{file} path", async () => {
      const supabase = { storage: { from: fromMock } } as any;

      for (const stage of STAGE_BUCKETS) {
        uploadMock.mockClear();
        fromMock.mockClear();

        const result = await uploadBytesToStorageBucket(supabase, {
          orderId,
          purpose: stage.purpose,
          bytes: new Uint8Array([1, 2, 3]),
          fileName: "photo.png",
          contentType: "image/png",
        });

        expect(fromMock).toHaveBeenCalledWith(stage.bucket);
        expect(uploadMock).toHaveBeenCalledTimes(1);
        const [path, , opts] = uploadMock.mock.calls[0];
        expect(path).toMatch(
          new RegExp(`^${orderId}/\\d+-[a-z0-9]+\\.png$`)
        );
        // No stage subfolders bucket is the stage.
        expect(path).not.toMatch(/\/(resources|designs|production)\//);
        expect(opts).toMatchObject({ contentType: "image/png", upsert: false });
        expect(result.bucket).toBe(stage.bucket);
        expect(result.path).toBe(path);
        expect(result.url).toBe(`${stage.bucket}/${path}`);
      }
    });

    it("rejects empty byte payloads", async () => {
      const supabase = { storage: { from: fromMock } } as any;
      await expect(
        uploadBytesToStorageBucket(supabase, {
          orderId,
          purpose: "site_visit_photo",
          bytes: new Uint8Array([]),
          fileName: "empty.jpg",
        })
      ).rejects.toThrow(/Could not read file data/);
    });
  });
});
