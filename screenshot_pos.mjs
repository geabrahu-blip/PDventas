import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  // Mock Firebase Auth state to appear logged in as Admin
  await page.addInitScript(() => {
    window.localStorage.setItem('authUser', JSON.stringify({
      uid: 'admin123',
      email: 'admin@pieldivina.com',
      role: 'admin'
    }));
  });

  await page.goto('http://localhost:4173/pos');
  await page.waitForTimeout(4000); // Wait for initialization

  await page.screenshot({ path: 'frontend_screenshot.png', fullPage: true });
  await browser.close();
  console.log("Screenshot saved to frontend_screenshot.png");
})();
