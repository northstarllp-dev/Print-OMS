#!/usr/bin/env node
/**
 * Upload downloaded remote storage files into local Supabase Storage,
 * preserving object keys (forward-slash paths).
 *
 * Expects files under:
 *   supabase/remote-dump/storage/<bucket>/<bucket>/<object-key...>
 * (as produced by `supabase storage cp --linked`)
 *
 * Usage: node scripts/sync-storage-to-local.mjs
 */
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const storageRoot = resolve(root, "supabase/remote-dump/storage");
const localUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";

// Prefer service role from env; fall back to reading .env.test without printing secrets
function loadServiceKey() {
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return process.env.SUPABASE_SERVICE_ROLE_KEY;
  }
  const envPath = resolve(root, ".env.test");
  if (!existsSync(envPath)) {
    throw new Error("Set SUPABASE_SERVICE_ROLE_KEY or create .env.test via npm run env:test");
  }
  const text = readFileSync(envPath, "utf8");
  const line = text.split(/\r?\n/).find((l) => l.startsWith("SUPABASE_SERVICE_ROLE_KEY="));
  if (!line) throw new Error("SUPABASE_SERVICE_ROLE_KEY missing in .env.test");
  return line.slice("SUPABASE_SERVICE_ROLE_KEY=".length).trim();
}

const serviceKey = loadServiceKey();

const BUCKETS = [
  "product-images",
  "installation-photos",
  "site-visit-photos",
  "service-ticket-photos",
  "service-ticket-resolution-photos",
];

function walkFiles(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walkFiles(p, out);
    else out.push(p);
  }
  return out;
}

async function upload(bucket, objectKey, filePath) {
  const url = `${localUrl}/storage/v1/object/${bucket}/${objectKey}`;
  const body = readFileSync(filePath);
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      apikey: serviceKey,
      "x-upsert": "true",
      "Content-Type": "application/octet-stream",
    },
    body,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status} ${bucket}/${objectKey}: ${text}`);
  }
}

let ok = 0;
let fail = 0;

for (const bucket of BUCKETS) {
  // CLI nests as storage/<bucket>/<bucket>/...
  const nested = join(storageRoot, bucket, bucket);
  const base = existsSync(nested) ? nested : join(storageRoot, bucket);
  const files = walkFiles(base);
  console.log(`${bucket}: ${files.length} files from ${base}`);

  for (const file of files) {
    const rel = relative(base, file).split(sep).join("/");
    if (!rel || rel.endsWith(".emptyFolderPlaceholder")) continue;
    try {
      await upload(bucket, rel, file);
      ok++;
      process.stdout.write(".");
    } catch (err) {
      fail++;
      console.error(`\nFAIL ${bucket}/${rel}: ${err.message}`);
    }
  }
  console.log("");
}

console.log(`\nUploaded ${ok} files, ${fail} failures.`);
