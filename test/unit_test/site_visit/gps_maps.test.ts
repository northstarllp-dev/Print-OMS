import { describe, expect, it } from "vitest";
import {
  isGoogleMapsUrl,
  parseCoordsFromMapsUrl,
  parsePlacePinCoordsFromMapsUrl,
  parseViewportCoordsFromMapsUrl,
} from "@/components/maps/mapsUrl";
import {
  buildGoogleMapsSearchUrl,
  resolveSiteVisitInstallationAddress,
  resolveSiteVisitMapLink,
} from "@/features/orders/actions/siteVisitMapper";
import {
  gpsCheckInPayload,
  haversineDistanceMeters,
  isGpsAccurateEnough,
  isNearScheduledLocation,
} from "@/features/orders/workspace/modules/site-visit/siteVisitChecklistLogic";
import {
  isSkippedSiteVisit,
  isSkippedSiteVisitAddress,
  parseGpsMapCenter,
  SKIPPED_SITE_VISIT_LANDMARK,
} from "@/features/orders/workspace/modules/site-visit/siteVisitUiLogic";

describe("site visit GPS & maps", () => {
  describe("UI parse GPS + skipped addresses", () => {
    it("parses plain and degree-suffixed GPS strings", () => {
      expect(parseGpsMapCenter("12.97, 77.59")).toEqual({ lat: 12.97, lng: 77.59 });
      expect(parseGpsMapCenter("12.97°N, 77.59°E")).toEqual({ lat: 12.97, lng: 77.59 });
    });

    it("returns null for missing or invalid values", () => {
      expect(parseGpsMapCenter(null)).toBeNull();
      expect(parseGpsMapCenter("")).toBeNull();
      expect(parseGpsMapCenter("12.97")).toBeNull();
      expect(parseGpsMapCenter("abc, def")).toBeNull();
    });

    it("detects Skipped addresses case-sensitively", () => {
      expect(isSkippedSiteVisitAddress("Skipped customer unavailable")).toBe(true);
      expect(isSkippedSiteVisitAddress("skipped elsewhere")).toBe(false);
      expect(isSkippedSiteVisitAddress(null)).toBe(false);
    });

    it("detects skip via landmark while keeping real installation address", () => {
      expect(
        isSkippedSiteVisit({
          landmark: SKIPPED_SITE_VISIT_LANDMARK,
          customerAddress: "12 MG Road, Bengaluru",
        })
      ).toBe(true);
      expect(
        resolveSiteVisitInstallationAddress({
          landmark: SKIPPED_SITE_VISIT_LANDMARK,
          customerAddress: "12 MG Road, Bengaluru",
        })
      ).toBe("12 MG Road, Bengaluru");
    });
  });

  describe("backend address + maps URL helpers", () => {
    it("prefers real site address and rejects placeholders / skipped", () => {
      expect(
        resolveSiteVisitInstallationAddress(
          { customerAddress: "Skipped N/A" },
          "Installation Address Pending Survey"
        )
      ).toBeNull();
      expect(
        resolveSiteVisitInstallationAddress(
          { customer_address: "  12 Residency Road  " },
          "Not Provided"
        )
      ).toBe("12 Residency Road");
      expect(
        resolveSiteVisitInstallationAddress(null, "Customer shipping lane")
      ).toBe("Customer shipping lane");
    });

    it("buildGoogleMapsSearchUrl encodes query and rejects N/A / Skipped", () => {
      expect(buildGoogleMapsSearchUrl("N/A")).toBeNull();
      expect(buildGoogleMapsSearchUrl("Skipped visit")).toBeNull();
      expect(buildGoogleMapsSearchUrl("MG Road")).toBe(
        "https://www.google.com/maps/search/?api=1&query=MG%20Road"
      );
    });

    it("resolveSiteVisitMapLink prefers real address, then GPS, never Skipped text", () => {
      expect(
        resolveSiteVisitMapLink({
          siteAddress: SKIPPED_SITE_VISIT_LANDMARK,
          customerAddress: "12 MG Road, Bengaluru",
        })
      ).toEqual({
        href: "https://www.google.com/maps/search/?api=1&query=12%20MG%20Road%2C%20Bengaluru",
        label: "12 MG Road, Bengaluru",
      });

      expect(
        resolveSiteVisitMapLink({
          customerAddress: "Skipped - Direct Measurement (Manual Entry)",
          gpsLocation: "12.97, 77.59",
        })
      ).toEqual({
        href: "https://www.google.com/maps/search/?api=1&query=12.97%2C%2077.59",
        label: "12.97, 77.59",
      });

      expect(
        resolveSiteVisitMapLink({
          customerAddress: "Skipped - Direct Measurement (Manual Entry)",
        })
      ).toBeNull();

      expect(
        resolveSiteVisitMapLink({
          customerAddress: "Skipped visit",
          gmapLink: "https://maps.google.com/?q=12.97,77.59",
        })
      ).toEqual({
        href: "https://maps.google.com/?q=12.97,77.59",
        label: "Open map location",
      });
    });
  });

  describe("security maps input hardening", () => {
    it("does not treat skipped addresses as navigable destinations", () => {
      expect(isSkippedSiteVisitAddress("Skipped refused")).toBe(true);
      expect(buildGoogleMapsSearchUrl("Skipped refused")).toBeNull();
    });

    it("detects Maps URLs so schedule flow can resolve instead of storing raw links", () => {
      expect(isGoogleMapsUrl("https://maps.app.goo.gl/abc")).toBe(true);
      expect(isGoogleMapsUrl("12 Residency Road")).toBe(false);
    });

    it("rejects out-of-range coordinates from Maps URLs", () => {
      expect(parsePlacePinCoordsFromMapsUrl("?q=99,200")).toBeNull();
      expect(
        parseViewportCoordsFromMapsUrl(
          "https://www.google.com/maps/@12.9716,77.5946,17z"
        )
      ).toEqual({ lat: 12.9716, lng: 77.5946 });
      expect(
        parseCoordsFromMapsUrl(
          "https://www.google.com/maps/@12.9716,77.5946,17z/data=!3d12.97!4d77.59"
        )
      ).toEqual({ lat: 12.97, lng: 77.59 });
    });
  });

  describe("business rules distance, accuracy, check-in", () => {
    it("distance, accuracy, near-scheduled, check-in timestamp", () => {
      const d = haversineDistanceMeters(
        { lat: 12.9716, lng: 77.5946 },
        { lat: 12.9726, lng: 77.5946 }
      );
      expect(d).toBeGreaterThan(50);
      expect(d).toBeLessThan(200);
      expect(isGpsAccurateEnough(25)).toBe(true);
      expect(isGpsAccurateEnough(80)).toBe(false);
      expect(
        isNearScheduledLocation({
          currentGps: "12.9716, 77.5946",
          scheduledGps: "12.9717, 77.5946",
          maxDistanceMeters: 50,
        })
      ).toBe(true);
      const checkIn = gpsCheckInPayload({
        lat: 12.97,
        lng: 77.59,
        accuracyMeters: 12,
        at: new Date("2026-08-03T10:00:00.000Z"),
      });
      expect(checkIn).toMatchObject({
        gps: "12.97, 77.59",
        accuracyMeters: 12,
        timestamp: "2026-08-03T10:00:00.000Z",
      });
    });
  });
});
