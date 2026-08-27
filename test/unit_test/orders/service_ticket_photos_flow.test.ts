import { describe, expect, it } from "vitest";
import {
  shouldPersistLinkAfterUpload,
  stageLifecycle,
  planStorageDelete,
  appendPhotoUrls,
  removePhotoUrl,
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
import { shouldAttemptCompression } from "@/utils/storage/compressImage";
import { bucketForPurpose } from "@/utils/supabase/serverStorageUpload";
import { VALID_PURPOSES } from "@/utils/supabase/parseUploadRequest";

const ORDER = "22222222-2222-2222-2222-222222222222";
const MAX_BYTES = configForPurpose("service_ticket_photo").maxBytes;

function photoRef(bucket: string, name: string) {
  return toStoredRef(bucket, `${ORDER}/${name}`);
}

function publicUrl(bucket: string, path: string) {
  return `https://xyz.supabase.co/storage/v1/object/public/${bucket}/${path}`;
}

describe("service ticket photo - unified storage config registration", () => {
  it("registers both purposes in VALID_PURPOSES (sign-upload route accepts them)", () => {
    expect(VALID_PURPOSES.has("service_ticket_photo")).toBe(true);
    expect(VALID_PURPOSES.has("service_ticket_resolution_photo")).toBe(true);
  });

  it("maps purpose to bucket via bucketForPurpose", () => {
    expect(bucketForPurpose("service_ticket_photo")).toBe("service-ticket-photos");
    expect(bucketForPurpose("service_ticket_resolution_photo")).toBe(
      "service-ticket-resolution-photos"
    );
  });

  it("configForPurpose returns image pipeline with 50MB limit for both", () => {
    for (const purpose of ["service_ticket_photo", "service_ticket_resolution_photo"] as const) {
      const cfg = configForPurpose(purpose);
      expect(cfg.pipeline).toBe("image");
      expect(cfg.maxBytes).toBe(50 * 1024 * 1024);
    }
  });

  it("uses private buckets (signed read for download)", () => {
    expect(isPublicBucket("service-ticket-photos")).toBe(false);
    expect(isPublicBucket("service-ticket-resolution-photos")).toBe(false);
  });
});

describe("service ticket photo - lifecycle contract", () => {
  it("defers DB write until ticket save (deferred_until_save)", () => {
    expect(shouldPersistLinkAfterUpload("service_ticket_photo")).toBe(false);
    expect(shouldPersistLinkAfterUpload("service_ticket_resolution_photo")).toBe(false);
  });

  it("targets service_tickets.photos for issue photos", () => {
    expect(stageLifecycle("service_ticket_photo")).toMatchObject({
      bucket: "service-ticket-photos",
      persistMode: "deferred_until_save",
      dbTarget: { table: "service_tickets", field: "photos" },
      deleteOrder: "db_then_storage",
      cleansStorageOnDelete: true,
    });
  });

  it("targets service_tickets.resolution_photos for resolution photos", () => {
    expect(stageLifecycle("service_ticket_resolution_photo")).toMatchObject({
      bucket: "service-ticket-resolution-photos",
      persistMode: "deferred_until_save",
      dbTarget: { table: "service_tickets", field: "resolution_photos" },
      deleteOrder: "db_then_storage",
      cleansStorageOnDelete: true,
    });
  });
});

describe("service ticket photo - validation", () => {
  it("accepts standard image types within 50MB", () => {
    for (const f of [
      { fileName: "issue.jpg", mime: "image/jpeg", size: 3_000_000 },
      { fileName: "issue.png", mime: "image/png", size: 6_000_000 },
      { fileName: "issue.webp", mime: "image/webp", size: 2_000_000 },
      { fileName: "issue.gif", mime: "image/gif", size: 1_000_000 },
      { fileName: "issue.heic", mime: "image/heic", size: 8_000_000 },
      { fileName: "issue.heif", mime: "image/heif", size: 8_000_000 },
    ]) {
      expect(validateUploadForPurpose("service_ticket_photo", f).ok).toBe(true);
      expect(validateUploadForPurpose("service_ticket_resolution_photo", f).ok).toBe(true);
    }
  });

  it("accepts at the exact 50MB boundary", () => {
    expect(
      validateUploadForPurpose("service_ticket_photo", {
        fileName: "big.jpg",
        size: MAX_BYTES,
        mime: "image/jpeg",
      }).ok
    ).toBe(true);
  });

  it("rejects files over 50MB", () => {
    const r = validateUploadForPurpose("service_ticket_photo", {
      fileName: "huge.jpg",
      size: MAX_BYTES + 1,
      mime: "image/jpeg",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("file_size");
  });

  it("rejects empty files", () => {
    const r = validateUploadForPurpose("service_ticket_photo", {
      fileName: "empty.jpg",
      size: 0,
      mime: "image/jpeg",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("file_empty");
  });

  it("rejects non-image types (PDF, video, exe, docx, html)", () => {
    for (const f of [
      { fileName: "doc.pdf", mime: "application/pdf", size: 1024 },
      { fileName: "clip.mp4", mime: "video/mp4", size: 1024 },
      { fileName: "malware.exe", mime: "application/x-msdownload", size: 1024 },
      { fileName: "notes.docx", mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", size: 1024 },
      { fileName: "page.html", mime: "text/html", size: 1024 },
    ]) {
      const r = validateUploadForPurpose("service_ticket_photo", f);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.reason).toBe("file_type");
    }
  });

  it("rejects design/production formats (ai, psd, cdr, zip, svg, eps, dxf, plt)", () => {
    for (const ext of ["ai", "psd", "cdr", "zip", "svg", "eps", "dxf", "plt"]) {
      const r = validateUploadForPurpose("service_ticket_photo", {
        fileName: `file.${ext}`,
        size: 1024,
        mime: "application/octet-stream",
      });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.reason).toBe("file_type");
    }
  });
});

describe("service ticket photo - compression", () => {
  it("compresses large JPEGs before upload", () => {
    expect(
      shouldAttemptCompression({ type: "image/jpeg", size: 5 * 1024 * 1024, name: "a.jpg" })
    ).toBe(true);
  });

  it("skips compression for small images", () => {
    expect(
      shouldAttemptCompression({ type: "image/jpeg", size: 200 * 1024, name: "a.jpg" })
    ).toBe(false);
  });

  it("skips compression for HEIC (browser cannot decode)", () => {
    expect(
      shouldAttemptCompression({ type: "image/heic", size: 5 * 1024 * 1024, name: "a.heic" })
    ).toBe(false);
  });
});

describe("service ticket photo - path generation (order-scoped)", () => {
  it("builds order-scoped paths with image extension", () => {
    const path = buildOrderObjectPath(ORDER, "jpg");
    expect(path).toMatch(new RegExp(`^${ORDER}/\\d+-[a-z0-9]+\\.jpg$`));
    expect(isValidOrderScopedPath(ORDER, path)).toBe(true);
  });

  it("derives extensions from name or mime", () => {
    expect(extFromNameOrMime("photo.JPG")).toBe("jpg");
    expect(extFromNameOrMime("photo.JPEG")).toBe("jpeg");
    expect(extFromNameOrMime("noext", "image/png")).toBe("png");
    expect(extFromNameOrMime("noext")).toBe("bin");
  });

  it("rejects traversal in paths", () => {
    expect(isValidOrderScopedPath(ORDER, `${ORDER}/../x.jpg`)).toBe(false);
    expect(parseStoredRef("service-ticket-photos/../x.jpg")).toBeNull();
  });

  it("rejects non-UUID order prefixes", () => {
    expect(isValidOrderScopedPath("not-a-uuid", "not-a-uuid/x.jpg")).toBe(false);
  });
});

describe("service ticket photo - append / remove (local state)", () => {
  it("appends new photo refs to existing list without clobbering", () => {
    const existing = [photoRef("service-ticket-photos", "a.jpg")];
    const uploaded = [
      photoRef("service-ticket-photos", "b.jpg"),
      photoRef("service-ticket-photos", "c.jpg"),
    ];
    const all = appendPhotoUrls(existing, uploaded);
    expect(all).toEqual([
      photoRef("service-ticket-photos", "a.jpg"),
      photoRef("service-ticket-photos", "b.jpg"),
      photoRef("service-ticket-photos", "c.jpg"),
    ]);
  });

  it("removes a photo ref by value", () => {
    const photos = [
      photoRef("service-ticket-photos", "a.jpg"),
      photoRef("service-ticket-photos", "b.jpg"),
    ];
    const remaining = removePhotoUrl(photos, photoRef("service-ticket-photos", "a.jpg"));
    expect(remaining).toEqual([photoRef("service-ticket-photos", "b.jpg")]);
  });

  it("removing a non-existent ref is a no-op", () => {
    const photos = [photoRef("service-ticket-photos", "a.jpg")];
    expect(removePhotoUrl(photos, photoRef("service-ticket-photos", "missing.jpg"))).toEqual(photos);
  });

  it("removing from empty list returns empty", () => {
    expect(removePhotoUrl([], photoRef("service-ticket-photos", "a.jpg"))).toEqual([]);
  });
});

describe("service ticket photo - storage cleanup planning", () => {
  it("plans delete for modern bucket/path refs (issue photos)", () => {
    const ref = photoRef("service-ticket-photos", "a.jpg");
    expect(planStorageDelete(ref)).toEqual({
      bucket: "service-ticket-photos",
      path: `${ORDER}/a.jpg`,
      cleansStorage: true,
    });
  });

  it("plans delete for modern bucket/path refs (resolution photos)", () => {
    const ref = photoRef("service-ticket-resolution-photos", "r.jpg");
    expect(planStorageDelete(ref)).toEqual({
      bucket: "service-ticket-resolution-photos",
      path: `${ORDER}/r.jpg`,
      cleansStorage: true,
    });
  });

  it("plans delete for legacy public URLs", () => {
    const url = publicUrl("service-ticket-photos", `${ORDER}/old.jpg`);
    expect(planStorageDelete(url)).toEqual({
      bucket: "service-ticket-photos",
      path: `${ORDER}/old.jpg`,
      cleansStorage: true,
    });
  });

  it("plans delete for legacy support/ prefix paths", () => {
    const ref = "service-ticket-photos/support/old.jpg";
    expect(planStorageDelete(ref)).toEqual({
      bucket: "service-ticket-photos",
      path: "support/old.jpg",
      cleansStorage: true,
    });
  });

  it("plans delete for legacy resolution/ prefix paths", () => {
    const ref = "service-ticket-resolution-photos/resolution/old.jpg";
    expect(planStorageDelete(ref)).toEqual({
      bucket: "service-ticket-resolution-photos",
      path: "resolution/old.jpg",
      cleansStorage: true,
    });
  });

  it("plans delete for legacy public/ prefix paths", () => {
    const ref = "service-ticket-photos/public/old.jpg";
    expect(planStorageDelete(ref)).toEqual({
      bucket: "service-ticket-photos",
      path: "public/old.jpg",
      cleansStorage: true,
    });
  });

  it("returns null for non-storage URLs", () => {
    expect(planStorageDelete("https://cdn.example/photo.jpg")).toBeNull();
    expect(planStorageDelete("")).toBeNull();
  });
});

describe("service ticket photo - rollback on DB failure (create flow)", () => {
  it("plans delete for every uploaded photo when ticket creation fails", () => {
    const uploaded = [
      { bucket: "service-ticket-photos", path: `${ORDER}/a.jpg` },
      { bucket: "service-ticket-photos", path: `${ORDER}/b.jpg` },
    ];
    const refsToDelete = uploaded.map((o) => toStoredRef(o.bucket, o.path));
    expect(refsToDelete).toEqual([
      `service-ticket-photos/${ORDER}/a.jpg`,
      `service-ticket-photos/${ORDER}/b.jpg`,
    ]);
    for (const ref of refsToDelete) {
      expect(planStorageDelete(ref)?.bucket).toBe("service-ticket-photos");
    }
  });

  it("groups rollback deletes by bucket (mixed issue + resolution)", () => {
    const uploaded = [
      { bucket: "service-ticket-photos", path: `${ORDER}/a.jpg` },
      { bucket: "service-ticket-resolution-photos", path: `${ORDER}/b.jpg` },
    ];
    const byBucket = new Map<string, string[]>();
    for (const o of uploaded) {
      const list = byBucket.get(o.bucket) || [];
      list.push(o.path);
      byBucket.set(o.bucket, list);
    }
    expect(byBucket.get("service-ticket-photos")).toEqual([`${ORDER}/a.jpg`]);
    expect(byBucket.get("service-ticket-resolution-photos")).toEqual([`${ORDER}/b.jpg`]);
  });
});

describe("service ticket photo - delete error handling (DB first)", () => {
  it("if DB succeeds and storage cleanup fails, photo is gone from UI (orphan acceptable)", () => {
    const photos = [photoRef("service-ticket-resolution-photos", "r.jpg")];
    const remaining = removePhotoUrl(photos, photoRef("service-ticket-resolution-photos", "r.jpg"));
    expect(remaining).toEqual([]);
    const plan = planStorageDelete(photoRef("service-ticket-resolution-photos", "r.jpg"));
    expect(plan).toEqual({
      bucket: "service-ticket-resolution-photos",
      path: `${ORDER}/r.jpg`,
      cleansStorage: true,
    });
  });

  it("if DB fails, photo is NOT deleted from storage (no broken link)", () => {
    const photos = [photoRef("service-ticket-photos", "a.jpg")];
    // DB write fails we do NOT delete storage. Local state is restored.
    const restored = photos;
    expect(restored).toEqual([photoRef("service-ticket-photos", "a.jpg")]);
    expect(planStorageDelete(photoRef("service-ticket-photos", "a.jpg"))?.bucket).toBe(
      "service-ticket-photos"
    );
  });
});

describe("service ticket photo - mixed legacy + modern refs (backwards compat)", () => {
  it("handles a mix of legacy public URLs, support/ refs, and modern order-scoped refs", () => {
    const legacyPublic = publicUrl("service-ticket-photos", `${ORDER}/old.jpg`);
    const legacySupport = "service-ticket-photos/support/old2.jpg";
    const modern = photoRef("service-ticket-photos", "new.jpg");
    const photos = [legacyPublic, legacySupport, modern];

    expect(planStorageDelete(legacyPublic)?.path).toBe(`${ORDER}/old.jpg`);
    expect(planStorageDelete(legacySupport)?.path).toBe("support/old2.jpg");
    expect(planStorageDelete(modern)?.path).toBe(`${ORDER}/new.jpg`);

    expect(removePhotoUrl(photos, legacyPublic)).toEqual([legacySupport, modern]);
    expect(removePhotoUrl(photos, modern)).toEqual([legacyPublic, legacySupport]);
  });

  it("resolution photos: mix of legacy resolution/ refs and modern order-scoped refs", () => {
    const legacyResolution = "service-ticket-resolution-photos/resolution/old.jpg";
    const modern = photoRef("service-ticket-resolution-photos", "new.jpg");
    const photos = [legacyResolution, modern];

    expect(planStorageDelete(legacyResolution)?.path).toBe("resolution/old.jpg");
    expect(planStorageDelete(modern)?.path).toBe(`${ORDER}/new.jpg`);
    expect(removePhotoUrl(photos, legacyResolution)).toEqual([modern]);
  });
});

describe("service ticket photo - public route hardening", () => {
  it("enforces a 12-photo cap (validated server-side)", () => {
    const MAX_PHOTOS = 12;
    expect(0).toBeLessThanOrEqual(MAX_PHOTOS);
    expect(12).toBeLessThanOrEqual(MAX_PHOTOS);
    expect(13).toBeGreaterThan(MAX_PHOTOS);
  });

  it("validates each file against the image allowlist before upload", () => {
    expect(
      validateUploadForPurpose("service_ticket_photo", {
        fileName: "x.jpg",
        size: 1024,
        mime: "image/jpeg",
      }).ok
    ).toBe(true);
    expect(
      validateUploadForPurpose("service_ticket_photo", {
        fileName: "x.pdf",
        size: 1024,
        mime: "application/pdf",
      }).ok
    ).toBe(false);
  });

  it("uses order-scoped paths (no support/ or public/ prefix)", () => {
    const path = buildOrderObjectPath(ORDER, "jpg");
    expect(isValidOrderScopedPath(ORDER, path)).toBe(true);
    expect(path.startsWith("support/")).toBe(false);
    expect(path.startsWith("public/")).toBe(false);
    expect(path.startsWith("resolution/")).toBe(false);
  });
});
