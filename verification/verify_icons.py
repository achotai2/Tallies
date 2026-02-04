from playwright.sync_api import Page, expect, sync_playwright

def verify_icons(page: Page):
    # Navigate to the app
    page.goto("http://localhost:5173")

    # Verify favicon link
    favicon = page.locator('link[rel="icon"]')
    expect(favicon).to_have_attribute("href", "/Icon.png")
    expect(favicon).to_have_attribute("type", "image/png")
    print("Favicon verified.")

    # Verify manifest link
    manifest = page.locator('link[rel="manifest"]')
    expect(manifest).to_have_attribute("href", "/manifest.webmanifest")
    print("Manifest link verified.")

    # Verify app logo
    # The logo is created in app.ts with class 'app-logo'
    logo = page.locator("img.app-logo")
    expect(logo).to_be_visible()
    expect(logo).to_have_attribute("src", "/Icon.png")
    print("App logo verified.")

    # Take screenshot
    page.screenshot(path="verification/verification.png")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            verify_icons(page)
        except Exception as e:
            print(f"Error: {e}")
            page.screenshot(path="verification/error.png")
        finally:
            browser.close()
