import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  // Set viewport to a standard desktop size
  await page.setViewportSize({ width: 1280, height: 1024 });

  // Navigate to local preview server
  await page.goto('http://localhost:4173/login');
  await page.waitForTimeout(1000);

  // Login as Vendor first to see if link is visible
  await page.fill('input[type="text"]', 'admin');
  await page.fill('input[type="password"]', 'admin123'); // guessing admin password to test locally
  await page.click('button[type="submit"]');

  // Wait for login to complete and navigate to /alerts
  await page.waitForTimeout(3000);
  await page.goto('http://localhost:4173/alerts');
  await page.waitForTimeout(2000);

  // Take screenshot of vendor view
  await page.screenshot({ path: 'alerts_vendor_desktop.png', fullPage: true });

  // Mobile View
  await page.setViewportSize({ width: 375, height: 812 });
  await page.reload();
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'alerts_vendor_mobile.png', fullPage: true });

  await browser.close();
})();
