import { chromium } from '@playwright/test';
const OUT = '/a0/usr/workdir';

(async () => {
  const browser = await chromium.launch({
    executablePath: '/usr/bin/chromium',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  // STEP 1: Navigate to auth page
  console.log('=== STEP 1: Navigate to /auth ===');
  await page.goto('http://localhost:4200/auth', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${OUT}/ai-browser-s1-auth.png`, fullPage: true });
  const s1text = await page.textContent('body');
  console.log('📸 s1: URL:', page.url(), '| Has login form:', s1text?.includes('Sign') || s1text?.includes('Login'));

  // STEP 2: Fill email
  console.log('\n=== STEP 2: Fill email ===');
  await page.locator('input[type="email"]').fill('test@example.com');
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/ai-browser-s2-email.png`, fullPage: true });
  console.log('📸 s2: Email filled');

  // STEP 3: Fill password
  console.log('\n=== STEP 3: Fill password ===');
  await page.locator('input[type="password"]').fill('Test123456!');
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/ai-browser-s3-password.png`, fullPage: true });
  console.log('📸 s3: Password filled');

  // STEP 4: Click sign in
  console.log('\n=== STEP 4: Click Sign In ===');
  await page.getByRole('button').filter({ hasText: /sign in|log in|login/i }).first().click();
  await page.waitForTimeout(4000);
  await page.screenshot({ path: `${OUT}/ai-browser-s4-logged-in.png`, fullPage: true });
  console.log('📸 s4: URL after login:', page.url());

  // STEP 5: Navigate to edit mode for seeded rule
  console.log('\n=== STEP 5: Navigate to rule editor (edit mode) ===');
  await page.goto('http://localhost:4200/rules/editor/e2e-prompt-rule', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${OUT}/ai-browser-s5-edit-mode.png`, fullPage: true });
  const s5text = await page.textContent('body');
  console.log('📸 s5: URL:', page.url());
  console.log('   Has AI Assistant:', s5text?.includes('AI Assistant'));
  console.log('   Has Edit Rule / Save:', s5text?.includes('Edit') || s5text?.includes('Save'));

  // STEP 6: Type topic in AI panel
  console.log('\n=== STEP 6: Type topic in AI panel ===');
  const textareas = page.locator('textarea');
  const taCount = await textareas.count();
  console.log('Total textareas found:', taCount);
  // AI panel textarea is the last one
  const aiTextarea = textareas.last();
  await aiTextarea.scrollIntoViewIfNeeded();
  await aiTextarea.click();
  await aiTextarea.fill('Improve this rule to include unit testing requirements and documentation standards');
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/ai-browser-s6-topic-typed.png`, fullPage: true });
  console.log('📸 s6: Topic typed in AI panel');

  // STEP 7: Click Generate/Improve with AI button
  console.log('\n=== STEP 7: Click Generate with AI ===');
  const improveBtn = page.getByRole('button', { name: /improve with ai|generate with ai/i });
  const genBtn = page.getByRole('button', { name: /generate|improve/i });
  const btnCount = await improveBtn.count();
  console.log('AI button count:', btnCount);
  if (btnCount > 0) {
    await improveBtn.first().click();
  } else {
    await genBtn.first().click();
  }
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/ai-browser-s7-generating.png`, fullPage: true });
  const s7text = await page.textContent('body');
  console.log('📸 s7: Generating state | Has loading/generating:', s7text?.includes('Generating') || s7text?.includes('generating'));

  // STEP 8: Wait for AI to finish (up to 45 seconds)
  console.log('\n=== STEP 8: Wait for AI result (max 45s) ===');
  let resultFound = false;
  for (let i = 0; i < 9; i++) {
    await page.waitForTimeout(5000);
    const bodyText = await page.textContent('body');
    const hasApply = bodyText?.includes('Apply') || bodyText?.includes('apply');
    const hasDiscard = bodyText?.includes('Discard') || bodyText?.includes('discard');
    const hasError = bodyText?.includes('Error') || bodyText?.includes('error') || bodyText?.includes('failed');
    console.log(`  After ${(i+1)*5}s: hasApply=${hasApply}, hasDiscard=${hasDiscard}, hasError=${hasError}`);
    if (hasApply || hasError) {
      resultFound = true;
      break;
    }
  }
  await page.screenshot({ path: `${OUT}/ai-browser-s8-ai-result.png`, fullPage: true });
  const s8text = await page.textContent('body');
  console.log('📸 s8: AI result | Has Apply button:', s8text?.includes('Apply'));
  console.log('   Has error:', s8text?.includes('error') || s8text?.includes('Error'));
  console.log('   Result found:', resultFound);

  // STEP 9: Click Apply to Form (if result is shown)
  if (resultFound && s8text?.includes('Apply')) {
    console.log('\n=== STEP 9: Click Apply to Form ===');
    const applyBtn = page.getByRole('button', { name: /apply/i });
    await applyBtn.first().click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${OUT}/ai-browser-s9-applied.png`, fullPage: true });
    const s9text = await page.textContent('body');
    console.log('📸 s9: Applied | Form should have AI content now');
    console.log('   Content area has text:', (s9text?.length ?? 0) > 100);
  } else {
    console.log('\n=== STEP 9: SKIPPED - No Apply button found ===');
    await page.screenshot({ path: `${OUT}/ai-browser-s9-skipped.png`, fullPage: true });
  }

  console.log('\n=== ALL STEPS COMPLETE ===');
  await browser.close();
})();
