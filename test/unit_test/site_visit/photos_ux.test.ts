import { describe, expect, it } from "vitest";
import {
  shouldPersistLinkAfterUpload,
  stageLifecycle,
  appendPhotoUrls,
  removePhotoUrl,
  planStorageDelete,
} from "@/utils/supabase/storageLifecycleLogic";
import { parseStoredRef, toStoredRef } from "@/utils/storage/storageRef";

/**
 * Site Visit photo UX contract:
 * 1. Camera / gallery → upload to storage immediately
 * 2. Ref appears in local location.photos (immediate preview)
 * 3. Delete removes storage + drops local ref
 * 4. DB write only on Save Draft
 */
describe("site visit photo UX contract", () => {
  const orderId = "11111111-1111-1111-1111-111111111111";
  const bucket = "site-visit-photos";

  it("does not write DB on upload — only local state until Save Draft", () => {
    expect(shouldPersistLinkAfterUpload("site_visit_photo")).toBe(false);
    expect(stageLifecycle("site_visit_photo").persistMode).toBe("deferred_until_save");
    expect(stageLifecycle("site_visit_photo").dbTarget).toEqual({
      table: "site_visit_measurements",
      field: "photos",
    });
  });

  it("stores bucket/path refs for immediate preview after upload", () => {
    const uploaded = [
      toStoredRef(bucket, `${orderId}/a.jpg`),
      toStoredRef(bucket, `${orderId}/b.jpg`),
    ];
    const localPhotos = appendPhotoUrls([], uploaded);
    expect(localPhotos).toEqual(uploaded);
    // OrderImage / parseStoredRef can resolve these for display
    expect(parseStoredRef(localPhotos[0])).toEqual({
      bucket,
      path: `${orderId}/a.jpg`,
    });
  });

  it("delete removes storage object and drops the local ref (Save Draft later persists absence)", () => {
    const a = toStoredRef(bucket, `${orderId}/a.jpg`);
    const b = toStoredRef(bucket, `${orderId}/b.jpg`);
    const before = [a, b];

    const plan = planStorageDelete(a);
    expect(plan).toEqual({
      bucket,
      path: `${orderId}/a.jpg`,
      cleansStorage: true,
    });

    const after = removePhotoUrl(before, a);
    expect(after).toEqual([b]);
  });

  it("legacy public URLs from previously saved drafts still parse for view/delete", () => {
    const legacy =
      `https://xyz.supabase.co/storage/v1/object/public/${bucket}/${orderId}/old.jpg`;
    expect(parseStoredRef(legacy)).toEqual({
      bucket,
      path: `${orderId}/old.jpg`,
    });
    expect(planStorageDelete(legacy)?.path).toBe(`${orderId}/old.jpg`);
  });
});
