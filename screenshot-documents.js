const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    // Navigate to the app
    await page.goto('http://localhost:4200');
    await page.waitForTimeout(2000);
    
    // Check if we need to login
    const currentUrl = page.url();
    console.log('Current URL:', currentUrl);
    
    // Take screenshot of current state
    await page.screenshot({ path: 'app-initial.png', fullPage: true });
    console.log('✅ Screenshot saved: app-initial.png');
    
    // Try to navigate to documents page
    await page.goto('http://localhost:4200/documents');
    await page.waitForTimeout(2000);
    
    // Take screenshot of documents page
    await page.screenshot({ path: 'documents-page.png', fullPage: true });
    console.log('✅ Screenshot saved: documents-page.png');
    
    // Try to navigate to quizzes page
    await page.goto('http://localhost:4200/quizzes');
    await page.waitForTimeout(2000);
    
    // Take screenshot of quizzes page
    await page.screenshot({ path: 'quizzes-page.png', fullPage: true });
    console.log('✅ Screenshot saved: quizzes-page.png');
    
    // Try to navigate to rules page
    await page.goto('http://localhost:4200/rules');
    await page.waitForTimeout(2000);
    
    // Take screenshot of rules page
    await page.screenshot({ path: 'rules-page-full.png', fullPage: true });
    console.log('✅ Screenshot saved: rules-page-full.png');
    
    console.log('\n✨ All screenshots completed!');
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
})();
