import { describe, it, expect } from "vitest";
import {
  getNavItemsForActor,
  getStaffHomePath,
  getStaffOrderBackHref,
  getMyOrdersStages,
  MY_ORDERS_NAV,
} from "@/features/orders/workspace/shared/stageGrants";
import {
  buildMyOrdersTabList,
  countMyOrdersTabs,
  defaultMyOrdersTab,
  filterMyOrdersAssigned,
  myOrdersHasIncomingTab,
  myOrdersHasPipelineGaps,
  partitionMyOrdersByTab,
  PIPELINE_QUEUE_STAGES,
} from "@/features/orders/workspace/shared/staffQueueStages";
import type { StageActor } from "@/features/orders/workspace/shared/types";

describe("My Orders nav collapse", () => {
  it("Marketer gets a single My Orders item instead of Site Visit / Quotations", () => {
    const actor: StageActor = { role: "staff", staff_role: "Marketer" };
    const hrefs = getNavItemsForActor(actor).map((i) => i.href);
    expect(hrefs).toContain(MY_ORDERS_NAV.href);
    expect(hrefs).not.toContain("/staff/site-visit");
    expect(hrefs.filter((h) => h === MY_ORDERS_NAV.href)).toHaveLength(1);
    expect(hrefs).toContain("/staff/enquiries");
    expect(hrefs).toContain("/staff/invoices");
  });

  it("Production gets My Orders (not a bare /staff/production queue link)", () => {
    const actor: StageActor = { role: "staff", staff_role: "Production" };
    const hrefs = getNavItemsForActor(actor).map((i) => i.href);
    expect(hrefs).toContain(MY_ORDERS_NAV.href);
    expect(hrefs).not.toContain("/staff/production");
    expect(getMyOrdersStages(actor)).toEqual(["production"]);
  });

  it("staff home path prefers My Orders when available", () => {
    const actor: StageActor = { role: "staff", staff_role: "Marketer" };
    expect(getStaffHomePath(actor)).toBe("/staff/my-orders");
  });

  it("back href without entryStage goes to My Orders", () => {
    expect(getStaffOrderBackHref(null)).toBe("/staff/my-orders");
    expect(getStaffOrderBackHref(undefined)).toBe("/staff/my-orders");
    expect(getStaffOrderBackHref("site_visit")).toBe(
      "/staff/my-orders?stage=site_visit"
    );
  });
});

describe("My Orders stage partition + Incoming/Completed", () => {
  const userId = "emp-1";
  const orders = [
    {
      id: "1",
      stage: "Site Visit Pending",
      assigned_employees: [userId],
    },
    {
      id: "2",
      stage: "Quotation Sent",
      assigned_employees: [userId],
    },
    {
      id: "3",
      stage: "Design In Progress",
      assigned_employees: [userId],
    },
    {
      id: "4",
      stage: "Quotation Approved",
      assigned_employees: ["other"],
    },
    {
      id: "5",
      stage: "Completed",
      assigned_employees: [userId],
    },
    {
      id: "6",
      stage: "Site Visit Scheduled",
      assigned_employees: [userId],
    },
  ];

  it("hides Incoming when earliest is site_visit with contiguous grants; shows for gaps or later starts", () => {
    expect(myOrdersHasIncomingTab(["site_visit", "quotation"])).toBe(false);
    expect(myOrdersHasPipelineGaps(["site_visit", "quotation"])).toBe(false);
    expect(myOrdersHasIncomingTab(["quotation", "design"])).toBe(true);
    expect(myOrdersHasIncomingTab(["production"])).toBe(true);
    expect(myOrdersHasPipelineGaps(["site_visit", "production", "installation"])).toBe(true);
    expect(myOrdersHasIncomingTab(["site_visit", "production", "installation"])).toBe(true);
    expect(buildMyOrdersTabList(["site_visit", "production", "installation"])).toEqual([
      "site_visit",
      "incoming",
      "production",
      "installation",
      "completed",
    ]);
    expect(buildMyOrdersTabList(["production", "installation"])).toEqual([
      "incoming",
      "production",
      "installation",
      "completed",
    ]);
  });

  it("gap between site_visit and production treats quotation/design as Incoming", () => {
    const allowed = ["site_visit", "production", "installation"] as const;
    const filtered = filterMyOrdersAssigned(orders, userId, [...allowed]);
    expect(partitionMyOrdersByTab(filtered, "incoming", allowed).map((o) => o.id).sort()).toEqual([
      "2",
      "3",
    ]);
    expect(partitionMyOrdersByTab(filtered, "site_visit", allowed).map((o) => o.id).sort()).toEqual([
      "1",
      "6",
    ]);
    expect(partitionMyOrdersByTab(filtered, "completed", allowed).map((o) => o.id)).toEqual([
      "5",
    ]);
  });

  it("filterMyOrdersAssigned includes current bands + completed (+ incoming when applicable)", () => {
    const filtered = filterMyOrdersAssigned(orders, userId, [
      "site_visit",
      "quotation",
      "design",
    ]);
    // current: 1,2,3,6 + completed past design: 5
    expect(filtered.map((o) => o.id).sort()).toEqual(["1", "2", "3", "5", "6"]);
  });

  it("quotation-only role treats site-visit stages as Incoming", () => {
    const filtered = filterMyOrdersAssigned(orders, userId, ["quotation"]);
    expect(partitionMyOrdersByTab(filtered, "incoming", ["quotation"]).map((o) => o.id).sort()).toEqual([
      "1",
      "6",
    ]);
    expect(partitionMyOrdersByTab(filtered, "quotation", ["quotation"]).map((o) => o.id)).toEqual([
      "2",
    ]);
    expect(partitionMyOrdersByTab(filtered, "completed", ["quotation"]).map((o) => o.id).sort()).toEqual([
      "3",
      "5",
    ]);
  });

  it("partition current bands stay exclusive of Incoming/Completed", () => {
    const allowed = ["site_visit", "quotation", "design"] as const;
    const filtered = filterMyOrdersAssigned(orders, userId, [...allowed]);
    expect(partitionMyOrdersByTab(filtered, "quotation", allowed).map((o) => o.id)).toEqual([
      "2",
    ]);
    expect(partitionMyOrdersByTab(filtered, "site_visit", allowed).map((o) => o.id).sort()).toEqual([
      "1",
      "6",
    ]);
    expect(partitionMyOrdersByTab(filtered, "incoming", allowed)).toEqual([]);
    expect(partitionMyOrdersByTab(filtered, "completed", allowed).map((o) => o.id)).toEqual([
      "5",
    ]);
  });

  it("countMyOrdersTabs and defaultMyOrdersTab prefer first non-empty current band", () => {
    const assigned = filterMyOrdersAssigned(orders, userId, [...PIPELINE_QUEUE_STAGES]);
    const counts = countMyOrdersTabs(assigned, ["design", "site_visit", "quotation"]);
    expect(counts.site_visit).toBe(2);
    expect(counts.quotation).toBe(1);
    expect(counts.design).toBe(1);
    expect(counts.completed).toBe(1);
    expect(counts.incoming).toBe(0);
    expect(defaultMyOrdersTab(["design", "site_visit"], counts)).toBe("site_visit");
    expect(defaultMyOrdersTab(["production", "installation"], counts)).toBe(
      "completed"
    );
  });
});
