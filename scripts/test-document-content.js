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
    await page.waitForURL('http://localhost:4200/');

    console.log('\n2. Going to document viewer...');
    await page.goto('http://localhost:4200/document/test-doc-for-flashcards');
    await page.waitForTimeout(5000); // Wait for content to load
    
    await page.screenshot({ path: 'document-content-test.png' });
    
    // Check for error
    const errorVisible = await page.locator('text=Failed to load document content').isVisible().catch(() => false);
    if (errorVisible) {
      console.log('❌ Error loading content');
      
      // Get console errors
      page.on('console', msg => {
        if (msg.type() === 'error') {
          console.log('Console error:', msg.text());
        }
      });
    } else {
      console.log('✅ Content loaded successfully!');
      
      // Check for Actions button
      const actionsButton = await page.locator('button:has-text("Actions")').isVisible().catch(() => false);
      if (actionsButton) {
        console.log('✅ Actions button found!');
      } else {
        console.log('❌ Actions button not found');
      }
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
})();
