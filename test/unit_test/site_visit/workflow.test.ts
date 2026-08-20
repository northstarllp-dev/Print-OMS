import { describe, expect, it } from "vitest";
import {
  getTabForStage,
  didStageAdvance,
  getTabPipelineIndex,
} from "@/app/portal/utils/portalStageNavigation";
import { isSiteVisitAuditFrozen } from "@/features/orders/workspace/modules/site-visit/siteVisitFreeze";
import {
  SITE_VISIT_PIPELINE,
  canActorApproveStage,
  canActorRequestStageAdvance,
  isValidSiteVisitStageTransition,
} from "@/features/orders/workspace/modules/site-visit/siteVisitChecklistLogic";
import {
  canAdvanceSiteVisitAudit,
  isSiteVisitModuleBaseFrozen,
  isSiteVisitUiFrozen,
  mergeIncomingSiteVisitDetails,
  resolveDisplaySiteVisitStage,
  siteVisitReviewCopy,
} from "@/features/orders/workspace/modules/site-visit/siteVisitUiLogic";

describe("site visit workflow", () => {
  describe("UI — advance, freeze, display, portal tabs", () => {
    it("keeps unsaved locations when a server snapshot has none yet", () => {
      const local = {
        landmark: "SKIPPED_SITE_VISIT",
        customerAddress: "Indiranagar",
        locations: [{ id: "item-1" }],
      };
      const incoming = {
        landmark: "SKIPPED_SITE_VISIT",
        customerAddress: "Indiranagar",
        locations: [],
      };
      expect(mergeIncomingSiteVisitDetails(local, incoming)?.locations).toEqual([
        { id: "item-1" },
      ]);
      expect(
        mergeIncomingSiteVisitDetails(
          { locations: [{ id: "a" }] },
          { locations: [{ id: "a" }, { id: "b" }] }
        )?.locations
      ).toHaveLength(2);
    });

    it("blocks advance until schedule or skip + at least one location", () => {
      expect(
        canAdvanceSiteVisitAudit({
          auditDate: "2026-08-03",
          auditTime: "10:00",
          locations: [{ id: "1" }],
        })
      ).toEqual({ ok: true, tooltip: "" });

      expect(
        canAdvanceSiteVisitAudit({
          landmark: "SKIPPED_SITE_VISIT",
          customerAddress: "123 Main St",
          locations: [{ id: "1" }],
        }).ok
      ).toBe(true);

      const noSchedule = canAdvanceSiteVisitAudit({
        auditDate: null,
        auditTime: null,
        locations: [{ id: "1" }],
      });
      expect(noSchedule.ok).toBe(false);
      expect(noSchedule.tooltip).toMatch(/Schedule or skip/);

      const noLocations = canAdvanceSiteVisitAudit({
        auditDate: "2026-08-03",
        auditTime: "10:00",
        locations: [],
      });
      expect(noLocations.ok).toBe(false);
      expect(noLocations.tooltip).toMatch(/location/);
    });

    it("base freeze: non–Site Visit stages or completed+non-Normal", () => {
      expect(isSiteVisitModuleBaseFrozen("Quotation In Progress", "Normal", false)).toBe(true);
      expect(isSiteVisitModuleBaseFrozen("Site Visit Pending", "Normal", false)).toBe(false);
      expect(isSiteVisitModuleBaseFrozen("Site Visit Completed", "Normal", true)).toBe(false);
      expect(
        isSiteVisitModuleBaseFrozen(
          "Site Visit Completed",
          "Pending Admin Approval: Site Visit Completed",
          true
        )
      ).toBe(true);
    });

    it("UI freeze respects admin unlock and canEdit", () => {
      expect(
        isSiteVisitUiFrozen({
          stage: "Quotation In Progress",
          completed: false,
          canEdit: true,
        })
      ).toBe(true);
      expect(
        isSiteVisitUiFrozen({
          stage: "Quotation In Progress",
          completed: false,
          adminOverrideUnlocked: true,
          canEdit: true,
        })
      ).toBe(false);
      expect(
        isSiteVisitUiFrozen({
          stage: "Site Visit Pending",
          completed: false,
          canEdit: false,
        })
      ).toBe(true);
    });

    it("shows Pending when Scheduled/Completed lack auditDate", () => {
      expect(resolveDisplaySiteVisitStage("Site Visit Scheduled", null)).toBe(
        "Site Visit Pending"
      );
      expect(resolveDisplaySiteVisitStage("Site Visit Completed", undefined)).toBe(
        "Site Visit Pending"
      );
      expect(resolveDisplaySiteVisitStage("Site Visit Scheduled", "2026-08-03")).toBe(
        "Site Visit Scheduled"
      );
      expect(resolveDisplaySiteVisitStage(null)).toBe("");
    });

    it("siteVisitReviewCopy differs for staff push vs admin lock", () => {
      expect(siteVisitReviewCopy("staff_push")).toEqual({
        confirmLabel: "Request Admin Approval",
        locksAudit: false,
      });
      expect(siteVisitReviewCopy("admin_lock")).toEqual({
        confirmLabel: "Lock & Continue",
        locksAudit: true,
      });
    });

    it("maps Site Visit* stages to site_visit tab", () => {
      expect(getTabForStage("")).toBe("site_visit");
      expect(getTabForStage("Site Visit Pending")).toBe("site_visit");
      expect(getTabForStage("Site Visit Scheduled")).toBe("site_visit");
      expect(getTabForStage("Quotation Sent")).toBe("quotation");
    });

    it("didStageAdvance is false within the same tab", () => {
      expect(
        didStageAdvance("Site Visit Pending", "Site Visit Scheduled", "quote_first")
      ).toBe(false);
      expect(
        didStageAdvance("Site Visit Completed", "Quotation In Progress", "quote_first")
      ).toBe(true);
      expect(getTabPipelineIndex("site_visit")).toBe(0);
    });
  });

  describe("backend / security — audit freeze locks", () => {
    it("freezes when stage left Site Visit*", () => {
      expect(isSiteVisitAuditFrozen("Quotation In Progress", "Normal", false)).toBe(true);
    });

    it("freezes pending-admin even if completed flag is still false", () => {
      expect(
        isSiteVisitAuditFrozen(
          "Site Visit Completed",
          "Pending Admin Approval: Site Visit Completed",
          false
        )
      ).toBe(true);
    });

    it("allows editing active Site Visit with Normal status", () => {
      expect(isSiteVisitAuditFrozen("Site Visit Pending", "Normal", false)).toBe(false);
      expect(isSiteVisitAuditFrozen("Site Visit Scheduled", "Normal", false)).toBe(false);
      expect(isSiteVisitAuditFrozen("Site Visit Completed", "Normal", true)).toBe(false);
    });
  });

  describe("business rules — pipeline transitions", () => {
    it("documents pipeline and allows every valid transition", () => {
      expect(SITE_VISIT_PIPELINE[0]).toBe("Enquiry");
      expect(SITE_VISIT_PIPELINE).toContain("Site Visit Pending");
      expect(SITE_VISIT_PIPELINE).toContain("Site Visit Scheduled");
      expect(SITE_VISIT_PIPELINE).toContain("Site Visit Completed");
      expect(isValidSiteVisitStageTransition("Enquiry", "Site Visit Pending")).toBe(true);
      expect(isValidSiteVisitStageTransition("Site Visit Pending", "Site Visit Scheduled")).toBe(
        true
      );
      expect(isValidSiteVisitStageTransition("Site Visit Scheduled", "Site Visit Completed")).toBe(
        true
      );
      expect(
        isValidSiteVisitStageTransition(
          "Site Visit Completed",
          "Pending Admin Approval: Site Visit Completed"
        )
      ).toBe(true);
      expect(
        isValidSiteVisitStageTransition(
          "Pending Admin Approval: Site Visit Completed",
          "Quotation In Progress"
        )
      ).toBe(true);
    });

    it("blocks invalid transitions", () => {
      expect(isValidSiteVisitStageTransition("Enquiry", "Quotation In Progress")).toBe(false);
      expect(isValidSiteVisitStageTransition("Site Visit Pending", "Production")).toBe(false);
      expect(
        isValidSiteVisitStageTransition("Quotation In Progress", "Site Visit Pending")
      ).toBe(false);
    });

    it("request vs approve actor gates", () => {
      expect(canActorRequestStageAdvance("marketer")).toBe(true);
      expect(canActorRequestStageAdvance("site_visit_employee")).toBe(true);
      expect(canActorApproveStage("marketer")).toBe(false);
      expect(canActorApproveStage("admin")).toBe(true);
    });
  });
});
