const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Navigate to the app
    await page.goto('http://localhost:4200');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // If redirected to auth, perform login
    const currentUrl = page.url();
    if (currentUrl.includes('/auth')) {
      console.log('Login required, signing in...');
      await page.fill('#email', 'test@example.com');
      await page.fill('#password', 'Test123456!');
      await page.click('button[type="submit"]');
      await page.waitForTimeout(3000);
      console.log('Logged in');
    }

    // Navigate to documents page
    await page.goto('http://localhost:4200/documents');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    
    // Take screenshot
    await page.screenshot({ path: 'current-documents-page.png', fullPage: true });
    console.log('✅ Screenshot saved: current-documents-page.png');

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
