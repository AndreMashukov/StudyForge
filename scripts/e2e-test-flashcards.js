const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SCREENSHOT_DIR = path.join(__dirname, 'test-screenshots');
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR);
}

const takeScreenshot = async (page, name) => {
  const screenshotPath = path.join(SCREENSHOT_DIR, `${name}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: true });
  console.log(`📸 Screenshot saved: ${screenshotPath}`);
  return screenshotPath;
};

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    console.log('--- Step 1: Logging in ---');
    await page.goto('http://localhost:4200/auth');
    await page.fill('#email', 'test@example.com');
    await page.fill('#password', 'password');
    await page.click('button[type="submit"]');
    await page.waitForURL('http://localhost:4200/');
    await takeScreenshot(page, '01-login-success');

    console.log('\n--- Step 2: Navigating to Document ---');
    await page.goto('http://localhost:4200/documents');
    await page.waitForSelector('text=Intro to Neural Networks');
    await page.click('text=Intro to Neural Networks');
    await page.waitForURL('**/document/test-doc-for-flashcards');
    await takeScreenshot(page, '02-document-viewer');
    
    console.log('\n--- Step 3: Creating Flashcards ---');
    // Click the ActionsDropdown trigger first to make the items visible
    await page.click('button[aria-haspopup="menu"]');
    await page.waitForSelector('text=Create Flashcards');
    // Using a promise to wait for the navigation after the click
    const navigationPromise = page.waitForNavigation({ waitUntil: 'networkidle' });
    await page.click('text=Create Flashcards');
    await navigationPromise; // This will wait until the page navigates
    
    console.log('Redirected to new page, taking screenshot...');
    await takeScreenshot(page, '03-flashcard-viewer-after-creation');
    const newUrl = page.url();
    console.log(`Navigated to: ${newUrl}`);
    
    console.log('\n--- Step 4: Verifying on List Page ---');
    await page.goto('http://localhost:4200/flashcards');
    await page.waitForSelector('text=Flashcards for "Intro to Neural Networks"');
    await takeScreenshot(page, '04-flashcards-list-view');

    console.log('\n--- Step 5: Testing Study Flow ---');
    await page.click('text=Study');
    await page.waitForURL(newUrl); // Navigate back to the viewer page
    await page.waitForSelector('.flashcard-container');
    
    // Flip the card
    await page.click('.flashcard-container');
    await page.waitForTimeout(1000); // Wait for animation
    await takeScreenshot(page, '05-study-card-flipped');

    // Go to next card
    await page.click('button:has-text("Next")');
    await takeScreenshot(page, '06-study-next-card');

    console.log('\n✅ End-to-end test complete!');

  } catch (error) {
    console.error('Error during test:', error);
    await takeScreenshot(page, 'error-screenshot');
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
