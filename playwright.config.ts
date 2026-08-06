import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";
import path from "node:path";

dotenv.config({ path: path.resolve(__dirname, ".env.test") });

// Origin only — do NOT put /printoms here. Paths starting with "/" are
// origin-absolute and would drop a path segment from baseURL.
const baseURL = process.env.PLAYWRIGHT_ORIGIN || "http://localhost:3001";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
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
      name: "chromium",
      dependencies: ["setup"],
      testIgnore: /e2e\/setup\/.*/,
      use: {
        ...devices["Desktop Chrome"],
      },
    },
  ],
  webServer: {
    command: "node scripts/dev-e2e.mjs",
    url: "http://localhost:3001/printoms/admin/login",
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
