"use server";

import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText, Output } from "ai";
import { z } from "zod";
import { REPORT_IDS, REPORT_REGISTRY } from "../lib/reportRegistry";
import type { ReportType } from "../components/ReportCard";

const reportIdSchema = z.union([
  z.enum(REPORT_IDS as [ReportType, ...ReportType[]]),
  z.literal("NONE"),
]);

const responseSchema = z.object({
  reportId: reportIdSchema.describe("Best matching report ID, or NONE if none fit"),
  message: z
    .string()
    .describe("Short friendly reply (1–2 sentences) explaining the choice or asking to clarify"),
});

export type ResolveReportResult =
  | {
      ok: true;
      reportId: ReportType | null;
      message: string;
      title?: string;
      desc?: string;
      dataKey?: string;
    }
  | { ok: false; error: string };

function getGeminiApiKey(): string | undefined {
  return (
    process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY
  );
}

export async function resolveReportRequest(query: string): Promise<ResolveReportResult> {
  const trimmed = query.trim();
  if (!trimmed) {
    return { ok: false, error: "Please enter a report request." };
  }

  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    return {
      ok: false,
      error:
        "Gemini is not configured. Add GOOGLE_GENERATIVE_AI_API_KEY to .env (get a key at https://aistudio.google.com/apikey).",
    };
  }

  const google = createGoogleGenerativeAI({ apiKey });
  const catalog = Object.values(REPORT_REGISTRY)
    .map((r) => `- ${r.id}: ${r.title} — ${r.desc}`)
    .join("\n");

  try {
    const { output } = await generateText({
      model: google("gemini-2.5-flash"),
      output: Output.object({ schema: responseSchema }),
      system: `You are the PrintOMS AI Report Builder. Map the user's natural-language request to exactly one report from the catalog.
If nothing fits well, set reportId to NONE and suggest 2–3 valid report topics in message.
Keep message concise and professional. Do not invent report IDs.`,
      prompt: `Available reports:\n${catalog}\n\nUser request:\n${trimmed}`,
    });

    if (!output) {
      return { ok: false, error: "The model returned an empty response. Please try again." };
    }

    if (output.reportId === "NONE") {
      return { ok: true, reportId: null, message: output.message };
    }

    const entry = REPORT_REGISTRY[output.reportId];
    if (!entry) {
      return { ok: true, reportId: null, message: output.message || "I couldn't match that to a report." };
    }

    return {
      ok: true,
      reportId: entry.id,
      message: output.message,
      title: entry.title,
      desc: entry.desc,
      dataKey: entry.dataKey,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/api key|unauthorized|401|403|credential|authentication|not configured|API_KEY_INVALID/i.test(msg)) {
      return {
        ok: false,
        error:
          "Invalid or missing Gemini API key. Create one at https://aistudio.google.com/apikey and set GOOGLE_GENERATIVE_AI_API_KEY in .env.",
      };
    }
    return { ok: false, error: msg || "Failed to resolve report request." };
  }
}
