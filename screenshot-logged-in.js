const { chromium } = require('playwright');

const EMAIL = 'test@example.com';
const PASSWORD = 'Test123456!';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Navigate to the app
    await page.goto('http://localhost:4200');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);

    const currentUrl = page.url();
    console.log('Current URL:', currentUrl);

    // If redirected to auth, perform login
    if (currentUrl.includes('/auth')) {
      console.log('Login required, signing in...');
      await page.fill('#email', EMAIL);
      await page.fill('#password', PASSWORD);
      await page.click('button[type="submit"]');
      await page.waitForURL('**/documents', { timeout: 15000 }).catch(() => {
        // If it doesn't redirect to documents, just wait a bit
        return page.waitForTimeout(2000);
      });
      await page.waitForTimeout(2000);
      console.log('Logged in successfully');
    }

    // Documents page
    await page.goto('http://localhost:4200/documents');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'logged-in-documents.png', fullPage: true });
    console.log('✅ Screenshot saved: logged-in-documents.png');

    // Quizzes page
    await page.goto('http://localhost:4200/quizzes');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'logged-in-quizzes.png', fullPage: true });
    console.log('✅ Screenshot saved: logged-in-quizzes.png');

    // Rules page
    await page.goto('http://localhost:4200/rules');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'logged-in-rules.png', fullPage: true });
    console.log('✅ Screenshot saved: logged-in-rules.png');

    console.log('\n✨ All screenshots completed!');
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
