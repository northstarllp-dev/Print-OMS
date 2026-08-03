import { describe, expect, it } from "vitest";
import {
  mapSiteVisitFromDb,
  mapSiteVisitMeasurementFromDb,
  mapSiteVisitToDb,
  resolveSiteVisitInstallationAddress,
} from "@/features/orders/actions/siteVisitMapper";
import {
  mergeOrderDetailPatch,
  patchFromMeasurementEvent,
  patchFromSiteVisitRow,
} from "@/features/orders/realtime/orderDetailPatch";

describe("site visit backend / DB", () => {
  describe("mappers", () => {
    it("maps measurement snake_case → UI camelCase", () => {
      const loc = mapSiteVisitMeasurementFromDb({
        id: "m1",
        name: "Fascia",
        width: 10,
        width_unit: "ft",
        height: 4,
        height_unit: "ft",
        power_available: true,
        photos: ["a.jpg"],
      });
      expect(loc).toMatchObject({
        id: "m1",
        name: "Fascia",
        width: 10,
        widthUnit: "ft",
        height: 4,
        powerAvailable: true,
      });
    });

    it("returns null for missing visit and defaults completed false", () => {
      expect(mapSiteVisitFromDb(null)).toBeNull();
      const empty = mapSiteVisitFromDb({});
      expect(empty).not.toBeNull();
      expect(empty!.completed).toBe(false);
      expect(empty!.locations).toEqual([]);
    });

    it("round-trips visit fields through mapSiteVisitToDb", () => {
      const ui = mapSiteVisitFromDb({
        id: "sv1",
        completed: true,
        customer_address: "12 MG Road",
        audit_date: "2026-08-03",
        audit_time: "10:00",
        site_visit_measurements: [],
      });
      expect(ui).not.toBeNull();
      const db = mapSiteVisitToDb("order-1", "company-1", ui!);
      expect(db.customer_address).toBe("12 MG Road");
      expect(db.completed).toBe(true);
      expect(db.audit_date).toBe("2026-08-03");
      expect(db.order_id).toBe("order-1");
    });

    it("resolves installation address from site visit with shipping fallback", () => {
      expect(
        resolveSiteVisitInstallationAddress(
          { customerAddress: "Surveyed site lane" },
          "Customer shipping"
        )
      ).toBe("Surveyed site lane");
      expect(
        resolveSiteVisitInstallationAddress(null, "Customer shipping lane")
      ).toBe("Customer shipping lane");
      expect(
        resolveSiteVisitInstallationAddress(null, "Installation Address Pending Survey")
      ).toBeNull();
    });
  });

  describe("realtime merge", () => {
    it("merges site-visit row patches without dropping locations", () => {
      const next = mergeOrderDetailPatch(
        {
          id: "o1",
          siteVisitDetails: {
            completed: false,
            locations: [{ id: "m1", name: "A", photos: [], obstacles: [] }],
          },
        } as any,
        patchFromSiteVisitRow({
          id: "sv1",
          completed: true,
          customer_address: "Updated",
          site_visit_measurements: [],
        })
      );
      expect(next.siteVisitDetails?.completed).toBe(true);
      expect(next.siteVisitDetails?.locations).toHaveLength(1);
    });

    it("applies measurement event patches", () => {
      const next = mergeOrderDetailPatch(
        {
          id: "o1",
          siteVisitDetails: { locations: [] },
        } as any,
        patchFromMeasurementEvent(
          "INSERT",
          { id: "m2", name: "Pillar", width: 2, width_unit: "ft" },
          null
        )
      );
      expect(next.siteVisitDetails?.locations?.some((l: any) => l.id === "m2")).toBe(
        true
      );
    });
  });
});
