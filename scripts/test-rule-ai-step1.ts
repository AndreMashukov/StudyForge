import { chromium } from '@playwright/test';

(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  // Login first
  await page.goto('http://localhost:4200/auth', { waitUntil: 'networkidle' });
  await page.locator('input[type="email"]').fill('test@example.com');
  await page.locator('input[type="password"]').fill('Test123456!');
  await page.getByRole('button', { name: /sign in|login/i }).click();
  await page.waitForTimeout(3000);
  console.log('Logged in, URL:', page.url());

  // Step 1: Navigate to /rules
  await page.goto('http://localhost:4200/rules', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: '/a0/usr/workdir/ai-test-step1-rules-list.png', fullPage: true });
  console.log('Step 1 complete: Rules list screenshot saved');
  console.log('URL:', page.url());
  const ruleCount = await page.locator('[class*="card"], [class*="Card"]').count();
  console.log('Rule cards visible:', ruleCount);

  await browser.close();
})();
