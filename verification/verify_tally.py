from playwright.sync_api import Page, expect, sync_playwright
import time

def test_tally_flow(page: Page):
    print("Navigating to home...")
    page.goto("http://localhost:5173")

    # 1. Verify Home Page
    print("Verifying Home Page...")
    expect(page.get_by_role("heading", name="Tree Tally")).to_be_visible()
    expect(page.get_by_role("button", name="Start New Tally")).to_be_visible()

    # Verify old form is gone
    expect(page.get_by_role("button", name="Save tally")).not_to_be_visible()
    expect(page.get_by_placeholder("Trees planted")).not_to_be_visible()

    page.screenshot(path="verification/home_page.png")
    print("Home page verified.")

    # 2. Start New Tally
    print("Starting New Tally...")
    page.get_by_role("button", name="Start New Tally").click()

    # Verify New Session Page
    expect(page.get_by_role("heading", name="New Tally Session")).to_be_visible()

    # Verify Date field exists
    # We look for the label "Date"
    expect(page.get_by_text("Date", exact=True)).to_be_visible()

    # Fill form
    print("Filling form...")

    # Check if projects exist
    # wait a bit for projects to load
    time.sleep(1)

    options = page.locator("select option")
    count = options.count()
    print(f"Found {count} project options")

    if count > 1:
        page.select_option("select", index=1)
    else:
        print("No projects found, manually adding species...")
        # Fill the first species row
        inputs = page.locator(".species-row input")
        # code
        inputs.nth(0).fill("OAK")
        # name
        inputs.nth(1).fill("Oak")
        # ratio
        inputs.nth(2).fill("1")

    # Fill Block Name
    page.get_by_placeholder("Block name").fill("Test Block A")

    # Change Date? (Optional, let's leave it as default today)

    # Submit
    print("Submitting...")
    page.get_by_role("button", name="Start session").click()

    # 3. Session Detail
    print("Verifying Session Detail...")
    expect(page.get_by_role("heading", name="Test Block A")).to_be_visible()
    page.screenshot(path="verification/session_detail.png")

    # 4. Back to Home
    print("Going back...")
    page.get_by_role("button", name="Back").click()

    # 5. Verify Session in List
    print("Verifying Session List...")
    # Should see "Test Block A"
    expect(page.get_by_text("Test Block A")).to_be_visible()

    # Should see date and time
    # Get the text of the meta div
    # It contains "species · date time · status"
    # We can check if it contains a date-like string (e.g. "/")
    # Or just visually inspect screenshot.

    page.screenshot(path="verification/home_with_session.png")
    print("Done.")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            test_tally_flow(page)
        except Exception as e:
            print(f"Error: {e}")
            page.screenshot(path="verification/error.png")
        finally:
            browser.close()
