import type { Page } from "@playwright/test";
import { appPath } from "../helpers/paths";

export type PortalKind = "admin" | "staff" | "production" | "installation";

const PATHS: Record<PortalKind, string> = {
  admin: appPath("/admin/login"),
  staff: appPath("/staff/login"),
  production: appPath("/production/login"),
  installation: appPath("/installation/login"),
};

const IDS: Record<PortalKind, { email: string; password: string; submit: string }> = {
  admin: {
    email: "#admin-email",
    password: "#admin-password",
    submit: "Sign In to Admin Portal",
  },
  staff: {
    email: "#staff-email",
    password: "#staff-password",
    submit: "Sign In to Staff Portal",
  },
  production: {
    email: "#production-email",
    password: "#production-password",
    submit: "Sign In to Production Portal",
  },
  installation: {
    email: "#installation-email",
    password: "#installation-password",
    submit: "Sign In to Installation Portal",
  },
};

const SUCCESS_URL: Record<PortalKind, RegExp> = {
  admin: /\/printoms\/admin\/(?!login)/,
  staff: /\/printoms\/staff\/(?!login)/,
  production: /\/printoms\/production\/(?!login)/,
  installation: /\/printoms\/installation\/(?!login)/,
};

export class LoginPage {
  constructor(
    private readonly page: Page,
    private readonly portal: PortalKind
  ) {}

  async goto() {
    await this.page.goto(PATHS[this.portal]);
  }

  async signIn(email: string, password: string) {
    const ids = IDS[this.portal];
    await this.page.locator(ids.email).waitFor({ state: "visible", timeout: 30_000 });
    await this.page.locator(ids.email).fill(email);
    await this.page.locator(ids.password).fill(password);
    await this.page.getByRole("button", { name: ids.submit }).click();
    await this.page.waitForURL(SUCCESS_URL[this.portal], { timeout: 30_000 });
  }
}
