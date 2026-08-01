"use server";

import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText, Output } from "ai";
import { z } from "zod";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getCurrentUser } from "@/features/auth/actions/authActions";

const extractedSchema = z.object({
  vendorName: z.string().nullable().describe("Vendor / supplier name if present"),
  poNumber: z.string().nullable().describe("Vendor PO / invoice / challan number if present"),
  notes: z.string().nullable().describe("Any header notes worth keeping"),
  lines: z
    .array(
      z.object({
        description: z.string().describe("Line item description / product name"),
        sku: z.string().nullable().describe("SKU / item code / HSN if shown as code"),
        quantity: z.number().describe("Ordered quantity"),
        unitCost: z.number().nullable().describe("Unit price excluding tax if available"),
        taxRate: z.number().nullable().describe("GST / tax percent if available"),
      })
    )
    .min(1),
});

export type ParsedPoLine = {
  key: string;
  description: string;
  sku: string | null;
  quantity: number;
  unitCost: number;
  taxRate: number;
  matchedProductId: string | null;
  matchedProductCode: string | null;
  matchedProductName: string | null;
  matchConfidence: number;
  matchLabel: "exact" | "likely" | "weak" | "unmatched";
};

export type ParseVendorPoPdfResult = {
  vendorName: string | null;
  suggestedVendorId: string | null;
  poNumber: string | null;
  notes: string | null;
  lines: ParsedPoLine[];
};

function getGeminiApiKey(): string | undefined {
  return (
    process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY
  );
}

function normalize(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function tokenSet(s: string) {
  return new Set(normalize(s).split(" ").filter((t) => t.length > 1));
}

function jaccard(a: Set<string>, b: Set<string>) {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter += 1;
  return inter / (a.size + b.size - inter);
}

function scoreProduct(
  line: { description: string; sku: string | null },
  product: {
    id: string;
    product_id: string;
    name: string;
    barcode: string | null;
  }
): number {
  const sku = (line.sku || "").trim();
  if (sku) {
    if (sku.toLowerCase() === product.product_id.toLowerCase()) return 1;
    if (product.barcode && sku.toLowerCase() === product.barcode.toLowerCase()) return 1;
  }

  const desc = normalize(line.description);
  const name = normalize(product.name);
  const code = normalize(product.product_id);

  if (!desc) return 0;
  if (desc === name || desc === code) return 0.98;
  if (name.includes(desc) || desc.includes(name)) return 0.88;

  const overlap = jaccard(tokenSet(line.description), tokenSet(product.name));
  if (sku && normalize(product.name).includes(normalize(sku))) return Math.max(overlap, 0.7);
  return overlap;
}

function matchLabel(score: number): ParsedPoLine["matchLabel"] {
  if (score >= 0.95) return "exact";
  if (score >= 0.75) return "likely";
  if (score >= 0.45) return "weak";
  return "unmatched";
}

async function getSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {}
        },
      },
    }
  );
}

export async function parseVendorPoPdfAction(formData: FormData): Promise<ParseVendorPoPdfResult> {
  const profile = await getCurrentUser();
  if (!profile) throw new Error("Unauthorized");
  if (!profile.company_id) throw new Error("Company context missing");

  const file = formData.get("file");
  if (!(file instanceof File)) throw new Error("Upload a PDF file");
  if (file.type && file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    throw new Error("Only PDF files are supported");
  }
  if (file.size > 8 * 1024 * 1024) throw new Error("PDF must be under 8 MB");

  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error(
      "Gemini is not configured. Add GOOGLE_GENERATIVE_AI_API_KEY to .env."
    );
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const google = createGoogleGenerativeAI({ apiKey });

  let extracted: z.infer<typeof extractedSchema>;
  try {
    const { output } = await generateText({
      model: google("gemini-2.5-flash"),
      output: Output.object({ schema: extractedSchema }),
      messages: [
        {
          role: "user",
          content: [
            {
              type: "file",
              data: bytes,
              mediaType: "application/pdf",
            },
            {
              type: "text",
              text: `Extract purchase order / vendor invoice line items from this PDF for a signage / print company.
Return only product lines with quantity and unit cost when available.
Ignore totals-only rows, shipping-only rows, and payment instructions.
If unit cost is missing, set unitCost to null.
If tax percent is shown, set taxRate; otherwise null.`,
            },
          ],
        },
      ],
    });

    if (!output?.lines?.length) {
      throw new Error("No product lines found in the PDF");
    }
    extracted = output;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/api key|unauthorized|401|403|credential|API_KEY_INVALID/i.test(msg)) {
      throw new Error("Invalid or missing Gemini API key.");
    }
    throw new Error(msg || "Failed to parse PDF");
  }

  const supabase = await getSupabase();
  const [productsRes, vendorsRes] = await Promise.all([
    supabase
      .from("products")
      .select("id, product_id, name, barcode, purchase_price, gst_rate")
      .eq("company_id", profile.company_id)
      .eq("is_active", true),
    supabase
      .from("vendors")
      .select("id, name")
      .eq("company_id", profile.company_id)
      .eq("is_active", true),
  ]);
  if (productsRes.error) throw new Error(productsRes.error.message);
  if (vendorsRes.error) throw new Error(vendorsRes.error.message);

  const products = productsRes.data ?? [];
  const vendors = vendorsRes.data ?? [];

  let suggestedVendorId: string | null = null;
  if (extracted.vendorName) {
    const vn = normalize(extracted.vendorName);
    const hit = vendors.find((v) => {
      const name = normalize(v.name);
      return name === vn || name.includes(vn) || vn.includes(name);
    });
    suggestedVendorId = hit?.id ?? null;
  }

  const lines: ParsedPoLine[] = extracted.lines.map((line, index) => {
    let best: (typeof products)[number] | null = null;
    let bestScore = 0;
    for (const p of products) {
      const score = scoreProduct(line, p);
      if (score > bestScore) {
        bestScore = score;
        best = p;
      }
    }

    const label = matchLabel(bestScore);
    const matched = label === "unmatched" ? null : best;
    const unitCost =
      line.unitCost != null && Number.isFinite(line.unitCost)
        ? Number(line.unitCost)
        : matched?.purchase_price != null
          ? Number(matched.purchase_price)
          : 0;
    const taxRate =
      line.taxRate != null && Number.isFinite(line.taxRate)
        ? Number(line.taxRate)
        : matched?.gst_rate != null
          ? Number(matched.gst_rate)
          : 0;

    return {
      key: `pdf-${index}`,
      description: line.description,
      sku: line.sku,
      quantity: Number(line.quantity) || 0,
      unitCost,
      taxRate,
      matchedProductId: matched?.id ?? null,
      matchedProductCode: matched?.product_id ?? null,
      matchedProductName: matched?.name ?? null,
      matchConfidence: Math.round(bestScore * 100) / 100,
      matchLabel: label,
    };
  });

  return {
    vendorName: extracted.vendorName,
    suggestedVendorId,
    poNumber: extracted.poNumber,
    notes: extracted.notes,
    lines,
  };
}
