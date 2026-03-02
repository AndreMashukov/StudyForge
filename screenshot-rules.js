const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // Navigate to the app
  await page.goto('http://localhost:4200');
  
  // Wait for page to load
  await page.waitForTimeout(2000);
  
  // Take screenshot of home page
  await page.screenshot({ path: 'home-page.png', fullPage: true });
  
  // Navigate to rules page (assuming there's a rules route)
  await page.goto('http://localhost:4200/rules');
  await page.waitForTimeout(2000);
  
  // Take screenshot of rules page
  await page.screenshot({ path: 'rules-page.png', fullPage: true });
  
  await browser.close();
})();
