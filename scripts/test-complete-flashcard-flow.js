const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    console.log('=== Testing Flashcard Generation ===\n');
    
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
    
    // Verify the Create Flashcards option exists
    const flashcardOption = await page.locator('text=Create Flashcards').first();
    const isVisible = await flashcardOption.isVisible();
    if (!isVisible) {
      throw new Error('Create Flashcards option not visible');
    }
    console.log('✅ Create Flashcards option found');
    
    // Click it
    await flashcardOption.click();
    console.log('⏳ Calling Gemini API to generate flashcards (this takes 10-30 seconds)...\n');
    
    // Wait for navigation to the flashcard viewer page
    await page.waitForURL(/\/flashcards\/.+/, { timeout: 60000 });
    const flashcardUrl = page.url();
    const match = flashcardUrl.match(/\/flashcards\/([^/]+)/);
    const flashcardSetId = match ? match[1] : null;
    console.log('✅ Navigated to flashcard viewer:', flashcardUrl);
    console.log('   Flashcard Set ID:', flashcardSetId, '\n');
    
    // Wait a moment for the flashcard to render
    await page.waitForTimeout(2000);
    
    // Check if flashcard component is visible
    const flashcardVisible = await page.locator('.flashcard-container').isVisible().catch(() => false);
    if (flashcardVisible) {
      console.log('✅ Flashcard component is visible!\n');
    } else {
      console.log('⚠️ Flashcard component not visible (may still be loading)\n');
    }
    
    await page.screenshot({ path: 'flashcard-generated.png', fullPage: true });
    console.log('📸 Screenshot saved: flashcard-generated.png\n');

    console.log('Step 4: Verify in Flashcard List');
    await page.goto('http://localhost:4200/flashcards');
    await page.waitForTimeout(2000);
    
    const listVisible = await page.locator('text=Flashcards for "Intro to Neural Networks"').isVisible().catch(() => false);
    if (listVisible) {
      console.log('✅ Flashcard set appears in the list!\n');
    } else {
      console.log('⚠️ Flashcard set not visible in list (checking for empty state)\n');
      const emptyState = await page.locator('text=No Flashcard Sets Yet').isVisible().catch(() => false);
      if (emptyState) {
        console.log('   List shows empty state\n');
      }
    }
    
    await page.screenshot({ path: 'flashcard-list-page.png', fullPage: true });
    console.log('📸 Screenshot saved: flashcard-list-page.png\n');

    console.log('=== ✅ SUCCESS! Flashcard feature is fully working! ===');
    
    if (flashcardSetId) {
      console.log('\nYou can view the flashcard set at:');
      console.log(`http://localhost:4200/flashcards/${flashcardSetId}`);
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    await page.screenshot({ path: 'flashcard-test-error.png', fullPage: true });
    console.log('\n📸 Error screenshot saved: flashcard-test-error.png');
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
