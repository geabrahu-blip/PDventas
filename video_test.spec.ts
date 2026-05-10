import { test, expect } from '@playwright/test';

test.use({
  video: 'on',
  viewport: { width: 1280, height: 720 }
});

test('Demonstrate receipt printing', async ({ page }) => {
  await page.goto('http://localhost:5173');

  // Login
  await page.fill('input[type="email"]', 'geabrahu@gmail.com');
  await page.fill('input[type="password"]', 'RueshnafEop6');
  await page.click('button:has-text("Ingresar")');
  await page.waitForURL('**/');

  // Go to Sales Report
  await page.click('a[href="/sales-report"]');
  await page.waitForSelector('text=Reporte de Ventas');

  // Wait for the table to load some sales, or at least the printer button
  await page.waitForSelector('button:has(.lucide-printer)', { state: 'visible' });

  // Click the first printer button
  await page.click('button:has(.lucide-printer) >> nth=0');

  // The modal should appear
  await page.waitForSelector('text=Ticket de Venta');

  // Wait a bit to show the modal
  await page.waitForTimeout(2000);
});
