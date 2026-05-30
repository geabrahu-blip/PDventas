import asyncio
from playwright.async_api import async_playwright

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()
        await page.goto('http://localhost:5173/catalogo', wait_until='load')
        await page.wait_for_timeout(2000)

        # Click search to trigger load
        await page.click('input[placeholder="Buscar perfumes..."]')
        await page.wait_for_timeout(2000) # Wait for load to finish

        # Type search
        await page.fill('input[placeholder="Buscar perfumes..."]', 'Sauvage')
        await page.wait_for_timeout(2000)

        await page.screenshot(path='/home/jules/verification/screenshots/verification_search.png')
        await browser.close()
        print("Screenshot saved to /home/jules/verification/screenshots/verification_search.png")

asyncio.run(run())
