import asyncio
from playwright.async_api import async_playwright

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()
        # Networkidle might timeout if Firebase keeps a long-polling connection open
        await page.goto('http://localhost:5173/catalogo', wait_until='load')
        # Wait a bit for React to render and fetch data
        await page.wait_for_timeout(5000)
        await page.screenshot(path='/home/jules/verification/screenshots/verification_catalog_final.png', full_page=True)
        await browser.close()
        print("Screenshot saved to /home/jules/verification/screenshots/verification_catalog_final.png")

asyncio.run(run())
