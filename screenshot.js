const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // Navigate to the app
  await page.goto('http://localhost:4200');
  
  // Wait a bit for the page to load
  await page.waitForTimeout(3000);
  
  // Take screenshot
  await page.screenshot({ path: 'homepage-screenshot.png', fullPage: true });
  
  await browser.close();
})();
