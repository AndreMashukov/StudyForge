import { chromium } from 'playwright';

const BASE_URL = 'http://localhost:4200';

async function captureDocumentCardActionsMenu() {
  console.log('🚀 Starting browser for screenshot...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1400, height: 900 }
  });
  const page = await context.newPage();

  try {
    // Login
    console.log('🔐 Logging in...');
    await page.goto(`${BASE_URL}/auth`);
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'Test123456!');
    await page.click('button[type="submit"]');
    await page.waitForURL(`${BASE_URL}/`);

    // Go to documents page (showing list of document cards)
    console.log('📄 Going to documents page...');
    await page.goto(`${BASE_URL}/documents`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Find first document card and open its Actions menu directly
    console.log('⚡ Opening Actions menu on document card...');
    await page.getByRole('button', { name: /actions/i }).first().click();
    await page.waitForTimeout(1000);

    // Take screenshot showing the Actions menu on the document card
    console.log('📸 Taking screenshot...');
    const screenshotPath = '/tmp/openclaw/document-card-actions-menu.png';
    await page.screenshot({ 
      path: screenshotPath, 
      fullPage: false,
      clip: { x: 0, y: 0, width: 1400, height: 600 }
    });
    
    console.log(`✅ Screenshot saved: ${screenshotPath}`);
    console.log('MEDIA:' + screenshotPath);
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

captureDocumentCardActionsMenu().catch(console.error);