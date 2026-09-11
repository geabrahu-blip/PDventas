import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  // Set viewport to a standard desktop size
  await page.setViewportSize({ width: 1280, height: 1024 });

  // Navigate to local preview server
  await page.goto('http://localhost:4173/login');
  await page.waitForTimeout(1000);

  // Login as Admin
  await page.fill('input[type="text"]', 'admin');
  await page.fill('input[type="password"]', 'admin123'); // guessing admin password to test locally
  await page.click('button[type="submit"]');

  // Wait for login to complete and navigate to /reports
  await page.waitForTimeout(3000);
  await page.goto('http://localhost:4173/reports');
  await page.waitForTimeout(2000);

  // Take screenshot of admin view
  await page.screenshot({ path: 'reports_admin_desktop.png', fullPage: true });

  await browser.close();
})();
