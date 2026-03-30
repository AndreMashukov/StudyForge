import { chromium } from '@playwright/test';

(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();

  // Navigate to auth
  await page.goto('http://localhost:4200/auth', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: '/a0/usr/workdir/ai-test-s1-auth-page.png', fullPage: true });
  console.log('STEP 1 DONE | URL:', page.url());
  console.log('Has email field:', (await page.locator('input[type="email"]').count()) > 0);

  await browser.close();
})();
