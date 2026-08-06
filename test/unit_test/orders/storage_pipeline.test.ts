import { describe, expect, it } from "vitest";
import { parseStoredRef, toStoredRef } from "@/utils/storage/storageRef";
import { shouldAttemptCompression } from "@/utils/storage/compressImage";
import { chunkBytes, TUS_CHUNK_SIZE } from "@/utils/storage/uploadQueue";

describe("parseStoredRef (legacy public URLs + new bucket/path refs)", () => {
  it("parses a bucket/path ref", () => {
    expect(parseStoredRef("design-proofs/ord-1/a.png")).toEqual({
      bucket: "design-proofs",
      path: "ord-1/a.png",
    });
  });

  it("parses a legacy public URL to bucket/path", () => {
    expect(
      parseStoredRef(
        "https://xyz.supabase.co/storage/v1/object/public/site-visit-photos/ord-1/pic.jpg"
      )
    ).toEqual({ bucket: "site-visit-photos", path: "ord-1/pic.jpg" });
  });

  it("returns null for signed URLs and traversal", () => {
    expect(
      parseStoredRef("https://xyz.supabase.co/storage/v1/object/sign/b/p?token=abc")
    ).toBeNull();
    expect(parseStoredRef("bucket/../x")).toBeNull();
    expect(parseStoredRef("")).toBeNull();
  });

  it("round-trips via toStoredRef", () => {
    expect(parseStoredRef(toStoredRef("installation-photos", "ord/a.jpg"))).toEqual({
      bucket: "installation-photos",
      path: "ord/a.jpg",
    });
  });
});

describe("compression decisions", () => {
  it("compresses large raster images only", () => {
    expect(
      shouldAttemptCompression({ type: "image/jpeg", size: 5 * 1024 * 1024, name: "a.jpg" })
    ).toBe(true);
    // small files skip
    expect(
      shouldAttemptCompression({ type: "image/jpeg", size: 100 * 1024, name: "a.jpg" })
    ).toBe(false);
    // HEIC not client-compressed
    expect(
      shouldAttemptCompression({ type: "image/heic", size: 5 * 1024 * 1024, name: "a.heic" })
    ).toBe(false);
    // non-images never
    expect(
      shouldAttemptCompression({ type: "application/pdf", size: 5 * 1024 * 1024, name: "a.pdf" })
    ).toBe(false);
  });
});

describe("tus chunking", () => {
  it("uses 6MB chunks required by Supabase resumable uploads", () => {
    expect(TUS_CHUNK_SIZE).toBe(6 * 1024 * 1024);
    expect(chunkBytes(6 * 1024 * 1024, TUS_CHUNK_SIZE)).toBe(1);
    expect(chunkBytes(6 * 1024 * 1024 + 1, TUS_CHUNK_SIZE)).toBe(2);
    expect(chunkBytes(50 * 1024 * 1024, TUS_CHUNK_SIZE)).toBe(9);
  });
});
