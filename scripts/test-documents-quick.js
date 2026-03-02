const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    console.log('1. Logging in...');
    await page.goto('http://localhost:4200/auth');
    await page.fill('#email', 'test@example.com');
    await page.fill('#password', 'password');
    await page.click('button[type="submit"]');
    await page.waitForURL('http://localhost:4200/', { timeout: 10000 });
    console.log('✅ Logged in');

    console.log('\n2. Going to documents page...');
    await page.goto('http://localhost:4200/documents');
    await page.waitForTimeout(3000); // Wait for data to load
    
    await page.screenshot({ path: 'documents-page-final.png' });
    console.log('📸 Screenshot saved: documents-page-final.png');

    // Check if error is visible
    const errorVisible = await page.locator('text=Error loading content').isVisible().catch(() => false);
    if (errorVisible) {
      console.log('❌ Error message still visible');
    } else {
      console.log('✅ No error message visible');
    }

    // Check if document is visible
    const docVisible = await page.locator('text=Intro to Neural Networks').isVisible().catch(() => false);
    if (docVisible) {
      console.log('✅ Document found!');
    } else {
      console.log('❌ Document not found');
    }

  } catch (error) {
    console.error('Error:', error.message);
    await page.screenshot({ path: 'debug-error.png' });
  } finally {
    await browser.close();
  }
})();
