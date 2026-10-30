import { chromium } from "playwright";
import * as path from 'path';

async function verify_feature(page) {
  await page.goto("http://localhost:5173/catalogo");
  await page.waitForTimeout(500);

  // Take a screenshot of the catalog page
  await page.screenshot({ path: "/home/jules/verification/verification.png", fullPage: true });
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ recordVideo: { dir: "/home/jules/verification/video" } });
  const page = await context.newPage();
  try {
    await verify_feature(page);
  } catch (error) {
    console.error("Test failed:", error);
  } finally {
    await context.close();
    await browser.close();
  }
})();
