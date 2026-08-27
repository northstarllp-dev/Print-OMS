import { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/utils/supabase/admin";
import { normalizeWhatsAppPhone, isWhatsAppConfigured } from "@/features/notifications/whatsapp/phone";
import { sendWhatsAppTemplateMessage } from "@/features/notifications/whatsapp/metaClient";
import { buildNotificationContext, BuildContextInput } from "@/features/notifications/whatsapp/buildContext";
import { WhatsAppTemplateKey } from "@/features/notifications/whatsapp/templates";
import {
  isWhatsAppTestMode,
  resolveWhatsAppIdempotencyKey,
} from "@/features/notifications/whatsapp/testMode";

export type DispatchInput = BuildContextInput & {
  idempotencyKey: string;
};

export type DispatchResult = {
  sent: boolean;
  skipped?: boolean;
  reason?: string;
  outboxId?: string;
  messageId?: string;
  error?: string;
};

function getDbClient(fallback: SupabaseClient): SupabaseClient {
  return createAdminClient() || fallback;
}

async function logOutboxAttempt(
  db: SupabaseClient,
  partial: {
    template_key: string;
    recipient_phone?: string;
    enquiry_id?: string | null;
    order_id?: string | null;
    status: "skipped" | "failed" | "pending";
    error_message?: string;
    idempotency_key: string;
  }
) {
  try {
    await db.from("notification_outbox").insert({
      company_id: null,
      template_key: partial.template_key,
      recipient_phone: partial.recipient_phone || "unknown",
      enquiry_id: partial.enquiry_id ?? null,
      order_id: partial.order_id ?? null,
      body_parameters: [],
      status: partial.status,
      error_message: partial.error_message ?? null,
      idempotency_key: partial.idempotency_key,
    });
  } catch {
    // ignore logging failures
  }
}

/**
 * Meta Cloud API sends are disabled for now customer updates go out through
 * the admin CustomerMessageModal popup (copy / wa.me / mailto) instead.
 * Remove this early return to re-enable automated Meta template dispatch.
 */
const META_WHATSAPP_DISPATCH_DISABLED = true;

export async function dispatchWhatsAppNotification(
  supabase: SupabaseClient,
  input: DispatchInput
): Promise<DispatchResult> {
  if (META_WHATSAPP_DISPATCH_DISABLED) {
    return {
      sent: false,
      skipped: true,
      reason: "Meta WhatsApp disabled; use admin message popup",
    };
  }
  const testMode = isWhatsAppTestMode();
  const idempotencyKey = resolveWhatsAppIdempotencyKey(input.idempotencyKey);
  const db = getDbClient(supabase);
  const outboxTemplateKey = testMode
    ? `${input.templateKey}:hello_world_test`
    : input.templateKey;

  if (!isWhatsAppConfigured()) {
    await logOutboxAttempt(db, {
      template_key: outboxTemplateKey,
      enquiry_id: input.enquiryId ?? null,
      order_id: input.orderFriendlyId ?? null,
      status: "skipped",
      error_message: "WhatsApp not configured",
      idempotency_key: idempotencyKey,
    });
    return { sent: false, skipped: true, reason: "WhatsApp not configured" };
  }

  if (process.env.WHATSAPP_ENABLED === "false") {
    return { sent: false, skipped: true, reason: "WhatsApp disabled" };
  }

  if (!testMode) {
    const { data: existing } = await db
      .from("notification_outbox")
      .select("id, status, meta_message_id")
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();

    if (existing?.status === "sent") {
      return {
        sent: true,
        skipped: true,
        reason: "Already sent",
        outboxId: existing.id,
        messageId: existing.meta_message_id || undefined,
      };
    }
  }

  // Use admin client for context (portal token insert, company lookups).
  const ctx = await buildNotificationContext(db, input).catch((err: unknown) => {
    console.error("[WhatsApp] buildContext failed:", err);
    return null;
  });
  if (!ctx) {
    await logOutboxAttempt(db, {
      template_key: outboxTemplateKey,
      enquiry_id: input.enquiryId ?? null,
      status: "skipped",
      error_message: "No WhatsApp number or customer context",
      idempotency_key: idempotencyKey,
    });
    return { sent: false, skipped: true, reason: "No WhatsApp number or customer context" };
  }

  // In test mode, only message a number on Meta's allowed list (API Setup → To).
  if (testMode && !process.env.WHATSAPP_TEST_PHONE?.trim()) {
    await logOutboxAttempt(db, {
      template_key: outboxTemplateKey,
      enquiry_id: input.enquiryId ?? null,
      status: "skipped",
      error_message: "WHATSAPP_TEST_PHONE not set",
      idempotency_key: idempotencyKey,
    });
    return {
      sent: false,
      skipped: true,
      reason:
        "WHATSAPP_TEST_MODE is on but WHATSAPP_TEST_PHONE is empty. Add your WhatsApp number in Meta Developer Console → WhatsApp → API Setup → To, set WHATSAPP_TEST_PHONE to that number (e.g. 9198XXXXXXXX), restart the dev server.",
    };
  }

  const recipientRaw = testMode
    ? process.env.WHATSAPP_TEST_PHONE!
    : ctx.recipientPhone;

  const phone = normalizeWhatsAppPhone(recipientRaw);
  if (!phone) {
    await logOutboxAttempt(db, {
      template_key: outboxTemplateKey,
      recipient_phone: recipientRaw,
      enquiry_id: input.enquiryId ?? null,
      status: "skipped",
      error_message: `Invalid phone: ${recipientRaw}`,
      idempotency_key: idempotencyKey,
    });
    return { sent: false, skipped: true, reason: "Invalid phone number" };
  }

  const { data: row, error: insertError } = await db
    .from("notification_outbox")
    .insert({
      company_id: ctx.companyId || null,
      template_key: outboxTemplateKey,
      recipient_phone: phone,
      order_id: ctx.orderId || null,
      enquiry_id: ctx.enquiryId || null,
      body_parameters: testMode
        ? ["hello_world", input.templateKey]
        : ctx.bodyParameters,
      status: "pending",
      idempotency_key: idempotencyKey,
    })
    .select("id")
    .single();

  if (insertError) {
    console.error("[WhatsApp] outbox insert failed:", insertError.message);
    return { sent: false, error: insertError.message };
  }

  const outboxId = row.id;

  const sendResult = await sendWhatsAppTemplateMessage(
    testMode
      ? { to: phone, useHelloWorld: true }
      : {
          to: phone,
          templateKey: input.templateKey,
          bodyParameters: ctx.bodyParameters,
          buttonUrlParameter: ctx.portalToken,
        }
  );

  const status = sendResult.success ? "sent" : "failed";
  await db
    .from("notification_outbox")
    .update({
      status,
      meta_message_id: sendResult.messageId || null,
      error_message: sendResult.error || null,
      attempts: 1,
      sent_at: sendResult.success ? new Date().toISOString() : null,
    })
    .eq("id", outboxId);

  if (!sendResult.success) {
    console.error(
      `[WhatsApp] ${testMode ? "hello_world" : input.templateKey} failed for ${phone}:`,
      sendResult.error
    );
    return {
      sent: false,
      outboxId,
      error: sendResult.error,
    };
  }

  if (testMode) {
    console.log(
      `[WhatsApp TEST] hello_world sent for stage "${input.templateKey}" → ${phone}`
    );
  }

  return {
    sent: true,
    outboxId,
    messageId: sendResult.messageId,
  };
}

const PIPELINE_STAGE_TEMPLATES: Partial<Record<string, WhatsAppTemplateKey>> = {
  "Design In Progress": "design_resources_required",
  Production: "production_started",
  "Ready For Installation": "ready_for_installation",
  Completed: "installation_completed",
};

/** Send WhatsApp when order pipeline stage changes (admin approve / manual stage update). */
export async function dispatchWhatsAppForPipelineStage(
  supabase: SupabaseClient,
  orderUuid: string,
  stage: string
): Promise<void> {
  const templateKey = PIPELINE_STAGE_TEMPLATES[stage];
  if (!templateKey) return;

  await dispatchWhatsAppNotification(supabase, {
    templateKey,
    orderUuid,
    idempotencyKey: `pipeline:${stage}:${orderUuid}`,
  });
}

import { dispatchStageNotification } from "../lib/dispatchNotification";
import { OrderStage } from "@/features/orders/workspace/shared/types";

/** Notify on order stage transitions (centralized). */
export async function notifyOrderStageChange(
  supabase: SupabaseClient,
  orderUuid: string,
  newStage: string,
  oldStage?: string
): Promise<void> {
  if (newStage === oldStage) return;
  await dispatchWhatsAppForPipelineStage(supabase, orderUuid, newStage);

  // Send internal Push / In-App Notification based on RBAC
  const { data: order } = await supabase
    .from("orders")
    .select("company_id, order_id")
    .eq("id", orderUuid)
    .single();

  if (order) {
    await dispatchStageNotification(
      newStage as OrderStage,
      order.company_id,
      {
        title: `Order ${order.order_id} moved to ${newStage}`,
        message: `The order has advanced to the ${newStage} stage.`,
        type: "info",
        link: `/staff/orders/${orderUuid}`,
      }
    );
  }
}
