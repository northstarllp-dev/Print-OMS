import type { Page } from "@playwright/test";
import { appPath } from "../helpers/paths";

export class StaffQueuePage {
  constructor(private readonly page: Page) {}

  async goto(queue: string) {
    await this.page.goto(appPath(`/staff/${queue}`));
  }

  async openOrderByText(text: string) {
    await this.page.getByText(text, { exact: false }).first().click();
  }
}
