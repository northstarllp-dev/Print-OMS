import { describe, expect, it } from "vitest";
import {
  PURPOSE_STORAGE_CONFIG,
  buildOrderObjectPath,
  configForPurpose,
  extFromNameOrMime,
  isPublicBucket,
  isValidOrderScopedPath,
  validateUploadForPurpose,
} from "@/utils/supabase/storageConfig";

const ORDER = "11111111-1111-1111-1111-111111111111";

describe("storage config (two pipelines)", () => {
  it("classifies image vs production pipelines per purpose", () => {
    expect(configForPurpose("site_visit_photo").pipeline).toBe("image");
    expect(configForPurpose("design_resource").pipeline).toBe("image");
    expect(configForPurpose("design_proof").pipeline).toBe("image");
    expect(configForPurpose("installation_photo").pipeline).toBe("image");
    expect(configForPurpose("production_asset").pipeline).toBe("production");
  });

  it("only product-images is public", () => {
    expect(isPublicBucket("product-images")).toBe(true);
    for (const cfg of Object.values(PURPOSE_STORAGE_CONFIG)) {
      expect(isPublicBucket(cfg.bucket)).toBe(false);
    }
  });

  it("production bucket allows larger files than image buckets", () => {
    expect(configForPurpose("production_asset").maxBytes).toBeGreaterThan(
      configForPurpose("design_proof").maxBytes
    );
  });
});

describe("validateUploadForPurpose", () => {
  it("accepts an allowed image type within size", () => {
    expect(
      validateUploadForPurpose("design_proof", {
        fileName: "proof.png",
        size: 2 * 1024 * 1024,
        mime: "image/png",
      }).ok
    ).toBe(true);
  });

  it("rejects disallowed type", () => {
    const r = validateUploadForPurpose("design_proof", {
      fileName: "script.exe",
      size: 1024,
      mime: "application/x-msdownload",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("file_type");
  });

  it("rejects oversize by purpose limit", () => {
    const r = validateUploadForPurpose("site_visit_photo", {
      fileName: "photo.jpg",
      size: 60 * 1024 * 1024,
      mime: "image/jpeg",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("file_size");
  });

  it("rejects empty files", () => {
    const r = validateUploadForPurpose("installation_photo", {
      fileName: "photo.jpg",
      size: 0,
      mime: "image/jpeg",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("file_empty");
  });

  it("accepts production design files by extension when mime is generic", () => {
    expect(
      validateUploadForPurpose("production_asset", {
        fileName: "artwork.ai",
        size: 40 * 1024 * 1024,
        mime: "application/octet-stream",
      }).ok
    ).toBe(true);
    expect(
      validateUploadForPurpose("production_asset", {
        fileName: "layout.psd",
        size: 10 * 1024 * 1024,
      }).ok
    ).toBe(true);
  });
});

describe("paths", () => {
  it("builds flat order-scoped paths", () => {
    const path = buildOrderObjectPath(ORDER, "png");
    expect(path).toMatch(new RegExp(`^${ORDER}/\\d+-[a-z0-9]+\\.png$`));
    expect(isValidOrderScopedPath(ORDER, path)).toBe(true);
  });

  it("rejects invalid order ids and traversal", () => {
    expect(isValidOrderScopedPath("not-a-uuid", `${ORDER}/a.png`)).toBe(false);
    expect(isValidOrderScopedPath(ORDER, `${ORDER}/../x.png`)).toBe(false);
  });

  it("derives extensions from name or mime", () => {
    expect(extFromNameOrMime("logo.SVG")).toBe("svg");
    expect(extFromNameOrMime("noext", "application/pdf")).toBe("pdf");
    expect(extFromNameOrMime("noext", "image/jpeg")).toBe("jpg");
  });
});
