import type { Browser, BrowserContext, Page } from "@playwright/test";
import path from "node:path";
import { seedUsers, type SeedUserKey } from "../fixtures/users";
import { LoginPage, type PortalKind } from "../pages/LoginPage";

const AUTH_DIR = path.resolve(__dirname, "../.auth");

export function authFileFor(userKey: SeedUserKey): string {
  return path.join(AUTH_DIR, `${userKey}.json`);
}

export async function loginAs(
  page: Page,
  userKey: SeedUserKey
): Promise<void> {
  const user = seedUsers[userKey];
  const login = new LoginPage(page, user.portal as PortalKind);
  await login.goto();
  await login.signIn(user.email, user.password);
}

export async function contextAs(
  browser: Browser,
  userKey: SeedUserKey
): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({
    storageState: authFileFor(userKey),
  });
  const page = await context.newPage();
  return { context, page };
}
