import { chromium } from 'playwright';

const BASE_URL = 'http://localhost:4200';

async function captureActionsMenu() {
  console.log('🚀 Starting browser for screenshot...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1200, height: 800 }
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

    // Go to documents and open first document
    console.log('📄 Opening document...');
    await page.goto(`${BASE_URL}/documents`);
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /view/i }).first().click();
    await page.waitForURL(/\/document\/.*/);
    await page.waitForTimeout(2000);

    // Open Actions menu
    console.log('⚡ Opening Actions menu...');
    await page.getByRole('button', { name: /actions/i }).click();
    await page.waitForTimeout(1000);

    // Take screenshot
    console.log('📸 Taking screenshot...');
    const screenshotPath = '/tmp/openclaw/actions-menu-proof.png';
    await page.screenshot({ 
      path: screenshotPath, 
      fullPage: false,
      clip: { x: 0, y: 0, width: 1200, height: 600 }
    });
    
    console.log(`✅ Screenshot saved: ${screenshotPath}`);
    console.log('MEDIA:' + screenshotPath);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await browser.close();
  }
}

captureActionsMenu().catch(console.error);