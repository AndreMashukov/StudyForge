import { chromium } from '@playwright/test';

const OUT = '/a0/usr/workdir';

(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();

  // ── STEP 1: Login ───────────────────────────────────────────────────────────
  console.log('\n=== STEP 1: LOGIN ===');
  await page.goto('http://localhost:4200/auth', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await page.locator('input[type="email"]').fill('test@example.com');
  await page.locator('input[type="password"]').fill('Test123456!');
  await page.screenshot({ path: `${OUT}/v2-s1-credentials.png`, fullPage: true });
  console.log('📸 v2-s1-credentials.png');

  await page.getByRole('button').filter({ hasText: /sign in|log in|login/i }).first().click();
  await page.waitForTimeout(3500);
  await page.screenshot({ path: `${OUT}/v2-s2-logged-in.png`, fullPage: true });
  console.log('📸 v2-s2-logged-in.png | URL:', page.url());

  // ── STEP 2: Go to Rule Editor - create mode ─────────────────────────────────
  console.log('\n=== STEP 2: RULE EDITOR CREATE MODE ===');
  await page.goto('http://localhost:4200/rules/editor', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${OUT}/v2-s3-editor-create.png`, fullPage: true });
  console.log('📸 v2-s3-editor-create.png | URL:', page.url());

  // ── STEP 3: Fill the rule form ─────────────────────────────────────────────
  console.log('\n=== STEP 3: FILL FORM ===');
  // Name: placeholder is 'DSA Code Examples'
  await page.getByPlaceholder('DSA Code Examples').fill('Python Code Quality Rule');
  await page.waitForTimeout(300);

  // Click prompt applicability toggle
  await page.getByRole('button', { name: 'prompt' }).click();
  await page.waitForTimeout(300);

  // Fill content (first textarea on the page)
  const textareas = page.locator('textarea');
  await textareas.first().fill('Always follow PEP 8 style guide. Use type hints consistently. Write docstrings for all public functions.');
  await page.waitForTimeout(300);

  await page.screenshot({ path: `${OUT}/v2-s4-form-filled.png`, fullPage: true });
  console.log('📸 v2-s4-form-filled.png | Form filled');

  // ── STEP 4: Save the rule ──────────────────────────────────────────────────
  console.log('\n=== STEP 4: SAVE RULE ===');
  // Save button is in header, should say 'Save' or match 'Create Rule'
  const saveBtn = page.getByRole('button', { name: /^save$/i });
  await saveBtn.click();
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${OUT}/v2-s5-after-save.png`, fullPage: true });
  console.log('📸 v2-s5-after-save.png | URL:', page.url());

  // Capture the ruleId from URL
  const urlAfterSave = page.url();
  const ruleIdMatch = urlAfterSave.match(/\/rules\/editor\/([^?]+)/);
  const ruleId = ruleIdMatch?.[1];
  console.log('Rule ID from URL:', ruleId);

  // ── STEP 5: Navigate to /rules and find the rule ───────────────────────────
  console.log('\n=== STEP 5: RULES LIST ===');
  await page.goto('http://localhost:4200/rules', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${OUT}/v2-s6-rules-list.png`, fullPage: true });
  console.log('📸 v2-s6-rules-list.png');

  // ── STEP 6: Navigate to edit mode ─────────────────────────────────────────
  console.log('\n=== STEP 6: EDIT MODE ===');
  if (ruleId) {
    await page.goto(`http://localhost:4200/rules/editor/${ruleId}`, { waitUntil: 'networkidle' });
  } else {
    // Try clicking the 3-dot menu on the first rule card
    const menuTrigger = page.locator('[role="button"]').filter({ has: page.locator('svg[data-lucide], [class*="more"]') }).first();
    if (await menuTrigger.count() > 0) {
      await menuTrigger.click();
      await page.waitForTimeout(500);
      await page.getByRole('menuitem', { name: /edit/i }).click();
    }
  }
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${OUT}/v2-s7-edit-mode.png`, fullPage: true });
  const editText = await page.textContent('body');
  console.log('📸 v2-s7-edit-mode.png | URL:', page.url());
  console.log('   Has "Edit Rule":', editText?.includes('Edit Rule'));
  console.log('   Has "AI Assistant":', editText?.includes('AI Assistant'));
  console.log('   Has "Improve with AI":', editText?.includes('Improve with AI'));

  // ── STEP 7: Use AI Assistant ───────────────────────────────────────────────
  console.log('\n=== STEP 7: AI ASSISTANT - TYPE TOPIC ===');
  const textareasEdit = page.locator('textarea');
  const taCount = await textareasEdit.count();
  console.log('Total textareas in edit mode:', taCount);

  // AI panel textarea is the LAST textarea (after the content textarea)
  if (taCount >= 2) {
    await textareasEdit.last().click();
    await textareasEdit.last().fill('Improve this rule to also cover unit testing best practices, error handling patterns, and code review standards for Python');
    await page.waitForTimeout(500);
  }
  await page.screenshot({ path: `${OUT}/v2-s8-ai-typed.png`, fullPage: true });
  console.log('📸 v2-s8-ai-typed.png | AI topic typed');

  // ── STEP 8: Click Improve with AI ─────────────────────────────────────────
  console.log('\n=== STEP 8: CLICK IMPROVE WITH AI ===');
  const aiButton = page.getByRole('button', { name: /improve with ai|generate with ai/i });
  const aiBtnCount = await aiButton.count();
  console.log('AI button count:', aiBtnCount);

  if (aiBtnCount > 0) {
    await aiButton.click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${OUT}/v2-s9-ai-loading.png`, fullPage: true });
    console.log('📸 v2-s9-ai-loading.png | AI loading state');

    // Wait for Gemini response (up to 30s)
    console.log('Waiting for Gemini AI response...');
    for (let i = 0; i < 30; i++) {
      await page.waitForTimeout(1000);
      const bodyContent = await page.textContent('body');
      if (bodyContent?.includes('Apply to Form') || bodyContent?.includes('Discard') || bodyContent?.includes('failed') || bodyContent?.includes('error')) {
        console.log(`AI response received after ${i+1}s`);
        break;
      }
    }
    await page.screenshot({ path: `${OUT}/v2-s10-ai-result.png`, fullPage: true });
    const resultBodyText = await page.textContent('body');
    console.log('📸 v2-s10-ai-result.png | AI result state');
    console.log('   Has "Apply to Form":', resultBodyText?.includes('Apply to Form'));
    console.log('   Has "Discard":', resultBodyText?.includes('Discard'));
    console.log('   Has generating:', resultBodyText?.includes('Generating') || resultBodyText?.includes('generating'));

    // Apply result if available
    const applyBtn = page.getByRole('button', { name: /apply to form/i });
    if (await applyBtn.count() > 0) {
      console.log('\n=== STEP 9: APPLY AI RESULT ===');
      await applyBtn.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: `${OUT}/v2-s11-ai-applied.png`, fullPage: true });
      console.log('📸 v2-s11-ai-applied.png | AI result applied to form ✅');
    }
  }

  await browser.close();
  console.log('\n=== ALL STEPS COMPLETE ===');
})().catch(e => { console.error('SCRIPT FAILED:', e.message); process.exit(1); });
