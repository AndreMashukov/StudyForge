const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    console.log('Visiting auth page...');
    await page.goto('http://localhost:4200/auth', { timeout: 10000 });
    await page.screenshot({ path: 'auth-page-debug.png' });
    console.log('✅ Auth page loaded');
    
    // Check if there are any console errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log('Console error:', msg.text());
      }
    });
    
    // Try to fill the form
    const emailField = await page.$('#email');
    if (emailField) {
      console.log('✅ Email field found');
      await page.fill('#email', 'test@example.com');
      await page.fill('#password', 'password');
      await page.click('button[type="submit"]');
      
      // Wait a bit for navigation
      await page.waitForTimeout(5000);
      const url = page.url();
      console.log('Current URL:', url);
      await page.screenshot({ path: 'after-login-debug.png' });
    } else {
      console.log('❌ Email field not found');
    }

  } catch (error) {
    console.error('Error:', error.message);
    await page.screenshot({ path: 'debug-error.png' });
  } finally {
    await browser.close();
  }
})();
