import { chromium } from '@playwright/test';
import * as path from 'path';

const OUT = '/a0/usr/workdir';

(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();

  // ── STEP 1: Login ─────────────────────────────────────────────
  console.log('\n=== STEP 1: LOGIN ===');
  await page.goto('http://localhost:4200/auth', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/full-s1-auth.png`, fullPage: true });
  console.log('📸 full-s1-auth.png | URL:', page.url());

  await page.locator('input[type="email"]').fill('test@example.com');
  await page.locator('input[type="password"]').fill('Test123456!');
  await page.screenshot({ path: `${OUT}/full-s2-filled.png`, fullPage: true });
  console.log('📸 full-s2-filled.png | Credentials filled');

  await page.getByRole('button').filter({ hasText: /sign in|log in|login/i }).first().click();
  await page.waitForTimeout(3500);
  await page.screenshot({ path: `${OUT}/full-s3-logged-in.png`, fullPage: true });
  console.log('📸 full-s3-logged-in.png | URL:', page.url());

  // ── STEP 2: Navigate to Rule Editor (create mode) ─────────────
  console.log('\n=== STEP 2: RULE EDITOR - CREATE MODE ===');
  await page.goto('http://localhost:4200/rules/editor', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${OUT}/full-s4-editor-create.png`, fullPage: true });
  const bodyText = await page.textContent('body');
  console.log('📸 full-s4-editor-create.png | URL:', page.url());
  console.log('   Has "Create Rule":', bodyText?.includes('Create Rule'));
  console.log('   Has "AI Assistant":', bodyText?.includes('AI Assistant'));

  // ── STEP 3: Fill form fields ───────────────────────────────────
  console.log('\n=== STEP 3: FILL FORM ===');
  // Name field
  const nameInput = page.getByPlaceholder(/rule name/i);
  if (await nameInput.count() > 0) {
    await nameInput.fill('Python Code Quality Rule');
  } else {
    const inputs = page.locator('input[type="text"]');
    await inputs.first().fill('Python Code Quality Rule');
  }
  await page.waitForTimeout(300);

  // Click prompt applicability
  const promptToggle = page.getByRole('button', { name: /^prompt$/i });
  if (await promptToggle.count() > 0) await promptToggle.click();

  // Fill content textarea
  const contentTextarea = page.locator('textarea').first();
  await contentTextarea.fill('Follow PEP 8 style guide. Use type hints. Write docstrings for all public functions and classes. Keep functions small and focused.');
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/full-s5-form-filled.png`, fullPage: true });
  console.log('📸 full-s5-form-filled.png | Form filled');

  // ── STEP 4: Save the rule ──────────────────────────────────────
  console.log('\n=== STEP 4: SAVE RULE ===');
  const saveBtn = page.getByRole('button', { name: /save|create rule/i }).last();
  if (await saveBtn.count() > 0) {
    await saveBtn.click();
    await page.waitForTimeout(3000);
  }
  await page.screenshot({ path: `${OUT}/full-s6-after-save.png`, fullPage: true });
  console.log('📸 full-s6-after-save.png | After save | URL:', page.url());

  // ── STEP 5: Go to rules list ───────────────────────────────────
  console.log('\n=== STEP 5: RULES LIST ===');
  await page.goto('http://localhost:4200/rules', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${OUT}/full-s7-rules-list.png`, fullPage: true });
  console.log('📸 full-s7-rules-list.png | Rules list');

  // Find and click edit on the rule card
  // Try clicking the 3-dot menu button on the first card
  const moreBtn = page.locator('button').filter({ has: page.locator('svg') }).nth(2);
  if (await moreBtn.count() > 0) {
    await moreBtn.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${OUT}/full-s8-menu-open.png`, fullPage: true });
    console.log('📸 full-s8-menu-open.png | Menu open');

    const editItem = page.getByRole('menuitem', { name: /edit/i });
    if (await editItem.count() > 0) {
      await editItem.click();
      await page.waitForTimeout(2500);
    }
  }
  await page.screenshot({ path: `${OUT}/full-s9-edit-mode.png`, fullPage: true });
  console.log('📸 full-s9-edit-mode.png | Edit mode | URL:', page.url());

  // ── STEP 6: AI Assistant - type topic ─────────────────────────
  console.log('\n=== STEP 6: AI ASSISTANT ===');
  // Find AI panel textarea (last textarea on page)
  const textareas = page.locator('textarea');
  const count = await textareas.count();
  console.log('Total textareas:', count);

  if (count >= 2) {
    // Last textarea should be the AI panel input
    await textareas.last().fill('Improve this rule to also cover error handling, logging practices, and unit testing requirements for Python');
    await page.waitForTimeout(500);
  }
  await page.screenshot({ path: `${OUT}/full-s10-ai-typed.png`, fullPage: true });
  console.log('📸 full-s10-ai-typed.png | AI topic typed');

  // Click Generate/Improve with AI
  const aiBtn = page.getByRole('button', { name: /improve|generate/i });
  const aiBtnCount = await aiBtn.count();
  console.log('AI button count:', aiBtnCount);

  if (aiBtnCount > 0) {
    await aiBtn.last().click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${OUT}/full-s11-ai-loading.png`, fullPage: true });
    console.log('📸 full-s11-ai-loading.png | AI loading state');

    // Wait for result (up to 30s for Gemini)
    console.log('Waiting for AI response (up to 30s)...');
    await page.waitForTimeout(20000);
    await page.screenshot({ path: `${OUT}/full-s12-ai-result.png`, fullPage: true });
    const resultText = await page.textContent('body');
    console.log('📸 full-s12-ai-result.png | AI result/error state');
    console.log('   Has "Apply to Form":', resultText?.includes('Apply to Form'));
    console.log('   Has "Discard":', resultText?.includes('Discard'));
    console.log('   Has error indicator:', resultText?.includes('error') || resultText?.includes('Error'));

    // Try to apply result if available
    const applyBtn = page.getByRole('button', { name: /apply/i });
    if (await applyBtn.count() > 0) {
      await applyBtn.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: `${OUT}/full-s13-ai-applied.png`, fullPage: true });
      console.log('📸 full-s13-ai-applied.png | AI result applied to form');
    }
  }

  await browser.close();
  console.log('\n=== ALL STEPS COMPLETE ===');
})().catch(e => { console.error('SCRIPT FAILED:', e.message); process.exit(1); });
