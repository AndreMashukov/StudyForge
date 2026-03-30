import { chromium } from '@playwright/test';
const OUT = '/a0/usr/workdir';
(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();

  // Fresh login
  await page.goto('http://localhost:4200/auth', { waitUntil: 'networkidle' });
  await page.locator('input[type="email"]').fill('test@example.com');
  await page.locator('input[type="password"]').fill('Test123456!');
  await page.getByRole('button').filter({ hasText: /sign in|log in|login/i }).first().click();
  await page.waitForTimeout(3000);
  console.log('Logged in | URL:', page.url());

  // Go to rule editor create mode
  await page.goto('http://localhost:4200/rules/editor', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // Fill form
  await page.getByPlaceholder('DSA Code Examples').fill('Python Code Quality Rule');
  await page.waitForTimeout(200);
  const textareas = page.locator('textarea');
  await textareas.first().fill('Follow PEP 8. Use type hints. Write docstrings for all public functions.');
  await page.waitForTimeout(200);

  // Click Create Rule button  
  const createBtn = page.getByRole('button', { name: 'Create Rule' });
  const count = await createBtn.count();
  console.log('Create Rule button count:', count);
  await page.screenshot({ path: `${OUT}/save-s1-before-save.png`, fullPage: true });

  if (count > 0) {
    await createBtn.click();
    await page.waitForTimeout(3000);
  }
  await page.screenshot({ path: `${OUT}/save-s2-after-save.png`, fullPage: true });
  console.log('After save | URL:', page.url());

  await browser.close();
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
