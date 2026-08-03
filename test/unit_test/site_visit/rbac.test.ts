import { describe, expect, it } from "vitest";
import {
  can,
  canApproveOwnSiteVisitWork,
  canEditSiteVisitAfterApproval,
  siteVisitButtonState,
  siteVisitCapabilities,
  siteVisitMutationAllowed,
} from "@/features/orders/workspace/modules/site-visit/siteVisitChecklistLogic";
import { isSiteVisitUiFrozen } from "@/features/orders/workspace/modules/site-visit/siteVisitUiLogic";
import {
  getStagePermissionInContext,
  isTimelineStageAccessible,
  resolveStagePermission,
} from "@/features/orders/workspace/shared/permissions";
import {
  DEFAULT_STAGE_GRANTS_BY_ROLE,
  getEditableStages,
  resolveStageGrant,
} from "@/features/orders/workspace/shared/stageGrants";
import type { StageActor } from "@/features/orders/workspace/shared/types";
import { filterStaffQueueOrders } from "@/features/orders/workspace/shared/staffQueueStages";

describe("site visit RBAC", () => {
  describe("capability matrix", () => {
    it("Admin: view/edit/delete/approve/reject/override/notes/workflow", () => {
      const a = siteVisitCapabilities("admin");
      expect(a.view_all).toBe(true);
      expect(a.edit_any).toBe(true);
      expect(a.delete).toBe(true);
      expect(a.delete_completed).toBe(true);
      expect(a.approve_schedule).toBe(true);
      expect(a.reject_schedule).toBe(true);
      expect(a.approve_completed).toBe(true);
      expect(a.reject_completed).toBe(true);
      expect(a.override_measurements).toBe(true);
      expect(a.override_employee).toBe(true);
      expect(a.reassign_employee).toBe(true);
      expect(a.view_internal_notes).toBe(true);
      expect(a.add_internal_notes).toBe(true);
      expect(a.change_workflow).toBe(true);
      expect(canApproveOwnSiteVisitWork("admin")).toBe(true);
    });

    it("Sales/Marketer: assigned work + schedule/measure/upload/request; cannot approve or delete completed", () => {
      const m = siteVisitCapabilities("marketer");
      expect(m.view_assigned).toBe(true);
      expect(m.schedule).toBe(true);
      expect(m.reschedule).toBe(true);
      expect(m.enter_measurements).toBe(true);
      expect(m.upload_photos).toBe(true);
      expect(m.upload_documents).toBe(true);
      expect(m.add_notes).toBe(true);
      expect(m.request_admin_approval).toBe(true);
      expect(m.approve_own_work).toBe(false);
      expect(m.approve_completed).toBe(false);
      expect(m.delete_completed).toBe(false);
      expect(m.view_all).toBe(false);
      expect(can("marketer", "approve_own_work")).toBe(false);
    });

    it("Site Visit Employee: field ops only; cannot approve or edit after approval", () => {
      const e = siteVisitCapabilities("site_visit_employee");
      expect(e.view_assigned).toBe(true);
      expect(e.check_in).toBe(true);
      expect(e.check_out).toBe(true);
      expect(e.upload_photos).toBe(true);
      expect(e.capture_gps).toBe(true);
      expect(e.enter_measurements).toBe(true);
      expect(e.complete_checklist).toBe(true);
      expect(e.request_admin_approval).toBe(true);
      expect(e.approve_completed).toBe(false);
      expect(e.edit_after_approval).toBe(false);
      expect(
        canEditSiteVisitAfterApproval({
          role: "site_visit_employee",
          stage: "Site Visit Completed",
          stageStatus: "Pending Admin Approval: Site Visit Completed",
          completed: true,
        })
      ).toBe(false);
      expect(
        canEditSiteVisitAfterApproval({
          role: "admin",
          stage: "Site Visit Completed",
          stageStatus: "Pending Admin Approval: Site Visit Completed",
          completed: true,
          adminReopened: true,
        })
      ).toBe(true);
    });

    it("Designer: view-only measurements/photos/notes; cannot edit", () => {
      const d = siteVisitCapabilities("designer");
      expect(d.view_measurements).toBe(true);
      expect(d.view_photos).toBe(true);
      expect(d.view_notes).toBe(true);
      expect(d.enter_measurements).toBe(false);
      expect(d.upload_photos).toBe(false);
      expect(d.schedule).toBe(false);
    });

    it("Production: view final approved measurements/photos only; cannot edit", () => {
      const p = siteVisitCapabilities("production");
      expect(p.view_final_approved_only).toBe(true);
      expect(p.view_photos).toBe(true);
      expect(p.enter_measurements).toBe(false);
      expect(p.upload_photos).toBe(false);
    });

    it("Customer: schedule/reschedule before confirm/view status/summary; cannot edit measurements or internal notes", () => {
      const c = siteVisitCapabilities("customer");
      expect(c.customer_schedule).toBe(true);
      expect(c.customer_reschedule_before_confirm).toBe(true);
      expect(c.customer_view_status).toBe(true);
      expect(c.customer_view_summary).toBe(true);
      expect(c.edit_measurements_as_customer).toBe(false);
      expect(c.edit_internal_notes_as_customer).toBe(false);
      expect(can("customer", "edit_internal_notes_as_customer")).toBe(false);
      expect(can("customer", "edit_measurements_as_customer")).toBe(false);
    });
  });

  describe("stage grants + queue isolation", () => {
    const admin: StageActor = { role: "admin" };
    const customer: StageActor = { role: "customer" };
    const installation: StageActor = { role: "staff", staff_role: "Installation" };
    const production: StageActor = { role: "staff", staff_role: "Production" };
    const designer: StageActor = { role: "staff", staff_role: "Designer" };
    const marketer: StageActor = { role: "staff", staff_role: "Marketer" };
    const unknown: StageActor = { role: "staff", staff_role: "Unknown Role" };

    it("admin always has view+edit", () => {
      expect(resolveStagePermission("site_visit", admin)).toEqual({
        canView: true,
        canEdit: true,
      });
    });

    it("non-staff actors have no access via stage grants", () => {
      expect(resolveStagePermission("site_visit", customer)).toEqual({
        canView: false,
        canEdit: false,
      });
    });

    it("default role matrix grants site_visit to Installation/Designer/Marketer only", () => {
      expect(DEFAULT_STAGE_GRANTS_BY_ROLE.Installation.site_visit).toEqual({
        canView: true,
        canEdit: true,
      });
      expect(DEFAULT_STAGE_GRANTS_BY_ROLE.Designer.site_visit).toEqual({
        canView: true,
        canEdit: true,
      });
      expect(DEFAULT_STAGE_GRANTS_BY_ROLE.Marketer.site_visit).toEqual({
        canView: true,
        canEdit: true,
      });
      expect(DEFAULT_STAGE_GRANTS_BY_ROLE.Production.site_visit).toBeUndefined();
      expect(resolveStageGrant(installation, "site_visit").canEdit).toBe(true);
      expect(resolveStageGrant(designer, "site_visit").canEdit).toBe(true);
      expect(resolveStageGrant(marketer, "site_visit").canEdit).toBe(true);
      expect(resolveStageGrant(production, "site_visit").canEdit).toBe(false);
      expect(resolveStageGrant(unknown, "site_visit").canEdit).toBe(false);
      expect(getEditableStages(installation)).toContain("site_visit");
      expect(getEditableStages(production)).not.toContain("site_visit");
    });

    it("queue context forces other stages to view-only (Gate C)", () => {
      expect(
        getStagePermissionInContext("site_visit", installation, "site_visit")
      ).toEqual({ canView: true, canEdit: true });
      expect(getStagePermissionInContext("quotation", marketer, "site_visit")).toEqual({
        canView: true,
        canEdit: false,
      });
      expect(isTimelineStageAccessible("site_visit", production, "site_visit")).toBe(false);
      expect(isTimelineStageAccessible("site_visit", installation, "quotation")).toBe(true);
    });

    it("UI freeze still blocks view-only actors even when unlocked", () => {
      expect(
        isSiteVisitUiFrozen({
          stage: "Site Visit Pending",
          stageStatus: "Normal",
          completed: false,
          adminOverrideUnlocked: true,
          canEdit: false,
        })
      ).toBe(true);
    });

    it("assigned-only isolation: staff queue filters other employees out", () => {
      const orders = [
        { stage: "Site Visit Pending", assigned_employees: ["emp-a"] },
        { stage: "Site Visit Scheduled", assigned_employees: ["emp-b"] },
      ];
      expect(filterStaffQueueOrders(orders, "emp-a", "site_visit")).toHaveLength(1);
      expect(filterStaffQueueOrders(orders, "emp-a", "site_visit")[0].assigned_employees).toEqual([
        "emp-a",
      ]);
    });

    it("stage grant wiring: Production cannot edit site_visit by default", () => {
      expect(
        resolveStagePermission("site_visit", {
          role: "staff",
          staff_role: "Production",
        }).canEdit
      ).toBe(false);
      expect(resolveStagePermission("site_visit", { role: "admin" }).canEdit).toBe(true);
    });
  });

  describe("mutations + buttons", () => {
    it("CRUD/archive/restore/autosave permission matrix", () => {
      expect(siteVisitMutationAllowed("create", "admin")).toBe(true);
      expect(siteVisitMutationAllowed("update", "marketer")).toBe(true);
      expect(siteVisitMutationAllowed("autosave", "site_visit_employee")).toBe(true);
      expect(siteVisitMutationAllowed("delete", "marketer")).toBe(false);
      expect(siteVisitMutationAllowed("archive", "admin")).toBe(true);
      expect(siteVisitMutationAllowed("restore", "admin")).toBe(true);
      expect(siteVisitMutationAllowed("delete", "designer")).toBe(false);
    });

    const buttons = [
      "schedule",
      "reschedule",
      "approve",
      "reject",
      "save",
      "draft",
      "complete",
      "delete",
      "cancel",
      "upload",
      "view_photos",
      "open_maps",
      "call_customer",
      "directions",
    ] as const;

    it("every button has permission + loading + audit metadata", () => {
      for (const button of buttons) {
        const admin = siteVisitButtonState({ button, role: "admin" });
        expect(admin).toMatchObject({
          visible: expect.any(Boolean),
          enabled: expect.any(Boolean),
          loading: false,
          requiresAudit: expect.any(Boolean),
        });
        const loading = siteVisitButtonState({ button, role: "admin", loading: true });
        expect(loading.enabled).toBe(false);
        expect(loading.loading).toBe(true);
      }
    });

    it("marketer cannot approve/reject/delete; can schedule/upload", () => {
      expect(siteVisitButtonState({ button: "approve", role: "marketer" }).visible).toBe(false);
      expect(siteVisitButtonState({ button: "delete", role: "marketer" }).visible).toBe(false);
      expect(siteVisitButtonState({ button: "schedule", role: "marketer" }).visible).toBe(true);
      expect(siteVisitButtonState({ button: "upload", role: "marketer" }).visible).toBe(true);
    });

    it("designer cannot save/upload; can view photos", () => {
      expect(siteVisitButtonState({ button: "save", role: "designer" }).visible).toBe(false);
      expect(siteVisitButtonState({ button: "upload", role: "designer" }).visible).toBe(false);
      expect(siteVisitButtonState({ button: "view_photos", role: "designer" }).visible).toBe(true);
    });

    it("customer can schedule/reschedule; cannot approve", () => {
      expect(siteVisitButtonState({ button: "schedule", role: "customer" }).visible).toBe(true);
      expect(siteVisitButtonState({ button: "reschedule", role: "customer" }).visible).toBe(true);
      expect(siteVisitButtonState({ button: "approve", role: "customer" }).visible).toBe(false);
    });
  });
});
