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
    await page.waitForTimeout(3000);
    
    const url = page.url();
    console.log('Current URL after login:', url);
    
    if (url.includes('/auth')) {
      console.log('❌ Still on auth page - login may have failed');
      await page.screenshot({ path: 'login-failed.png' });
    } else {
      console.log('✅ Logged in successfully');
    }

    console.log('\n2. Going to document viewer...');
    await page.goto('http://localhost:4200/document/test-doc-for-flashcards');
    await page.waitForTimeout(5000);
    
    await page.screenshot({ path: 'document-viewer.png' });
    
    // Check for error
    const errorVisible = await page.locator('text=Failed to load document content').isVisible().catch(() => false);
    if (errorVisible) {
      console.log('❌ Error loading content');
    } else {
      console.log('✅ Content loaded successfully!');
      
      // Check for Actions button
      const actionsButton = await page.locator('button:has-text("Actions")').isVisible().catch(() => false);
      if (actionsButton) {
        console.log('✅ Actions button found!');
      } else {
        console.log('⚠️ Actions button not found - checking for dropdown');
        const dropdown = await page.locator('button[aria-haspopup="menu"]').isVisible().catch(() => false);
        if (dropdown) {
          console.log('✅ Dropdown menu found!');
        } else {
          console.log('❌ No actions menu found');
        }
      }
    }

  } catch (error) {
    console.error('Error:', error.message);
    await page.screenshot({ path: 'test-error.png' });
  } finally {
    await browser.close();
  }
})();
