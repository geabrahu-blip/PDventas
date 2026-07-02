from playwright.sync_api import sync_playwright

def run_cuj(page):
    # Load the app
    page.goto("http://localhost:4173")
    page.wait_for_timeout(3000)

    # Login
    page.fill('input[type="text"]', 'geabrahu@gmail.com')
    page.fill('input[type="password"]', 'RueshnafEop6')
    page.click('button[type="submit"]')
    page.wait_for_timeout(3000)

    page.screenshot(path="/home/jules/verification/screenshots/debug_logged_in.png")

    # Go to Inventory page
    page.goto("http://localhost:4173/inventory")
    page.wait_for_timeout(4000)

    # Click Add Product
    page.click('button:has-text("Añadir Producto")')
    page.wait_for_timeout(2000)

    # Take screenshot of the empty modal (should see X and Cancel buttons, and Skin Type input)
    page.screenshot(path="/home/jules/verification/screenshots/modal_empty.png")

    # Interact with "Tipo de Piel"
    page.fill('input[list="skin-types"]', 'Piel Sensible y Seca')
    page.wait_for_timeout(1000)

    # Take screenshot of the filled Skin Type
    page.screenshot(path="/home/jules/verification/screenshots/skin_type_filled.png")

    # Click Cancelar button at the bottom
    page.click('button:has-text("Cancelar")')
    page.wait_for_timeout(1000)

    # Click Add Product again
    page.click('button:has-text("Añadir Producto")')
    page.wait_for_timeout(2000)

    # Click X button at the top
    page.click('button[title="Cerrar"]')
    page.wait_for_timeout(1000)

    page.screenshot(path="/home/jules/verification/screenshots/modal_closed.png")

if __name__ == "__main__":
    import os
    os.makedirs("/home/jules/verification/screenshots", exist_ok=True)
    os.makedirs("/home/jules/verification/videos", exist_ok=True)

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            record_video_dir="/home/jules/verification/videos",
            viewport={"width": 1280, "height": 720}
        )
        page = context.new_page()
        try:
            run_cuj(page)
        finally:
            context.close()
            browser.close()
