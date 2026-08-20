#!/usr/bin/env node
/**
 * Start Next.js for E2E using .env.test (no secrets on CLI).
 * Usage: node scripts/dev-e2e.mjs
 */
import { spawn } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const envPath = resolve(root, ".env.test");
const env = { ...process.env };

if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#") || !t.includes("=")) continue;
    const i = t.indexOf("=");
    env[t.slice(0, i)] = t.slice(i + 1);
  }
}

env.CLIENT_SLUG = "printoms";
env.NEXT_PUBLIC_CLIENT_SLUG = "printoms";
env.WHATSAPP_ACCESS_TOKEN = "";
env.WHATSAPP_PHONE_NUMBER_ID = "";
delete env.WHATSAPP_ENABLED;

const child = spawn(
  process.execPath,
  [resolve(root, "scripts/dev_client.js"), "printoms"],
  { stdio: "inherit", env, cwd: root }
);
child.on("exit", (code) => process.exit(code ?? 0));
