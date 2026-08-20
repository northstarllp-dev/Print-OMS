import { test, expect } from "@playwright/test";
import { corporateCustomer } from "../fixtures/customers";
import { cleanupByEmail } from "../helpers/cleanup";
import { seedOrderAtProduction } from "../helpers/stages";
import { OrderWorkspacePage } from "../pages/OrderWorkspacePage";
import { ProductionPage } from "../pages/ProductionPage";

test.describe("Production: extra checklist item", () => {
  test("floor can add and tick an extra check", async ({ browser, baseURL }) => {
    const customer = corporateCustomer();
    try {
      const order = await seedOrderAtProduction(customer);

      const prodCtx = await browser.newContext({
        baseURL,
        storageState: "e2e/.auth/production.json",
      });
      const page = await prodCtx.newPage();
      try {
        const workspace = new OrderWorkspacePage(page);
        await workspace.gotoProduction(order.order_id);
        const production = new ProductionPage(page);
        await production.openTab();

        await production.addExtraCheck("Touch up paint on edges");
        await expect(page.getByText("Extra").first()).toBeVisible();

        await production.toggleChecklistItem("Touch up paint on edges");
      } finally {
        await prodCtx.close();
      }
    } finally {
      await cleanupByEmail(customer.email);
    }
  });
});
