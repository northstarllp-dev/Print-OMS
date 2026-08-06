import type { Browser, BrowserContext, Page } from "@playwright/test";
import { mintPortalToken } from "./portal-token";

export type PortalSession = {
  context: BrowserContext;
  page: Page;
  token: string;
  url: string;
};

/**
 * Open a fresh (unauthenticated) browser context at a real portal magic-link URL.
 */
export async function portalContext(
  browser: Browser,
  opts: { customerId: string; orderId?: string }
): Promise<PortalSession> {
  const { token, url } = await mintPortalToken({
    customerId: opts.customerId,
    orderId: opts.orderId,
  });

  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(url);

  return { context, page, token, url };
}
