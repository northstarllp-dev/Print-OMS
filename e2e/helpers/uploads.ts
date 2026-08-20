import type { Page } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";

/** Tiny 1x1 PNG used for upload tests. */
export function fixtureImagePath(): string {
  const p = path.resolve(__dirname, "../data/sample-photo.png");
  if (!fs.existsSync(p)) {
    // Minimal valid PNG
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64"
    );
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, png);
  }
  return p;
}

export async function uploadFile(
  page: Page,
  inputSelector: string,
  filePath?: string
) {
  const file = filePath ?? fixtureImagePath();
  await page.setInputFiles(inputSelector, file);
}
