import { chromium } from '@playwright/test';
const OUT = '/a0/usr/workdir';

(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();

  // STEP 1: Login
  console.log('=== STEP 1: LOGIN ===');
  await page.goto('http://localhost:4200/auth', { waitUntil: 'networkidle' });
  await page.locator('input[type="email"]').fill('test@example.com');
  await page.locator('input[type="password"]').fill('Test123456!');
  await page.getByRole('button').filter({ hasText: /sign in|log in|login/i }).first().click();
  await page.waitForTimeout(3500);
  await page.screenshot({ path: `${OUT}/edit-s1-logged-in.png`, fullPage: true });
  console.log('📸 edit-s1-logged-in.png | URL:', page.url());

  // STEP 2: Navigate directly to edit mode for seeded rule
  console.log('\n=== STEP 2: EDIT MODE (seeded rule) ===');
  await page.goto('http://localhost:4200/rules/editor/e2e-prompt-rule', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${OUT}/edit-s2-edit-mode.png`, fullPage: true });
  const bodyText = await page.textContent('body');
  console.log('📸 edit-s2-edit-mode.png | URL:', page.url());
  console.log('   Has "Edit Rule":', bodyText?.includes('Edit Rule') || bodyText?.includes('Save Changes'));
  console.log('   Has "AI Assistant":', bodyText?.includes('AI Assistant'));
  console.log('   Has "Improve with AI":', bodyText?.includes('Improve with AI'));

  // STEP 3: Type topic in AI panel
  console.log('\n=== STEP 3: TYPE AI TOPIC ===');
  const textareas = page.locator('textarea');
  const taCount = await textareas.count();
  console.log('Textareas found:', taCount);

  // AI textarea is the last one (after content textarea)
  if (taCount >= 1) {
    const aiTextarea = textareas.last();
    await aiTextarea.click();
    await aiTextarea.fill('Improve this rule to also cover unit testing requirements, error handling best practices, and code documentation standards for Python projects');
    await page.waitForTimeout(500);
  }
  await page.screenshot({ path: `${OUT}/edit-s3-ai-topic-typed.png`, fullPage: true });
  console.log('📸 edit-s3-ai-topic-typed.png | AI topic typed');

  // STEP 4: Click Improve with AI button
  console.log('\n=== STEP 4: CLICK IMPROVE WITH AI ===');
  const improveBtn = page.getByRole('button', { name: 'Improve with AI' });
  const btnCount = await improveBtn.count();
  console.log('Improve with AI button count:', btnCount);

  if (btnCount > 0) {
    await improveBtn.click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${OUT}/edit-s4-ai-loading.png`, fullPage: true });
    console.log('📸 edit-s4-ai-loading.png | AI loading/generating state');

    // STEP 5: Wait for result
    console.log('\n=== STEP 5: WAIT FOR AI RESULT (up to 30s) ===');
    let resultReceived = false;
    for (let i = 0; i < 30; i++) {
      await page.waitForTimeout(1000);
      const txt = await page.textContent('body');
      if (txt?.includes('Apply to Form') || txt?.includes('failed') || txt?.includes('Try again') || txt?.includes('error')) {
        console.log(`AI response after ${i+1}s`);
        resultReceived = true;
        break;
      }
    }
    await page.screenshot({ path: `${OUT}/edit-s5-ai-result.png`, fullPage: true });
    const resultText = await page.textContent('body');
    console.log('📸 edit-s5-ai-result.png | AI result state');
    console.log('   Has "Apply to Form":', resultText?.includes('Apply to Form'));
    console.log('   Has error:', resultText?.includes('failed') || resultText?.includes('Try again') || resultText?.includes('error'));
    console.log('   Result received:', resultReceived);

    // STEP 6: Apply result if available
    const applyBtn = page.getByRole('button', { name: /apply to form/i });
    if (await applyBtn.count() > 0) {
      console.log('\n=== STEP 6: APPLY AI RESULT ===');
      await applyBtn.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: `${OUT}/edit-s6-ai-applied.png`, fullPage: true });
      console.log('📸 edit-s6-ai-applied.png | AI result applied to form ✅');
    } else {
      console.log('Apply to Form button not found — checking for retry button...');
      const retryBtn = page.getByRole('button', { name: /try again|retry/i });
      if (await retryBtn.count() > 0) {
        console.log('Found retry button — AI call failed (likely no API key in emulator)');
      }
    }
  } else {
    console.log('Improve with AI button NOT found!');
    // Print all buttons on the page
    const allBtns = await page.locator('button').all();
    for (const btn of allBtns) {
      const txt = await btn.textContent();
      console.log('Button:', txt?.trim());
    }
  }

  await browser.close();
  console.log('\n=== TEST COMPLETE ===');
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
