import { describe, expect, it } from "vitest";
import { mergeConfig } from "@/config/mergeConfig";
import { printsquirelConfig } from "@/config/clients/printsquirel";
import { resolveStageGrant } from "@/features/orders/workspace/shared/stageGrants";
import type { StageActor } from "@/features/orders/workspace/shared/types";

const PRINTSQUIREL_COMPANY = "55555555-5555-5555-5555-555555555555";

describe("Print Squirel stage grants", () => {
  const config = mergeConfig(printsquirelConfig);

  it("defines Prod Designer as a distinct role", () => {
    expect(config.stageGrantsByRole?.["Prod Designer"]).toBeDefined();
    expect(Object.keys(config.stageGrantsByRole || {})).toContain("Prod Designer");
  });

  it("Prod Designer: site visit view, design + production edit", () => {
    const actor: StageActor = {
      role: "staff",
      staff_role: "Prod Designer",
      company_id: PRINTSQUIREL_COMPANY,
    };

    expect(resolveStageGrant(actor, "site_visit")).toEqual({
      canView: true,
      canEdit: false,
    });
    expect(resolveStageGrant(actor, "design")).toEqual({
      canView: true,
      canEdit: true,
    });
    expect(resolveStageGrant(actor, "production")).toEqual({
      canView: true,
      canEdit: true,
    });
    expect(resolveStageGrant(actor, "quotation")).toEqual({
      canView: false,
      canEdit: false,
    });
    expect(resolveStageGrant(actor, "invoice")).toEqual({
      canView: false,
      canEdit: false,
    });
  });

  it("Designer keeps quotation + invoice edit (unchanged for other designers)", () => {
    const actor: StageActor = {
      role: "staff",
      staff_role: "Designer",
      company_id: PRINTSQUIREL_COMPANY,
    };

    expect(resolveStageGrant(actor, "site_visit")).toEqual({
      canView: true,
      canEdit: false,
    });
    expect(resolveStageGrant(actor, "design")).toEqual({
      canView: true,
      canEdit: true,
    });
    expect(resolveStageGrant(actor, "quotation")).toEqual({
      canView: true,
      canEdit: true,
    });
    expect(resolveStageGrant(actor, "invoice")).toEqual({
      canView: true,
      canEdit: true,
    });
    expect(resolveStageGrant(actor, "production")).toEqual({
      canView: false,
      canEdit: false,
    });
  });
});
