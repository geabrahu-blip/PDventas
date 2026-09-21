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

  // Add an item to cart (assuming there is at least one)
  const addToCartBtn = await page.$('button:has-text("Agregar")');
  if (addToCartBtn) {
    await addToCartBtn.click();
    await page.waitForTimeout(1000);
  } else {
     console.log("No add to cart button found.");
     // Fallback, click the first product card
     const firstProduct = await page.$('.grid > div');
     if (firstProduct) {
        await firstProduct.click();
        await page.waitForTimeout(1000);
     }
  }

  await page.screenshot({ path: "/home/jules/verification/pos_cart.png", fullPage: true });

  // Click Cobrar Venta
  const cobrarBtn = await page.locator('button:has-text("Cobrar Venta")');
  if (await cobrarBtn.count() > 0) {
      await cobrarBtn.click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: "/home/jules/verification/pos_checkout.png", fullPage: true });
  } else {
      console.log("Cobrar Venta button not found");
  }

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
