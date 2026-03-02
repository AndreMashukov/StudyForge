const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Capture console logs
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('❌ Browser Console Error:', msg.text());
    } else if (msg.type() === 'warning') {
      console.log('⚠️ Browser Warning:', msg.text());
    }
  });

  try {
    console.log('=== Testing Flashcard Generation (with Debug) ===\n');
    
    console.log('Step 1: Login');
    await page.goto('http://localhost:4200/auth');
    await page.fill('#email', 'test@example.com');
    await page.fill('#password', 'password');
    await page.click('button[type="submit"]');
    await page.waitForURL('http://localhost:4200/');
    console.log('✅ Logged in\n');

    console.log('Step 2: Open Document');
    await page.goto('http://localhost:4200/document/test-doc-for-flashcards');
    await page.waitForTimeout(3000);
    console.log('✅ Document loaded\n');

    console.log('Step 3: Generate Flashcards');
    // Click the Actions button
    await page.click('button:has-text("Actions")');
    await page.waitForTimeout(500);
    console.log('✅ Actions dropdown opened');
    
    // Click Create Flashcards
    const flashcardOption = await page.locator('text=Create Flashcards').first();
    await flashcardOption.click();
    console.log('✅ Clicked Create Flashcards');
    console.log('⏳ Waiting for API call and navigation...\n');
    
    // Wait and see what happens
    await page.waitForTimeout(10000);
    
    const url = page.url();
    console.log('Current URL:', url);
    
    if (url.includes('/flashcards/')) {
      console.log('✅ SUCCESS! Navigated to flashcard page');
    } else {
      console.log('❌ Did not navigate to flashcard page');
      console.log('   Still on:', url);
    }
    
    await page.screenshot({ path: 'flashcard-debug-final.png' });

  } catch (error) {
    console.error('\n❌ Test Error:', error.message);
    await page.screenshot({ path: 'flashcard-debug-error.png' });
  } finally {
    await browser.close();
  }
})();
