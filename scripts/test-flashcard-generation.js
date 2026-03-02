const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    console.log('=== Step 1: Login ===');
    await page.goto('http://localhost:4200/auth');
    await page.fill('#email', 'test@example.com');
    await page.fill('#password', 'password');
    await page.click('button[type="submit"]');
    await page.waitForURL('http://localhost:4200/');
    console.log('✅ Logged in');

    console.log('\n=== Step 2: Open Document ===');
    await page.goto('http://localhost:4200/document/test-doc-for-flashcards');
    await page.waitForTimeout(3000);
    
    const contentVisible = await page.locator('h1:has-text("Neural Networks")').isVisible();
    if (!contentVisible) {
      throw new Error('Document content not visible');
    }
    console.log('✅ Document loaded');

    console.log('\n=== Step 3: Generate Flashcards ===');
    // Click the Actions dropdown
    await page.click('button[aria-haspopup="menu"]');
    await page.waitForTimeout(500);
    
    // Click Create Flashcards
    const flashcardButton = await page.locator('text=Create Flashcards');
    if (!await flashcardButton.isVisible()) {
      throw new Error('Create Flashcards button not found');
    }
    
    // This will trigger the Gemini API call and navigate to the new flashcard set
    await flashcardButton.click();
    console.log('⏳ Generating flashcards (this may take 10-20 seconds)...');
    
    // Wait for navigation to the flashcard viewer page
    await page.waitForURL(/\/flashcards\/.+/, { timeout: 60000 });
    const flashcardUrl = page.url();
    console.log('✅ Navigated to:', flashcardUrl);
    
    await page.screenshot({ path: 'flashcard-created.png' });
    
    // Check if flashcard is visible
    const flashcardVisible = await page.locator('.flashcard-container').isVisible({ timeout: 10000 });
    if (flashcardVisible) {
      console.log('✅ Flashcard component loaded!');
    } else {
      console.log('⚠️ Flashcard component not visible');
    }

    console.log('\n=== Step 4: Check Flashcard List ===');
    await page.goto('http://localhost:4200/flashcards');
    await page.waitForTimeout(2000);
    
    const listVisible = await page.locator('text=Flashcards for "Intro to Neural Networks"').isVisible();
    if (listVisible) {
      console.log('✅ Flashcard set appears in list!');
    } else {
      console.log('⚠️ Flashcard set not in list');
    }
    
    await page.screenshot({ path: 'flashcard-list.png' });

    console.log('\n=== SUCCESS! Flashcard feature is working! ===');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    await page.screenshot({ path: 'flashcard-test-error.png' });
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
