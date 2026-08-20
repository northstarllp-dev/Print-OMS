import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";
import path from "node:path";

dotenv.config({ path: path.resolve(__dirname, ".env.test") });

// Origin only — do NOT put /printoms here. Paths starting with "/" are
// origin-absolute and would drop a path segment from baseURL.
const baseURL = process.env.PLAYWRIGHT_ORIGIN || "http://localhost:3001";

// Specs that mutate the shared app_settings row for the printoms test
// company. setWorkflowAutoApprovalStage does a read-modify-write on one row,
// so two of these running concurrently stomp each other's toggles — keep them
// serial (workers: 1). rbac flips the site_visit auto-approval toggle too.
const SETTINGS_SPEC_PATTERNS = [
  "**/auto-approval.spec.ts",
  "**/approval-flow.spec.ts",
  "**/site-visit/settings-portal.spec.ts",
  "**/site-visit/rbac.spec.ts",
];

export default defineConfig({
  testDir: "./e2e",
  // Keep intra-file serial; the settings specs rely on a fixed sequence and
  // share state. Cross-file parallelism is enabled per-project below.
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // Global cap: the isolated project can use up to this many workers; the
  // settings project is pinned to 1 via its own `workers`.
  workers: 3,
  timeout: 120_000,
  expect: { timeout: 20_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    video: "retain-on-failure",
    screenshot: "only-on-failure",
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  projects: [
    {
      name: "setup",
      testMatch: /e2e\/setup\/.*\.ts/,
    },
    {
      // Mutates shared company settings — must run one at a time.
      name: "settings",
      dependencies: ["setup"],
      testMatch: SETTINGS_SPEC_PATTERNS,
      workers: 1,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      // Order-isolated specs (unique customer per test) — safe to parallelize.
      name: "isolated",
      dependencies: ["setup"],
      testIgnore: [...SETTINGS_SPEC_PATTERNS, /e2e\/setup\/.*/],
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "node scripts/dev-e2e.mjs",
    url: "http://localhost:3001/printoms/admin/login",
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
