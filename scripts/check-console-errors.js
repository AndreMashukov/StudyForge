const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Capture console logs
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('BROWSER ERROR:', msg.text());
    }
  });

  try {
    console.log('Logging in...');
    await page.goto('http://localhost:4200/auth');
    await page.fill('#email', 'test@example.com');
    await page.fill('#password', 'password');
    await page.click('button[type="submit"]');
    await page.waitForURL('http://localhost:4200/', { timeout: 10000 });

    console.log('\nGoing to documents page...');
    await page.goto('http://localhost:4200/documents');
    await page.waitForTimeout(5000); // Wait for API calls to complete

    console.log('\n--- Browser Console Errors ---');
    // Console errors will be printed by the event handler above

  } catch (error) {
    console.error('Test error:', error.message);
  } finally {
    await browser.close();
  }
})();
