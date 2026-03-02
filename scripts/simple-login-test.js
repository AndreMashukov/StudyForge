const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    console.log('Testing login...');
    await page.goto('http://localhost:4200/auth');
    console.log('✅ Auth page loaded');
    
    await page.fill('#email', 'test@example.com');
    await page.fill('#password', 'password');
    
    console.log('Clicking login button...');
    await page.click('button[type="submit"]');
    
    // Wait and see what happens
    await page.waitForTimeout(5000);
    
    const url = page.url();
    console.log('Current URL:', url);
    
    await page.screenshot({ path: 'login-result.png' });
    console.log('📸 Screenshot saved: login-result.png');

  } catch (error) {
    console.error('Error:', error.message);
    await page.screenshot({ path: 'login-debug.png' });
  } finally {
    await browser.close();
  }
})();
