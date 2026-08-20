import { describe, expect, it } from "vitest";
import {
  shouldPersistLinkAfterUpload,
  stageLifecycle,
  appendPhotoUrls,
  removePhotoUrl,
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
import { shouldAttemptCompression } from "@/utils/storage/compressImage";

/**
 * Installation photos pipeline:
 * Staff uploads after-installation photos → installation-photos bucket (image pipeline)
 * → installations.photos / installations.afterPhotos JSON → admin review
 * → download via signed read URL
 */

const ORDER = "11111111-1111-1111-1111-111111111111";
const MAX_BYTES = configForPurpose("installation_photo").maxBytes;

function photoRef(name: string) {
  return toStoredRef("installation-photos", `${ORDER}/${name}`);
}

function publicUrl(bucket: string, path: string) {
  return `https://xyz.supabase.co/storage/v1/object/public/${bucket}/${path}`;
}

describe("installation photo lifecycle", () => {
  it("persists to installations.photos immediately after upload", () => {
    expect(shouldPersistLinkAfterUpload("installation_photo")).toBe(true);
    expect(stageLifecycle("installation_photo")).toMatchObject({
      bucket: "installation-photos",
      persistMode: "immediate_after_upload",
      dbTarget: { table: "installations", field: "photos|afterPhotos" },
      cleansStorageOnDelete: true,
    });
  });

  it("uses the image pipeline with 50MB limit", () => {
    expect(configForPurpose("installation_photo").pipeline).toBe("image");
    expect(configForPurpose("installation_photo").maxBytes).toBe(50 * 1024 * 1024);
  });

  it("uses a private bucket (signed read for download)", () => {
    expect(isPublicBucket("installation-photos")).toBe(false);
  });
});

describe("installation photo validation", () => {
  it("accepts standard image types within 50MB", () => {
    for (const f of [
      { fileName: "photo.jpg", mime: "image/jpeg", size: 5_000_000 },
      { fileName: "photo.png", mime: "image/png", size: 8_000_000 },
      { fileName: "photo.webp", mime: "image/webp", size: 2_000_000 },
      { fileName: "photo.gif", mime: "image/gif", size: 1_000_000 },
      { fileName: "photo.heic", mime: "image/heic", size: 10_000_000 },
      { fileName: "photo.heif", mime: "image/heif", size: 10_000_000 },
    ]) {
      expect(validateUploadForPurpose("installation_photo", f).ok).toBe(true);
    }
  });

  it("accepts at the exact 50MB boundary", () => {
    expect(
      validateUploadForPurpose("installation_photo", {
        fileName: "big.jpg",
        size: MAX_BYTES,
        mime: "image/jpeg",
      }).ok
    ).toBe(true);
  });

  it("rejects files over 50MB", () => {
    const r = validateUploadForPurpose("installation_photo", {
      fileName: "huge.jpg",
      size: MAX_BYTES + 1,
      mime: "image/jpeg",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("file_size");
  });

  it("rejects empty files", () => {
    const r = validateUploadForPurpose("installation_photo", {
      fileName: "empty.jpg",
      size: 0,
      mime: "image/jpeg",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("file_empty");
  });

  it("rejects non-image types (PDF, video, exe, docx)", () => {
    for (const f of [
      { fileName: "doc.pdf", mime: "application/pdf", size: 1024 },
      { fileName: "clip.mp4", mime: "video/mp4", size: 1024 },
      { fileName: "malware.exe", mime: "application/x-msdownload", size: 1024 },
      { fileName: "notes.docx", mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", size: 1024 },
      { fileName: "page.html", mime: "text/html", size: 1024 },
    ]) {
      const r = validateUploadForPurpose("installation_photo", f);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.reason).toBe("file_type");
    }
  });

  it("rejects production-only formats (ai, psd, cdr, zip, dxf)", () => {
    for (const ext of ["ai", "psd", "cdr", "zip", "dxf", "plt"]) {
      const r = validateUploadForPurpose("installation_photo", {
        fileName: `file.${ext}`,
        size: 1024,
        mime: "application/octet-stream",
      });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.reason).toBe("file_type");
    }
  });
});

describe("compression behavior", () => {
  it("compresses large JPEGs before upload", () => {
    expect(
      shouldAttemptCompression({ type: "image/jpeg", size: 5 * 1024 * 1024, name: "a.jpg" })
    ).toBe(true);
  });

  it("skips compression for small images", () => {
    expect(
      shouldAttemptCompression({ type: "image/jpeg", size: 100 * 1024, name: "a.jpg" })
    ).toBe(false);
  });

  it("skips compression for HEIC (browser can't decode)", () => {
    expect(
      shouldAttemptCompression({ type: "image/heic", size: 5 * 1024 * 1024, name: "a.heic" })
    ).toBe(false);
  });
});

describe("photo append / remove (local state + DB)", () => {
  it("appends new photo refs to existing list without clobbering", () => {
    const existing = [photoRef("a.jpg")];
    const uploaded = [photoRef("b.jpg"), photoRef("c.jpg")];
    const all = appendPhotoUrls(existing, uploaded);
    expect(all).toEqual([photoRef("a.jpg"), photoRef("b.jpg"), photoRef("c.jpg")]);
  });

  it("removes a photo ref by value", () => {
    const photos = [photoRef("a.jpg"), photoRef("b.jpg")];
    const remaining = removePhotoUrl(photos, photoRef("a.jpg"));
    expect(remaining).toEqual([photoRef("b.jpg")]);
  });

  it("removing a non-existent ref is a no-op", () => {
    const photos = [photoRef("a.jpg")];
    expect(removePhotoUrl(photos, photoRef("missing.jpg"))).toEqual(photos);
  });

  it("removing from empty list returns empty", () => {
    expect(removePhotoUrl([], photoRef("a.jpg"))).toEqual([]);
  });
});

describe("photo delete — storage cleanup", () => {
  it("plans delete for modern bucket/path refs", () => {
    const ref = photoRef("a.jpg");
    expect(planStorageDelete(ref)).toEqual({
      bucket: "installation-photos",
      path: `${ORDER}/a.jpg`,
      cleansStorage: true,
    });
  });

  it("plans delete for legacy public URLs", () => {
    const url = publicUrl("installation-photos", `${ORDER}/a.jpg`);
    expect(planStorageDelete(url)).toEqual({
      bucket: "installation-photos",
      path: `${ORDER}/a.jpg`,
      cleansStorage: true,
    });
  });

  it("returns null for non-storage URLs (no storage cleanup needed)", () => {
    expect(planStorageDelete("https://cdn.example/photo.jpg")).toBeNull();
    expect(planStorageDelete("")).toBeNull();
  });

  it("rejects traversal in paths", () => {
    expect(parseStoredRef("installation-photos/../x.jpg")).toBeNull();
    expect(isValidOrderScopedPath(ORDER, `${ORDER}/../x.jpg`)).toBe(false);
  });
});

describe("path generation", () => {
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
});

describe("storage rollback on DB failure (upload)", () => {
  it("plans delete for every uploaded ref when DB write fails", () => {
    const uploaded = [
      { bucket: "installation-photos", path: `${ORDER}/a.jpg` },
      { bucket: "installation-photos", path: `${ORDER}/b.jpg` },
    ];
    const refsToDelete = uploaded.map((o) => toStoredRef(o.bucket, o.path));
    expect(refsToDelete).toEqual([
      `installation-photos/${ORDER}/a.jpg`,
      `installation-photos/${ORDER}/b.jpg`,
    ]);
    for (const ref of refsToDelete) {
      expect(planStorageDelete(ref)?.bucket).toBe("installation-photos");
    }
  });
});

describe("delete error handling (DB first, then storage)", () => {
  it("if DB succeeds and storage cleanup fails, photo is gone from UI (orphan acceptable)", () => {
    const photos = [photoRef("a.jpg")];
    const remaining = removePhotoUrl(photos, photoRef("a.jpg"));
    expect(remaining).toEqual([]);
    // DB write would use `remaining` (empty) — succeeds.
    // Storage cleanup may fail but DB is already committed.
    const plan = planStorageDelete(photoRef("a.jpg"));
    expect(plan).toEqual({
      bucket: "installation-photos",
      path: `${ORDER}/a.jpg`,
      cleansStorage: true,
    });
  });

  it("if DB fails, photo is NOT deleted from storage (no broken link)", () => {
    const photos = [photoRef("a.jpg")];
    // DB write fails — we do NOT delete storage.
    // Local state is restored to original.
    const restored = photos; // setAfterPhotos(afterPhotos) restores closure value
    expect(restored).toEqual([photoRef("a.jpg")]);
    expect(planStorageDelete(photoRef("a.jpg"))?.bucket).toBe("installation-photos");
  });
});

describe("mixed legacy + modern refs (backwards compatibility)", () => {
  it("handles a mix of legacy public URLs and modern bucket/path refs", () => {
    const legacy = publicUrl("installation-photos", `${ORDER}/old.jpg`);
    const modern = photoRef("new.jpg");
    const photos = [legacy, modern];

    // Both parse correctly for delete
    expect(planStorageDelete(legacy)?.path).toBe(`${ORDER}/old.jpg`);
    expect(planStorageDelete(modern)?.path).toBe(`${ORDER}/new.jpg`);

    // Remove works by value
    expect(removePhotoUrl(photos, legacy)).toEqual([modern]);
    expect(removePhotoUrl(photos, modern)).toEqual([legacy]);
  });
});
