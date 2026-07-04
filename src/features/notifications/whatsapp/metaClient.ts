import { HELLO_WORLD_TEMPLATE, WHATSAPP_TEMPLATES, WhatsAppTemplateKey } from "./templates";

const GRAPH_API_VERSION = process.env.WHATSAPP_GRAPH_API_VERSION || "v21.0";

export type SendTemplateInput = {
  to: string;
  templateKey?: WhatsAppTemplateKey;
  /** Use Meta's default hello_world for connectivity tests. */
  useHelloWorld?: boolean;
  bodyParameters?: string[];
  /** Portal token passed as dynamic URL suffix for the Click Here button. */
  buttonUrlParameter?: string;
};

export type SendTemplateResult = {
  success: boolean;
  messageId?: string;
  error?: string;
  raw?: unknown;
};

function getConfig() {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneNumberId) {
    throw new Error("WhatsApp is not configured (WHATSAPP_ACCESS_TOKEN / WHATSAPP_PHONE_NUMBER_ID).");
  }
  return { token, phoneNumberId };
}

export async function sendWhatsAppTemplateMessage(
  input: SendTemplateInput
): Promise<SendTemplateResult> {
  const { token, phoneNumberId } = getConfig();

  const def = input.useHelloWorld
    ? HELLO_WORLD_TEMPLATE
    : input.templateKey
      ? WHATSAPP_TEMPLATES[input.templateKey]
      : null;

  if (!def) {
    return { success: false, error: "Template not specified." };
  }

  const components: Record<string, unknown>[] = [];

  if (def.bodyParamCount > 0 && input.bodyParameters) {
    components.push({
      type: "body",
      parameters: input.bodyParameters.slice(0, def.bodyParamCount).map((text) => ({
        type: "text",
        text: text.slice(0, 1024),
      })),
    });
  }

  if (def.hasUrlButton && input.buttonUrlParameter) {
    components.push({
      type: "button",
      sub_type: "url",
      index: "0",
      parameters: [{ type: "text", text: input.buttonUrlParameter }],
    });
  }

  const payload = {
    messaging_product: "whatsapp",
    to: input.to,
    type: "template",
    template: {
      name: def.metaName,
      language: { code: def.language },
      ...(components.length > 0 ? { components } : {}),
    },
  };

  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const errMsg =
        (data as { error?: { message?: string } })?.error?.message ||
        `Meta API error ${res.status}`;
      return { success: false, error: errMsg, raw: data };
    }

    const messageId = (data as { messages?: { id?: string }[] })?.messages?.[0]?.id;
    return { success: true, messageId, raw: data };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown WhatsApp send error";
    return { success: false, error: message };
  }
}
