/**
 * CLI: send Meta hello_world to verify WHATSAPP_* env vars.
 * Usage: node scripts/test-whatsapp-hello.mjs [phone]
 * Loads .env and .env.local from project root (simple KEY=VALUE parser).
 */
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnvFile(resolve(root, ".env"));
loadEnvFile(resolve(root, ".env.local"));

const token = process.env.WHATSAPP_ACCESS_TOKEN;
const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
const version = process.env.WHATSAPP_GRAPH_API_VERSION || "v21.0";
const rawPhone = process.argv[2] || process.env.WHATSAPP_TEST_PHONE || "15556275106";

function normalizePhone(raw) {
  let digits = raw.replace(/\D/g, "");
  if (digits.length === 10 && digits.startsWith("555")) digits = `1${digits}`;
  if (digits.length === 10 && /^[6-9]/.test(digits)) digits = `91${digits}`;
  return digits;
}

const to = normalizePhone(rawPhone);

if (!token || !phoneNumberId) {
  console.error("Missing WHATSAPP_ACCESS_TOKEN or WHATSAPP_PHONE_NUMBER_ID in .env");
  process.exit(1);
}

const url = `https://graph.facebook.com/${version}/${phoneNumberId}/messages`;
const body = {
  messaging_product: "whatsapp",
  to,
  type: "template",
  template: { name: "hello_world", language: { code: "en_US" } },
};

console.log(`Sending hello_world to ${to} via Phone Number ID ${phoneNumberId}...`);

const res = await fetch(url, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify(body),
});

const data = await res.json();
if (!res.ok) {
  console.error("FAILED:", data?.error?.message || JSON.stringify(data));
  process.exit(1);
}

console.log("OK — message id:", data.messages?.[0]?.id);
console.log("Check WhatsApp on the test recipient phone.");
