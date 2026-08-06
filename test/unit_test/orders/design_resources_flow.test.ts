import { describe, expect, it } from "vitest";
import {
  shouldPersistLinkAfterUpload,
  stageLifecycle,
  buildDesignResourceRecord,
  removeDesignResourceById,
  planStorageDelete,
} from "@/utils/supabase/storageLifecycleLogic";
import {
  configForPurpose,
  isPublicBucket,
  isValidOrderScopedPath,
  validateUploadForPurpose,
} from "@/utils/supabase/storageConfig";
import { parseStoredRef, toStoredRef } from "@/utils/storage/storageRef";
import { portalScopeForPurpose } from "@/utils/supabase/parseUploadRequest";
import { toCustomerVisibleDesign, mergePortalDesignItemsPreservingStaffDrafts } from "@/features/designs/utils/customerVisibleDesign";
import type { DesignRecord } from "@/types";

/**
 * Customer resource flow:
 * Portal upload → order-resources bucket → designs.resources JSON
 * → visible + downloadable in staff Design module (admin/designer).
 */
describe("customer design resources flow", () => {
  const orderId = "11111111-1111-1111-1111-111111111111";
  const otherOrderId = "22222222-2222-2222-2222-222222222222";
  const maxBytes = configForPurpose("design_resource").maxBytes;

  /** Mirrors portal delete allowlist in portalStorageActions. */
  const PORTAL_DELETE_BUCKETS = new Set(["order-resources", "design-proofs"]);

  function resourceRef(fileName: string, oid = orderId) {
    return toStoredRef("order-resources", `${oid}/${fileName}`);
  }

  function appendCustomerResources(
    existing: ReturnType<typeof buildDesignResourceRecord>[],
    uploaded: Array<{ id: string; url: string; name: string }>
  ) {
    return [
      ...existing,
      ...uploaded.map((u) =>
        buildDesignResourceRecord({
          id: u.id,
          url: u.url,
          name: u.name,
          createdAt: "2026-01-01T00:00:00.000Z",
        })
      ),
    ];
  }

  /** On DB write failure, portal rolls back only the newly uploaded storage objects. */
  function rollbackRefsOnDbFailure(
    newlyUploaded: Array<{ bucket: string; path: string }>
  ): string[] {
    return newlyUploaded.map((o) => toStoredRef(o.bucket, o.path));
  }

  it("persists the storage link to designs.resources immediately after upload", () => {
    expect(shouldPersistLinkAfterUpload("design_resource")).toBe(true);
    expect(stageLifecycle("design_resource")).toMatchObject({
      bucket: "order-resources",
      persistMode: "immediate_after_upload",
      dbTarget: { table: "designs", field: "resources" },
      deleteOrder: "db_then_storage",
      cleansStorageOnDelete: true,
    });
  });

  it("uses the image pipeline and a private bucket (signed read for staff download)", () => {
    expect(configForPurpose("design_resource").pipeline).toBe("image");
    expect(configForPurpose("design_resource").bucket).toBe("order-resources");
    expect(isPublicBucket("order-resources")).toBe(false);
    expect(portalScopeForPurpose("design_resource")).toBe("approve_design");
  });

  describe("allowed customer file types", () => {
    it("accepts logos / inspiration types customers actually upload", () => {
      for (const file of [
        { fileName: "logo.png", mime: "image/png", size: 800_000 },
        { fileName: "moodboard.jpg", mime: "image/jpeg", size: 2_000_000 },
        { fileName: "shot.webp", mime: "image/webp", size: 400_000 },
        { fileName: "anim.gif", mime: "image/gif", size: 900_000 },
        { fileName: "phone.heic", mime: "image/heic", size: 3_000_000 },
        { fileName: "phone.heif", mime: "image/heif", size: 3_000_000 },
        { fileName: "brief.pdf", mime: "application/pdf", size: 1_500_000 },
        { fileName: "mark.svg", mime: "image/svg+xml", size: 40_000 },
        { fileName: "brand.ai", mime: "application/octet-stream", size: 5_000_000 },
        { fileName: "vector.eps", mime: "application/postscript", size: 2_000_000 },
        { fileName: "asset.psd", size: 8_000_000 },
        { fileName: "corel.cdr", mime: "application/octet-stream", size: 4_000_000 },
      ]) {
        expect(validateUploadForPurpose("design_resource", file).ok).toBe(true);
      }
    });

    it("accepts by extension when MIME is missing or generic", () => {
      expect(
        validateUploadForPurpose("design_resource", {
          fileName: "logo.PNG",
          size: 10_000,
        }).ok
      ).toBe(true);
      expect(
        validateUploadForPurpose("design_resource", {
          fileName: "deck.pdf",
          size: 10_000,
          mime: "application/octet-stream",
        }).ok
      ).toBe(true);
    });

    it("rejects empty, oversize, and disallowed types", () => {
      const empty = validateUploadForPurpose("design_resource", {
        fileName: "logo.png",
        size: 0,
        mime: "image/png",
      });
      expect(empty).toMatchObject({ ok: false, reason: "file_empty" });

      const oversize = validateUploadForPurpose("design_resource", {
        fileName: "huge.pdf",
        size: maxBytes + 1,
        mime: "application/pdf",
      });
      expect(oversize).toMatchObject({ ok: false, reason: "file_size" });

      for (const file of [
        { fileName: "malware.exe", mime: "application/x-msdownload", size: 1024 },
        { fileName: "pack.zip", mime: "application/zip", size: 1024 },
        { fileName: "notes.docx", mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", size: 1024 },
        { fileName: "clip.mp4", mime: "video/mp4", size: 1024 },
        { fileName: "page.html", mime: "text/html", size: 1024 },
        { fileName: "noext", mime: "text/plain", size: 1024 },
      ]) {
        const r = validateUploadForPurpose("design_resource", file);
        expect(r.ok).toBe(false);
        if (!r.ok) expect(r.reason).toBe("file_type");
      }
    });

    it("allows exactly the max size boundary", () => {
      expect(
        validateUploadForPurpose("design_resource", {
          fileName: "edge.pdf",
          size: maxBytes,
          mime: "application/pdf",
        }).ok
      ).toBe(true);
    });
  });

  describe("designs.resources records + staff download refs", () => {
    it("builds a designs.resources entry staff can open via signed read", () => {
      const ref = resourceRef("logo.webp");
      const record = buildDesignResourceRecord({
        id: "res-1",
        url: ref,
        name: "logo.webp",
        createdAt: "2026-01-01T00:00:00.000Z",
      });

      expect(record).toMatchObject({
        id: "res-1",
        url: ref,
        name: "logo.webp",
        type: "file",
        uploadedBy: "Customer",
      });

      expect(parseStoredRef(record.url)).toEqual({
        bucket: "order-resources",
        path: `${orderId}/logo.webp`,
      });
    });

    it("parses both modern refs and legacy public URLs for open/download", () => {
      const modern = resourceRef("a.png");
      const legacy = `https://xyz.supabase.co/storage/v1/object/public/order-resources/${orderId}/a.png`;

      expect(planStorageDelete(modern)).toEqual({
        bucket: "order-resources",
        path: `${orderId}/a.png`,
        cleansStorage: true,
      });
      expect(planStorageDelete(legacy)).toEqual({
        bucket: "order-resources",
        path: `${orderId}/a.png`,
        cleansStorage: true,
      });
      expect(planStorageDelete("https://cdn.example/logo.png")).toBeNull();
      expect(parseStoredRef("order-resources/../escape.png")).toBeNull();
    });

    it("appends new uploads without clobbering existing customer resources", () => {
      const existing = [
        buildDesignResourceRecord({
          id: "res-old",
          url: resourceRef("old.png"),
          name: "old.png",
          createdAt: "2026-01-01T00:00:00.000Z",
        }),
      ];
      const next = appendCustomerResources(existing, [
        { id: "res-new-1", url: resourceRef("logo.png"), name: "logo.png" },
        { id: "res-new-2", url: resourceRef("brief.pdf"), name: "brief.pdf" },
      ]);

      expect(next.map((r) => r.id)).toEqual(["res-old", "res-new-1", "res-new-2"]);
      expect(next.map((r) => r.name)).toEqual(["old.png", "logo.png", "brief.pdf"]);
    });

    it("partial multi-upload success only persists the ok files", () => {
      const okUploads = [
        { id: "ok-1", url: resourceRef("a.png"), name: "a.png" },
        // failed upload never appears in this list
      ];
      const resources = appendCustomerResources([], okUploads);
      expect(resources).toHaveLength(1);
      expect(resources[0].name).toBe("a.png");
    });
  });

  describe("delete + portal safety", () => {
    it("removes by id and plans storage cleanup (db then storage)", () => {
      const url = resourceRef("logo.png");
      const resources = [
        buildDesignResourceRecord({ id: "res-1", url, name: "logo.png" }),
        buildDesignResourceRecord({
          id: "res-2",
          url: resourceRef("mood.jpg"),
          name: "mood.jpg",
        }),
      ];

      const remaining = removeDesignResourceById(resources, "res-1");
      expect(remaining.map((r) => r.id)).toEqual(["res-2"]);
      expect(planStorageDelete(url)?.bucket).toBe("order-resources");
      expect(stageLifecycle("design_resource").deleteOrder).toBe("db_then_storage");
    });

    it("deleting an unknown id is a no-op; deleting twice does not throw", () => {
      const resources = [
        buildDesignResourceRecord({
          id: "res-1",
          url: resourceRef("logo.png"),
          name: "logo.png",
        }),
      ];
      const once = removeDesignResourceById(resources, "missing");
      expect(once).toHaveLength(1);
      const empty = removeDesignResourceById(resources, "res-1");
      expect(removeDesignResourceById(empty, "res-1")).toEqual([]);
    });

    it("portal may only delete order-resources / design-proofs for the same order", () => {
      const own = parseStoredRef(resourceRef("logo.png"))!;
      expect(PORTAL_DELETE_BUCKETS.has(own.bucket)).toBe(true);
      expect(own.path.startsWith(`${orderId}/`)).toBe(true);
      expect(isValidOrderScopedPath(orderId, own.path)).toBe(true);

      const foreign = parseStoredRef(resourceRef("logo.png", otherOrderId))!;
      expect(foreign.path.startsWith(`${orderId}/`)).toBe(false);

      const siteVisit = parseStoredRef(
        toStoredRef("site-visit-photos", `${orderId}/a.jpg`)
      )!;
      expect(PORTAL_DELETE_BUCKETS.has(siteVisit.bucket)).toBe(false);

      expect(isValidOrderScopedPath(orderId, `${orderId}/../x.png`)).toBe(false);
    });
  });

  describe("DB failure rollback", () => {
    it("rolls back only newly uploaded storage refs when designs.resources write fails", () => {
      const existing = resourceRef("keep-me.png");
      const newlyUploaded = [
        { bucket: "order-resources", path: `${orderId}/new-1.png` },
        { bucket: "order-resources", path: `${orderId}/new-2.pdf` },
      ];

      const toDelete = rollbackRefsOnDbFailure(newlyUploaded);
      expect(toDelete).toEqual([
        `order-resources/${orderId}/new-1.png`,
        `order-resources/${orderId}/new-2.pdf`,
      ]);
      // existing resource is not in the rollback set
      expect(toDelete).not.toContain(existing);
    });
  });

  describe("customer visibility", () => {
    it("keeps resources visible to the customer while stripping staff-only drafts", () => {
      const design: DesignRecord = {
        id: "d1",
        order_id: orderId,
        resources: [
          buildDesignResourceRecord({
            id: "res-1",
            url: resourceRef("logo.png"),
            name: "logo.png",
            createdAt: "2026-01-01T00:00:00.000Z",
          }),
        ],
        items: [
          {
            id: "item-1",
            name: "Sign",
            currentVersion: 1,
            versions: [
              {
                id: "v-draft",
                versionNumber: 1,
                proofUrl: "design-proofs/x/draft.png",
                status: "Draft",
                comments: [],
                createdAt: "2026-01-01T00:00:00.000Z",
              },
              {
                id: "v-sent",
                versionNumber: 2,
                proofUrl: "design-proofs/x/sent.png",
                status: "Sent to Customer",
                comments: [],
                createdAt: "2026-01-02T00:00:00.000Z",
              },
            ],
          },
        ],
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
      };

      const visible = toCustomerVisibleDesign(design)!;
      expect(visible.resources).toHaveLength(1);
      expect(visible.resources[0].name).toBe("logo.png");
      expect(visible.items[0].versions.map((v) => v.id)).toEqual(["v-sent"]);
    });
  });

  /**
   * Regression: customer feedback/approval must NOT wipe staff-only draft versions
   * or production files from the designs.items JSON. The portal only sees customer-
   * visible items; updateDesignDetailsAction re-attaches staff-only data via
   * mergePortalDesignItemsPreservingStaffDrafts before writing.
   */
  describe("portal feedback preserves staff drafts (regression)", () => {
    it("re-attaches staff-only draft versions stripped by toCustomerVisibleDesign", () => {
      const dbItems: any[] = [
        {
          id: "item-1",
          name: "Sign",
          currentVersion: 2,
          versions: [
            { id: "v-draft", versionNumber: 1, proofUrl: "design-proofs/x/d.png", status: "Draft", comments: [], createdAt: "2026-01-01" },
            { id: "v-sent", versionNumber: 2, proofUrl: "design-proofs/x/s.png", status: "Sent to Customer", comments: [], createdAt: "2026-01-02" },
          ],
          productionFiles: [{ id: "pf-1", name: "final.ai", url: "production-files/x/f.ai", createdAt: "2026-01-03" }],
        },
      ];

      // Portal sees customer-visible items (Draft stripped, productionFiles undefined).
      const visible = toCustomerVisibleDesign({ items: dbItems } as any)!;
      const portalItems = visible.items;

      // Customer adds feedback → sends portalItems back with a new comment on v-sent.
      const portalFeedbackItems = portalItems.map((item) => ({
        ...item,
        versions: item.versions.map((v) =>
          v.id === "v-sent" ? { ...v, status: "Changes Requested", comments: [{ id: "c1", content: "Make it bigger", author: "Client", createdAt: "2026-01-04", isGeneral: true }] } : v
        ),
      }));

      // Server merges portal feedback with DB items before writing.
      const merged = mergePortalDesignItemsPreservingStaffDrafts(dbItems, portalFeedbackItems);

      expect(merged).toHaveLength(1);
      const versions = merged[0].versions.map((v) => v.id);
      expect(versions).toContain("v-draft");
      expect(versions).toContain("v-sent");
      expect(merged[0].versions).toHaveLength(2);
      expect(merged[0].productionFiles).toEqual(dbItems[0].productionFiles);
      // Customer's feedback is preserved on v-sent.
      const sentV = merged[0].versions.find((v) => v.id === "v-sent")!;
      expect(sentV.status).toBe("Changes Requested");
      expect(sentV.comments).toHaveLength(1);
    });

    it("preserves items the portal didn't send (e.g. staff-only items)", () => {
      const dbItems: any[] = [
        { id: "item-1", name: "Sign A", currentVersion: 0, versions: [], productionFiles: [] },
        { id: "item-2", name: "Sign B", currentVersion: 0, versions: [], productionFiles: [] },
      ];
      const portalItems = [dbItems[0]]; // portal only sent item-1
      const merged = mergePortalDesignItemsPreservingStaffDrafts(dbItems, portalItems);
      expect(merged.map((i) => i.id)).toEqual(["item-1", "item-2"]);
    });

    it("does not duplicate versions the portal already updated", () => {
      const dbItems: any[] = [
        {
          id: "item-1",
          name: "Sign",
          currentVersion: 2,
          versions: [
            { id: "v1", versionNumber: 1, proofUrl: "p1", status: "Approved", comments: [], createdAt: "2026-01-01" },
            { id: "v2", versionNumber: 2, proofUrl: "p2", status: "Sent to Customer", comments: [], createdAt: "2026-01-02" },
          ],
          productionFiles: [],
        },
      ];
      const portalItems = [
        {
          id: "item-1",
          name: "Sign",
          currentVersion: 2,
          versions: [
            { id: "v1", versionNumber: 1, proofUrl: "p1", status: "Approved", comments: [], createdAt: "2026-01-01" },
            { id: "v2", versionNumber: 2, proofUrl: "p2", status: "Approved", comments: [], createdAt: "2026-01-02" },
          ],
          productionFiles: undefined,
        },
      ];
      const merged = mergePortalDesignItemsPreservingStaffDrafts(dbItems, portalItems);
      expect(merged[0].versions.map((v) => v.id)).toEqual(["v1", "v2"]);
      expect(merged[0].versions).toHaveLength(2);
    });
  });
});
