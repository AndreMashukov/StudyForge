import { chromium } from '@playwright/test';

(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();

  await page.goto('http://localhost:4200/auth', { waitUntil: 'networkidle' });
  await page.locator('input[type="email"]').fill('test@example.com');
  await page.locator('input[type="password"]').fill('Test123456!');
  await page.screenshot({ path: '/a0/usr/workdir/ai-step2-credentials-filled.png', fullPage: true });
  console.log('Step 2a: Credentials filled | Screenshot saved');

  const signInBtn = page.getByRole('button').filter({ hasText: /sign in|log in|login/i }).first();
  await signInBtn.click();
  await page.waitForTimeout(3000);
  await page.screenshot({ path: '/a0/usr/workdir/ai-step2-after-login.png', fullPage: true });
  console.log('Step 2b: After login | URL:', page.url());

  await ctx.storageState({ path: '/tmp/auth-state.json' });
  await browser.close();
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
