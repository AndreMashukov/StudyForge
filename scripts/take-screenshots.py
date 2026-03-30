import time
from playwright.sync_api import sync_playwright

def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(
            args=['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
            headless=True
        )
        page = browser.new_page(viewport={'width': 1440, 'height': 900})

        # Step 1: Login
        print('Navigating to login page...')
        page.goto('http://localhost:4200/auth', wait_until='networkidle', timeout=30000)
        time.sleep(2)

        # Fill login form
        print('Filling login form...')
        email_input = page.locator('input[type=