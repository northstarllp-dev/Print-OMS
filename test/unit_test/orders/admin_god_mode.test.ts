import { describe, expect, it } from "vitest";
import {
  assertQuotationEditable,
  assertUpsertStatusTransition,
} from "@/features/quotations/utils/quotationSecurity";
import { isSiteVisitUiFrozen } from "@/features/orders/workspace/modules/site-visit/siteVisitUiLogic";
import {
  assertDesignEditable,
  isDesignPendingAdminLocked,
  isStageModuleEditable,
  resolveEffectiveAdminOverride,
  resolveStageSaveAuthMode,
} from "@/features/orders/workspace/shared/adminGodMode";

describe("Admin God Mode", () => {
  describe("resolveEffectiveAdminOverride", () => {
    it("keeps unlock when order is still open", () => {
      expect(resolveEffectiveAdminOverride(false, true)).toBe(true);
      expect(resolveEffectiveAdminOverride(false, false)).toBe(false);
    });

    it("forces lock when order is Completed/Closed", () => {
      expect(resolveEffectiveAdminOverride(true, true)).toBe(false);
      expect(resolveEffectiveAdminOverride(true, false)).toBe(false);
    });
  });

  describe("quotation Approved lock", () => {
    it("blocks save without override", () => {
      expect(() => assertQuotationEditable("Approved")).toThrow(/locked/);
      expect(() => assertUpsertStatusTransition("Approved", "Sent")).toThrow(/locked/);
    });

    it("allows force-edit of Approved with adminOverride", () => {
      expect(() => assertQuotationEditable("Approved", true)).not.toThrow();
      expect(() => assertUpsertStatusTransition("Approved", "Sent", true)).not.toThrow();
    });

    it("does not let God Mode set Approved via upsert", () => {
      expect(() => assertUpsertStatusTransition("Draft", "Approved", true)).toThrow(
        /workflow action/
      );
    });
  });

  describe("design pending-admin lock", () => {
    it("detects lock only on design stages with non-Normal stage_status", () => {
      expect(isDesignPendingAdminLocked("Design In Progress", "Pending Admin Approval")).toBe(
        true
      );
      expect(isDesignPendingAdminLocked("Design Approved", "Pending Admin Approval: Design")).toBe(
        true
      );
      expect(isDesignPendingAdminLocked("Design In Progress", "Normal")).toBe(false);
      expect(isDesignPendingAdminLocked("Design In Progress", null)).toBe(false);
      expect(isDesignPendingAdminLocked("Quotation In Progress", "Pending Admin Approval")).toBe(
        false
      );
    });

    it("blocks staff edits when locked", () => {
      expect(() =>
        assertDesignEditable("Design In Progress", "Pending Admin Approval")
      ).toThrow(/Design is locked/);
    });

    it("allows edits when adminOverride is true", () => {
      expect(() =>
        assertDesignEditable("Design In Progress", "Pending Admin Approval", true)
      ).not.toThrow();
      expect(() =>
        assertDesignEditable("Design Approved", "Pending Admin Approval", true)
      ).not.toThrow();
    });
  });

  describe("stage module UI editability (Site Visit / Production / Installation)", () => {
    it("blocks when baseFrozen without God Mode", () => {
      expect(
        isStageModuleEditable({ baseFrozen: true, adminOverrideUnlocked: false, canEdit: true })
      ).toBe(false);
    });

    it("unlocks frozen modules when God Mode is on", () => {
      expect(
        isStageModuleEditable({ baseFrozen: true, adminOverrideUnlocked: true, canEdit: true })
      ).toBe(true);
    });

    it("keeps view-only actors frozen even with God Mode", () => {
      expect(
        isStageModuleEditable({ baseFrozen: true, adminOverrideUnlocked: true, canEdit: false })
      ).toBe(false);
    });

    it("site visit UI freeze mirrors the shared gate", () => {
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
          adminOverrideUnlocked: true,
          canEdit: false,
        })
      ).toBe(true);
    });
  });

  describe("stage save auth mode", () => {
    it("routes God Mode saves through admin-only check", () => {
      expect(resolveStageSaveAuthMode(true)).toBe("admin_only");
      expect(resolveStageSaveAuthMode(false)).toBe("stage_permission");
    });
  });
});
