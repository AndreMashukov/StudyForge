const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false }); // Set to false to see what's happening
  const page = await browser.newPage();

  // Capture console logs
  page.on('console', msg => {
    const type = msg.type();
    const text = msg.text();
    if (type === 'error' || text.includes('flashcards')) {
      console.log(`${type === 'error' ? '❌' : 'ℹ️'} ${text}`);
    }
  });

  try {
    console.log('=== Manual Flashcard Test ===\n');
    
    console.log('1. Navigating to auth page...');
    await page.goto('http://localhost:4200/auth');
    await page.fill('#email', 'test@example.com');
    await page.fill('#password', 'password');
    await page.click('button[type="submit"]');
    await page.waitForURL('http://localhost:4200/');
    console.log('✅ Logged in\n');

    console.log('2. Opening document...');
    await page.goto('http://localhost:4200/document/test-doc-for-flashcards');
    await page.waitForTimeout(3000);
    console.log('✅ Document loaded\n');

    console.log('3. Clicking Actions button...');
    await page.click('button:has-text("Actions")');
    await page.waitForTimeout(1000);
    console.log('✅ Dropdown opened\n');

    console.log('4. Clicking Create Flashcards menu item...');
    // Try using evaluate to click directly on the menu item element
    await page.evaluate(() => {
      const menuItem = Array.from(document.querySelectorAll('[role="menuitem"]')).find(
        el => el.textContent.includes('Create Flashcards')
      );
      if (menuItem) {
        console.log('Found menu item, clicking...');
        menuItem.click();
      } else {
        console.error('Menu item not found!');
      }
    });
    
    console.log('✅ Clicked via evaluate');
    console.log('⏳ Waiting for response...\n');
    
    // Wait and see what happens
    await page.waitForTimeout(15000);
    
    const url = page.url();
    console.log('Final URL:', url);
    
    if (url.includes('/flashcards/')) {
      console.log('\n✅✅✅ SUCCESS! Flashcard generation worked!');
    } else {
      console.log('\n❌ Did not navigate to flashcard page');
    }

    // Keep browser open for manual inspection
    console.log('\nBrowser will stay open for 30 seconds. Press Ctrl+C to close.');
    await page.waitForTimeout(30000);

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    await page.waitForTimeout(5000);
  } finally {
    await browser.close();
  }
})();
