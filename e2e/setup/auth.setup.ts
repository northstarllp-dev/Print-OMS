import { test as setup, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { seedUsers, type SeedUserKey } from "../fixtures/users";
import { LoginPage, type PortalKind } from "../pages/LoginPage";
import { getServiceClient, PRINTOMS_COMPANY_ID } from "../helpers/db";

const AUTH_DIR = path.resolve(__dirname, "../.auth");

setup.beforeAll(() => {
  fs.mkdirSync(AUTH_DIR, { recursive: true });

  // Reset the per-stage workflow auto-approval toggles to their defaults
  // before every test run, so a crashed previous run can't leak an ON toggle
  // and change the pending-approval behaviour other tests rely on.
  const db = getServiceClient();
  db.from("app_settings")
    .update({
      workflow_auto_approval: {
        site_visit: false,
        quotation: false,
        design: false,
        production: false,
        installation: false,
      },
    })
    .eq("company_id", PRINTOMS_COMPANY_ID)
    .then(({ error }) => {
      if (error) console.error("setup: failed to reset workflow_auto_approval:", error.message);
    });
});

const roles: Array<{ key: SeedUserKey; portal: PortalKind }> = [
  { key: "admin", portal: "admin" },
  { key: "marketer", portal: "staff" },
  { key: "designer", portal: "staff" },
  { key: "production", portal: "production" },
  { key: "installation", portal: "installation" },
];

for (const { key, portal } of roles) {
  setup(`authenticate as ${key}`, async ({ page }) => {
    const user = seedUsers[key];
    const login = new LoginPage(page, portal);
    await login.goto();
    await login.signIn(user.email, user.password);
    await page.waitForLoadState("networkidle").catch(() => {});
    // Give SSR auth cookies a beat to settle before snapshotting
    await page.waitForTimeout(500);

    const out = path.join(AUTH_DIR, `${key}.json`);
    await page.context().storageState({ path: out });
    expect(fs.existsSync(out)).toBeTruthy();
  });
}
