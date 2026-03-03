import { chromium } from '@playwright/test';
import * as dotenv from 'dotenv';

dotenv.config();

const AUTH_EMULATOR_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || 'localhost:9099';
const BASE_URL = 'http://localhost:4200';

async function takeScreenshot() {
  console.log('🚀 Starting browser...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Navigate to auth page
    console.log('📍 Navigating to /auth...');
    await page.goto(`${BASE_URL}/auth`);
    await page.waitForLoadState('networkidle');

    // Login
    console.log('🔐 Logging in...');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'Test123456!');
    await page.click('button[type="submit"]');
    
    // Wait for redirect to home
    await page.waitForURL(`${BASE_URL}/`);
    await page.waitForTimeout(2000);

    // Navigate to documents page
    console.log('📄 Navigating to documents...');
    await page.goto(`${BASE_URL}/documents`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Click on the document
    console.log('🎯 Clicking on document...');
    await page.getByRole('button', { name: /view/i }).first().click();
    await page.waitForURL(/\/document\/.*/);
    await page.waitForTimeout(3000);

    // Open Actions menu
    console.log('⚡ Opening Actions menu...');
    await page.getByRole('button', { name: /actions/i }).click();
    await page.waitForTimeout(1000);

    // Take screenshot
    console.log('📸 Taking screenshot...');
    const screenshotPath = '/tmp/openclaw/actions-menu-screenshot.png';
    await page.screenshot({ path: screenshotPath, fullPage: false });
    
    console.log(`✅ Screenshot saved to: ${screenshotPath}`);
    console.log('MEDIA:' + screenshotPath);
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

takeScreenshot().catch(console.error);