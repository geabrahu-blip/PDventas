from playwright.sync_api import sync_playwright

def run_cuj(page):
    page.goto("http://localhost:4173")
    page.wait_for_timeout(1000)

    # Check if there is an auth context by going to alerts, bypassing UI login just in case
    # Let's try filling standard login form
    page.fill('input[placeholder="Ej. ana"]', 'admin')
    page.fill('input[placeholder="••••••••"]', 'admin123')
    page.get_by_role("button", name="Iniciar Sesión").click()
    page.wait_for_timeout(2000)

    # Try navigating to /alerts
    page.goto("http://localhost:4173/alerts")
    page.wait_for_timeout(2000)

    # Take screenshot
    page.screenshot(path="verification_alerts.png")
    page.wait_for_timeout(1000)

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            record_video_dir="videos"
        )
        page = context.new_page()
        try:
            run_cuj(page)
        finally:
            context.close()
            browser.close()
