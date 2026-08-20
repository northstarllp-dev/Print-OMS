import { test, expect } from "@playwright/test";
import { seedUsers } from "../fixtures/users";
import { LoginPage } from "../pages/LoginPage";
import { appPath } from "../helpers/paths";

test.describe("auth", () => {
  test("admin can sign in with seeded credentials", async ({ page }) => {
    const login = new LoginPage(page, "admin");
    await login.goto();
    await login.signIn(seedUsers.admin.email, seedUsers.admin.password);
    await expect(page).toHaveURL(/\/printoms\/admin\//);
  });

  test("staff marketer can sign in and reach staff portal", async ({
    page,
  }) => {
    const login = new LoginPage(page, "staff");
    await login.goto();
    await login.signIn(seedUsers.marketer.email, seedUsers.marketer.password);
    await expect(page).toHaveURL(/\/printoms\/staff\//);
    await expect(page.locator("#staff-email")).toHaveCount(0);
  });

  test("staff cannot open admin dashboard", async ({ page }) => {
    const login = new LoginPage(page, "staff");
    await login.goto();
    await login.signIn(seedUsers.marketer.email, seedUsers.marketer.password);
    await page.goto(appPath("/admin/dashboard"));
    await expect(page).not.toHaveURL(/\/printoms\/admin\/dashboard$/);
  });
});
