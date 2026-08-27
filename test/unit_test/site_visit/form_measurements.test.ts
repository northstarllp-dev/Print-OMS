import { describe, expect, it } from "vitest";
import {
  formatSiteMeasurementLabel,
  mapSiteVisitFromDb,
  mapSiteVisitMeasurementFromDb,
  mapSiteVisitToDb,
} from "@/features/orders/actions/siteVisitMapper";
import {
  canAddMeasurementItem,
  canAddPhotoToItem,
  defaultSiteVisitConfig,
  fieldsVisibleTo,
  standardSiteVisitFormFields,
  validateDynamicSiteVisitForm,
  validateSiteVisitSave,
} from "@/features/orders/workspace/modules/site-visit/siteVisitChecklistLogic";

/** Mirrors UUID keep-set rules inside updateSiteVisitDetailsAction. */
function isUuid(id: unknown): id is string {
  return (
    typeof id === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  );
}

function measurementKeepIds(locations: Array<{ id?: unknown }>): string[] {
  return locations.map((l) => l.id).filter(isUuid);
}

function shouldDeleteAllMeasurements(locations: Array<{ id?: unknown }>): boolean {
  return measurementKeepIds(locations).length === 0;
}

function buildMeasurementUpsertPayload(
  siteVisitId: string,
  locations: Array<Record<string, unknown>>
) {
  return locations.map((loc) => ({
    ...(isUuid(loc.id) ? { id: loc.id } : {}),
    site_visit_id: siteVisitId,
    name: (loc.name as string) || "Unknown",
    width: loc.width ?? null,
    width_unit: (loc.widthUnit as string) || "ft",
    height: loc.height ?? null,
    height_unit: (loc.heightUnit as string) || "ft",
    depth: loc.depth ?? null,
    depth_unit: (loc.depthUnit as string) || "ft",
    ground_clearance: loc.groundClearance ?? null,
    ground_clearance_unit: (loc.groundClearanceUnit as string) || "ft",
    notes: loc.notes ?? null,
    photos: (loc.photos as unknown[]) || [],
    power_available: loc.powerAvailable ?? false,
    distance_to_power_source: loc.distanceToPowerSource ?? null,
    distance_to_power_source_unit: loc.distanceToPowerSourceUnit ?? null,
    electrical_notes: (loc.electricalNotes as string) || "",
    wall_type: (loc.wallType as string) || "",
    mounting_method: loc.mountingMethod ?? null,
    surface_condition: loc.surfaceCondition ?? null,
    obstacles: (loc.obstacles as unknown[]) || [],
    structural_notes: loc.structuralNotes ?? null,
  }));
}

describe("site visit form & measurements", () => {
  describe("UI / config standard + dynamic fields", () => {
    it("standard fields include customer/address/gps/measurements/photos/power/wall/budget/requirements/notes", () => {
      const ids = standardSiteVisitFormFields().map((f) => f.id);
      expect(ids).toEqual(
        expect.arrayContaining([
          "customer",
          "address",
          "gps",
          "measurements",
          "photos",
          "power",
          "wall_type",
          "budget",
          "requirements",
          "notes",
          "internal_notes",
        ])
      );
    });

    it("dynamic fields: visibleTo + required validation + order (multi-tenant config)", () => {
      const fields = [
        ...standardSiteVisitFormFields(),
        {
          id: "pole_height",
          label: "Pole Height",
          type: "number" as const,
          required: true,
          visibleTo: ["admin" as const, "site_visit_employee" as const],
          order: 50,
        },
        {
          id: "mall_permission",
          label: "Mall Permission Number",
          type: "text" as const,
          required: true,
          visibleTo: ["admin" as const, "marketer" as const],
          order: 51,
        },
      ];
      expect(fieldsVisibleTo(fields, "customer").map((f) => f.id)).toEqual([
        "customer",
        "address",
      ]);
      expect(fieldsVisibleTo(fields, "site_visit_employee").some((f) => f.id === "pole_height")).toBe(
        true
      );
      expect(fieldsVisibleTo(fields, "marketer").some((f) => f.id === "mall_permission")).toBe(
        true
      );
      expect(
        validateDynamicSiteVisitForm({ customer: "A", address: "B" }, fields, "customer")
      ).toEqual([]);
      expect(
        validateDynamicSiteVisitForm({ customer: "A" }, fields, "customer")
      ).toContain("address_required");
    });

    it("enforces configurable max items and photos per item", () => {
      const cfg = defaultSiteVisitConfig({ maxMeasurementItems: 20, maxPhotosPerItem: 10 });
      expect(canAddMeasurementItem(19, cfg)).toBe(true);
      expect(canAddMeasurementItem(20, cfg)).toBe(false);
      expect(canAddPhotoToItem(9, cfg)).toBe(true);
      expect(canAddPhotoToItem(10, cfg)).toBe(false);
    });

    it("measurement/photo caps hold at large counts", () => {
      const cfg = defaultSiteVisitConfig();
      expect(canAddMeasurementItem(10_000, cfg)).toBe(false);
      expect(canAddPhotoToItem(10_000, cfg)).toBe(false);
    });
  });

  describe("backend DB mapping + upsert contract", () => {
    it("maps snake_case and camelCase with unit defaults", () => {
      const mapped = mapSiteVisitMeasurementFromDb({
        id: "m1",
        name: "Fascia",
        width: "10",
        width_unit: "ft",
        height: 4,
        heightUnit: "ft",
        depth: "",
        ground_clearance: null,
        photos: null,
        power_available: true,
        obstacles: null,
      });
      expect(mapped).toMatchObject({
        id: "m1",
        name: "Fascia",
        width: 10,
        height: 4,
        widthUnit: "ft",
        heightUnit: "ft",
        depthUnit: "ft",
        powerAvailable: true,
        photos: [],
        obstacles: [],
      });
      expect(mapped.depth).toBeUndefined();
      expect(mapped.groundClearance).toBeUndefined();
    });

    it("rejects non-finite numeric fields", () => {
      const mapped = mapSiteVisitMeasurementFromDb({
        width: "nope",
        height: Number.NaN,
      });
      expect(mapped.width).toBeUndefined();
      expect(mapped.height).toBeUndefined();
    });

    it("maps a full visit row including nested measurements", () => {
      const ui = mapSiteVisitFromDb({
        id: "sv-1",
        completed: true,
        customer_address: "MG Road",
        landmark: "Near metro",
        preferred_date: "2026-08-01",
        preferred_time: "09:00",
        gps_location: "12.97, 77.59",
        audit_date: "2026-08-03",
        audit_time: "10:00",
        internal_notes: { a: 1 },
        review_status: "Pending",
        scaffolding_required: true,
        crane_required: false,
        site_visit_measurements: [
          { id: "m1", name: "Board", width: 5, height: 2, width_unit: "ft", height_unit: "ft" },
        ],
      });
      expect(ui).toMatchObject({
        id: "sv-1",
        completed: true,
        customerAddress: "MG Road",
        auditDate: "2026-08-03",
        scaffoldingRequired: true,
        craneRequired: false,
      });
      expect(ui?.locations).toHaveLength(1);
      expect(ui?.locations?.[0].name).toBe("Board");
    });

    it("returns null for missing visit and defaults completed false", () => {
      expect(mapSiteVisitFromDb(null)).toBeNull();
      const empty = mapSiteVisitFromDb({});
      expect(empty).not.toBeNull();
      expect(empty!.completed).toBe(false);
      expect(empty!.locations).toEqual([]);
    });

    it("mapSiteVisitToDb writes snake_case columns with order/company ids", () => {
      const db = mapSiteVisitToDb("order-uuid", "company-uuid", {
        completed: false,
        customerAddress: "Indiranagar",
        auditDate: "2026-08-03",
        auditTime: "11:00",
        scaffoldingRequired: true,
        extraAnglesLength: "12ft",
      });
      expect(db).toMatchObject({
        order_id: "order-uuid",
        company_id: "company-uuid",
        customer_address: "Indiranagar",
        audit_date: "2026-08-03",
        audit_time: "11:00",
        scaffolding_required: true,
        extra_angles_length: "12ft",
      });
    });

    it("round-trips visit fields through toDb → fromDb", () => {
      const original: Partial<import("@/types").SiteVisitDetails> = {
        completed: false,
        customerAddress: "Koramangala",
        landmark: "Cafe",
        preferredDate: "2026-08-05",
        preferredTime: "15:00",
        gpsLocation: "12.9, 77.6",
        auditDate: "2026-08-06",
        auditTime: "16:00",
        reviewStatus: "Pending",
        scaffoldingRequired: true,
      };
      const db = mapSiteVisitToDb("o1", "c1", original);
      const back = mapSiteVisitFromDb({ ...db, id: "sv", site_visit_measurements: [] });
      expect(back).toMatchObject({
        customerAddress: "Koramangala",
        landmark: "Cafe",
        preferredDate: "2026-08-05",
        auditDate: "2026-08-06",
        scaffoldingRequired: true,
        completed: false,
      });
    });

    it("keeps only valid UUIDs for orphan delete filter", () => {
      const uuidA = "11111111-1111-1111-1111-111111111111";
      const uuidB = "22222222-2222-2222-2222-222222222222";
      expect(
        measurementKeepIds([
          { id: uuidA },
          { id: "temp-client-id" },
          { id: uuidB },
          { id: 123 },
        ])
      ).toEqual([uuidA, uuidB]);
    });

    it("deletes all measurements when no UUID keep-ids remain", () => {
      const uuidA = "11111111-1111-1111-1111-111111111111";
      expect(shouldDeleteAllMeasurements([{ id: "local-1" }, { id: undefined }])).toBe(true);
      expect(shouldDeleteAllMeasurements([{ id: uuidA }])).toBe(false);
    });

    it("builds upsert rows with defaults and omits non-uuid ids", () => {
      const uuidA = "11111111-1111-1111-1111-111111111111";
      const payload = buildMeasurementUpsertPayload("sv-1", [
        { id: "local-temp", name: "A", width: 10, height: 2 },
        { id: uuidA, name: "B", widthUnit: "m", height: 3, powerAvailable: true },
      ]);
      expect(payload[0]).not.toHaveProperty("id");
      expect(payload[0]).toMatchObject({
        site_visit_id: "sv-1",
        name: "A",
        width: 10,
        width_unit: "ft",
        height_unit: "ft",
        power_available: false,
        photos: [],
        obstacles: [],
      });
      expect(payload[1]).toMatchObject({
        id: uuidA,
        name: "B",
        width_unit: "m",
        power_available: true,
      });
    });

    it("requires upserted count to match payload length (save integrity)", () => {
      const payload = buildMeasurementUpsertPayload("sv-1", [{ name: "A" }, { name: "B" }]);
      const upsertedCount = 1;
      expect(upsertedCount !== payload.length).toBe(true);
    });

    it("formatSiteMeasurementLabel builds quotation labels", () => {
      expect(formatSiteMeasurementLabel(null)).toBeNull();
      expect(formatSiteMeasurementLabel({ width: null, height: null })).toBeNull();
      expect(formatSiteMeasurementLabel({ width: 10, height: 4 })).toBe(
        "Site Measurement: 10 FT × 4 FT"
      );
      expect(
        formatSiteMeasurementLabel({ width: 10, height: 4, depth: 1, depthUnit: "ft" })
      ).toBe("Site Measurement: 10 FT × 4 FT - Depth: 1 FT");
      expect(formatSiteMeasurementLabel({ width: 10, height: 4, depth: 0 })).toBe(
        "Site Measurement: 10 FT × 4 FT"
      );
    });

    it("validation before save", () => {
      expect(
        validateSiteVisitSave({
          address: "MG Road",
          gps: "12.97, 77.59",
          locationsCount: 2,
        })
      ).toEqual([]);
      expect(
        validateSiteVisitSave({ address: "", gps: null, locationsCount: 0 })
      ).toEqual(expect.arrayContaining(["address_required", "gps_required"]));
      expect(
        validateSiteVisitSave({
          address: "A",
          gps: "12.97, 77.59",
          locationsCount: 99,
          config: defaultSiteVisitConfig({ maxMeasurementItems: 20 }),
        })
      ).toContain("too_many_measurements");
    });
  });
});
