const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    await page.goto('http://localhost:4200/auth', { waitUntil: 'networkidle' });
    await page.screenshot({ path: 'debug-auth-page.png' });
    console.log('📸 Screenshot of /auth page saved to debug-auth-page.png');
  } catch (e) {
    console.error('Error taking screenshot:', e);
  } finally {
    await browser.close();
  }
})();
