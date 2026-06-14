import { chromium } from "playwright";
import * as path from 'path';

async function verify_feature(page) {
  // Login
  await page.goto("http://localhost:4173/login");
  await page.fill('input[type="text"]', "geabrahu@gmail.com");
  await page.fill('input[type="password"]', "RueshnafEop6");
  await page.click('button[type="submit"]');
  await page.waitForURL("http://localhost:4173/inventory"); // Admin login

  // Go to POS
  await page.goto("http://localhost:4173/pos");
  await page.waitForTimeout(2000);
  await page.screenshot({ path: "/home/jules/verification/pos.png", fullPage: true });

  // Go to Inventory
  await page.goto("http://localhost:4173/inventory");
  await page.waitForTimeout(2000);
  await page.screenshot({ path: "/home/jules/verification/inventory.png", fullPage: true });
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
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
