import { chromium } from '@playwright/test';

(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    storageState: '/tmp/auth-state.json',
  });
  const page = await ctx.newPage();

  await page.goto('http://localhost:4200/rules/editor', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: '/a0/usr/workdir/ai-step3-editor-create.png', fullPage: true });

  const text = await page.textContent('body');
  console.log('Step 3 DONE | URL:', page.url());
  console.log('Has "Create Rule":', text?.includes('Create Rule'));
  console.log('Has "AI Assistant":', text?.includes('AI Assistant'));
  console.log('Has "Back to Rules":', text?.includes('Back to Rules'));

  await browser.close();
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
