import { describe, expect, it } from "vitest";
import {
  EMPTY_ENQUIRY_FORM,
  buildCustomerInsertFromEnquiry,
  buildCustomerMatchOrClauses,
  canSubmitEnquiryForm,
  escapePostgrestFilterValue,
  formatEnquireId,
  formatPhoneNumber,
  mapEnquiryFormToInsert,
  nextEnquireSequence,
  requiresEnquiryEditGrant,
  stripPhoneSpaces,
  validateEmail,
  validateEnquiryForm,
  validatePhoneNumber,
  whatsappNotifyIdempotencyKey,
  type EnquiryFormData,
} from "@/features/enquiries/enquiryFormLogic";
import { renderCustomerMessage } from "@/features/notifications/customer-message/renderMessage";
import {
  buildMailtoLink,
  buildWhatsAppShareLink,
  normalizeWhatsAppShareNumber,
} from "@/features/notifications/customer-message/buildShareLinks";
import { normalizeWhatsAppPhone } from "@/features/notifications/whatsapp/phone";
import {
  getStagePermissionInContext,
  resolveStagePermission,
} from "@/features/orders/workspace/shared/permissions";
import {
  DEFAULT_STAGE_GRANTS_BY_ROLE,
  resolveStageGrant,
} from "@/features/orders/workspace/shared/stageGrants";
import type { StageActor } from "@/features/orders/workspace/shared/types";

const validForm = (overrides: Partial<EnquiryFormData> = {}): EnquiryFormData => ({
  businessName: "Gourmet Cafe",
  leadName: "Ramesh Kumar",
  phone: "+91 98765 43210",
  whatsappNumber: "+91 98765 43210",
  email: "ramesh@cafe.com",
  primaryMode: "whatsapp",
  source: "Website",
  notes: "Need fascia board",
  location: "Whitefield",
  ...overrides,
});

function makeForms(n: number): EnquiryFormData[] {
  return Array.from({ length: n }, (_, i) => ({
    businessName: `Biz ${i}`,
    leadName: `Lead ${i}`,
    phone: formatPhoneNumber(`9${String(800000000 + i).slice(0, 9)}`),
    whatsappNumber: formatPhoneNumber(`9${String(800000000 + i).slice(0, 9)}`),
    email: `lead${i}@example.com`,
    primaryMode: i % 2 === 0 ? ("whatsapp" as const) : ("email" as const),
    source: (["Website", "Meta Ads", "Referrals", "Walk-ins", "Google Enquiry (Ph Call)"] as const)[
      i % 5
    ],
    notes: `notes-${i}`,
    location: `Area ${i % 50}`,
  }));
}

describe("add enquiry", () => {
  describe("frontend", () => {
    it("formats phone input / paste cases", () => {
      expect(formatPhoneNumber("9876543210")).toBe("+91 98765 43210");
      expect(formatPhoneNumber("919876543210")).toBe("+91 98765 43210");
      expect(formatPhoneNumber("91")).toBe("91");
      expect(formatPhoneNumber("09876543210")).toBe("+91 98765 43210");
      expect(formatPhoneNumber("98765-43210-99")).toBe("+91 98765 43210");
    });

    it("validates phone and email before Create Enquiry", () => {
      expect(validatePhoneNumber("+91 98765 43210")).toBe(true);
      expect(validatePhoneNumber("9876543210")).toBe(false);
      expect(validateEmail("client@company.com")).toBe(true);
      expect(validateEmail("bad")).toBe(false);
    });

    it("blocks incomplete forms and accepts a valid form", () => {
      const errors = validateEnquiryForm({ ...EMPTY_ENQUIRY_FORM });
      expect(errors.businessName).toBeTruthy();
      expect(canSubmitEnquiryForm(EMPTY_ENQUIRY_FORM)).toBe(false);
      expect(validateEnquiryForm(validForm())).toEqual({});
      expect(canSubmitEnquiryForm(validForm())).toBe(true);
    });

    it("renders post-create enquiry_received message + share links", () => {
      const text = renderCustomerMessage("enquiry_received", {
        businessName: "Gourmet Cafe",
        clientName: "PrintOMS",
        enquiryNo: "ENQ001",
        portalUrl: "https://app.example/portal",
      });
      expect(text).toContain("*ENQ001*");
      expect(normalizeWhatsAppShareNumber("9876543210")).toBe("919876543210");
      expect(buildWhatsAppShareLink("+91 98765 43210", "Hi")).toContain("wa.me/919876543210");
      expect(buildMailtoLink("a@b.com", "Sub", "Body")).toContain("mailto:a@b.com");
    });
  });

  describe("backend", () => {
    it("maps form → insert with Pending status and stripped phones", () => {
      expect(mapEnquiryFormToInsert(validForm())).toEqual({
        lead_name: "Ramesh Kumar",
        business_name: "Gourmet Cafe",
        phone: "+919876543210",
        whatsapp: "+919876543210",
        email: "ramesh@cafe.com",
        source: "Website",
        notes: "Need fascia board",
        primary_communication_mode: "WHATSAPP",
        location: "Whitefield",
        status: "Pending",
      });
      expect(stripPhoneSpaces("+91 98765 43210")).toBe("+919876543210");
      expect(mapEnquiryFormToInsert(validForm({ primaryMode: "email" })).primary_communication_mode).toBe(
        "MAIL"
      );
    });

    it("keeps NOT NULL columns set and leaves company/enquire_id to server", () => {
      const insert = mapEnquiryFormToInsert(validForm());
      expect(insert.lead_name && insert.phone && insert.email && insert.source).toBeTruthy();
      expect(insert).not.toHaveProperty("company_id");
      expect(insert).not.toHaveProperty("enquire_id");
    });

    it("mirrors ENQ### id generation and customer auto-create payload", () => {
      expect(formatEnquireId(1)).toBe("ENQ001");
      expect(nextEnquireSequence(["ENQ001", "ENQ014"])).toBe(15);
      expect(
        buildCustomerInsertFromEnquiry(
          {
            company_id: "co-1",
            business_name: "Acme",
            lead_name: "Anita",
            phone: "1",
            whatsapp: "1",
            email: "a@b.c",
            location: "JP Nagar",
          },
          "fallback"
        )
      ).toMatchObject({
        company_id: "co-1",
        name: "Acme",
        shipping_address: "JP Nagar",
      });
      expect(whatsappNotifyIdempotencyKey("uuid-1")).toBe("enquiry_received:uuid-1");
    });
  });

  describe("security", () => {
    it("requires enquiry edit grant for logged-in create; public create skips grant", () => {
      expect(requiresEnquiryEditGrant(true)).toBe(true);
      expect(requiresEnquiryEditGrant(false)).toBe(false);
    });

    it("RBAC: admin/Marketer can create; Production/customer cannot", () => {
      const admin: StageActor = { role: "admin" };
      const marketer: StageActor = { role: "staff", staff_role: "Marketer" };
      const production: StageActor = { role: "staff", staff_role: "Production" };
      expect(resolveStagePermission("enquiry", admin).canEdit).toBe(true);
      expect(DEFAULT_STAGE_GRANTS_BY_ROLE.Marketer.enquiry?.canEdit).toBe(true);
      expect(resolveStageGrant(marketer, "enquiry").canEdit).toBe(true);
      expect(resolveStageGrant(production, "enquiry").canEdit).toBe(false);
      expect(
        getStagePermissionInContext("enquiry", marketer, "site_visit")
      ).toEqual({ canView: true, canEdit: false });
    });

    it("hardens customer match OR filters and rejects bad WhatsApp numbers", () => {
      expect(escapePostgrestFilterValue('a"b')).toBe('a\\"b');
      const clauses = buildCustomerMatchOrClauses({
        phone: '+91" ,email.eq."evil@x.com',
        email: "ok@x.com",
      });
      expect(clauses[0]).toContain('\\"');
      expect(normalizeWhatsAppPhone("+91 98765 43210")).toBe("919876543210");
      expect(normalizeWhatsAppPhone("123")).toBeNull();
      expect(
        (mapEnquiryFormToInsert(validForm()) as unknown as Record<string, unknown>).company_id
      ).toBeUndefined();
    });
  });

  describe("scalability", () => {
    it("validates/maps large create batches", () => {
      const inserts = makeForms(2000).map((f) => {
        expect(canSubmitEnquiryForm(f)).toBe(true);
        return mapEnquiryFormToInsert(f);
      });
      expect(inserts).toHaveLength(2000);
      expect(new Set(inserts.map((r) => r.email)).size).toBe(2000);
    });

    it("scales enquire_id sequence and RBAC fan-out", () => {
      const existing = Array.from({ length: 5000 }, (_, i) =>
        `ENQ${String(i + 1).padStart(3, "0")}`
      );
      expect(nextEnquireSequence(existing)).toBe(5001);

      const actors: StageActor[] = Array.from({ length: 1000 }, (_, i) => ({
        role: "staff",
        staff_role: (["Marketer", "Production", "Installation", "Designer", "Unknown"] as const)[
          i % 5
        ],
      }));
      const editable = actors.filter((a) => resolveStagePermission("enquiry", a).canEdit);
      expect(editable).toHaveLength(200);
    });
  });

  describe("performance", () => {
    it("formats/validates and maps create payloads under budget", () => {
      const startFmt = performance.now();
      for (let i = 0; i < 5000; i++) {
        validateEnquiryForm({
          ...validForm(),
          phone: formatPhoneNumber(`98765${String(i).padStart(5, "0").slice(0, 5)}`),
          email: `u${i}@x.com`,
        });
      }
      expect(performance.now() - startFmt).toBeLessThan(200);

      const forms = makeForms(3000);
      const startMap = performance.now();
      expect(forms.map(mapEnquiryFormToInsert)).toHaveLength(3000);
      expect(performance.now() - startMap).toBeLessThan(100);
    });

    it("enquire_id scan and message render stay fast", () => {
      const existing = Array.from({ length: 10000 }, (_, i) =>
        `ENQ${String(i + 1).padStart(4, "0")}`
      );
      const startId = performance.now();
      expect(nextEnquireSequence(existing)).toBe(10001);
      // Budget is generous: catches O(n²) regressions, not wall-clock noise on busy CI/dev machines.
      expect(performance.now() - startId).toBeLessThan(150);

      const startMsg = performance.now();
      for (let i = 0; i < 2000; i++) {
        renderCustomerMessage("enquiry_received", {
          businessName: `Biz ${i}`,
          clientName: "PrintOMS",
          enquiryNo: `ENQ${i}`,
        });
      }
      expect(performance.now() - startMsg).toBeLessThan(200);
    });
  });
});
