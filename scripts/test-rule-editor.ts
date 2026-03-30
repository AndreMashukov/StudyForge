import { chromium } from '@playwright/test';

(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Step 1: Login
    console.log('Step 1: Navigating to auth...');
    await page.goto('http://localhost:4200/auth', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    const emailInput = page.getByLabel('Email').or(page.locator('input[type="email"]')).or(page.locator('input[name="email"]'));
    const passwordInput = page.getByLabel('Password').or(page.locator('input[type="password"]')).or(page.locator('input[name="password"]'));

    await emailInput.fill('test@example.com');
    await passwordInput.fill('Test123456!');
    console.log('Step 1: Filled credentials');

    const signInBtn = page.getByRole('button', { name: /sign in|login|log in/i });
    await signInBtn.click();
    console.log('Step 1: Clicked sign in');

    await page.waitForTimeout(4000);
    console.log('Step 1: Logged in, URL:', page.url());

    // Step 2: Navigate to Rule Editor create mode
    console.log('Step 2: Navigating to /rules/editor...');
    await page.goto('http://localhost:4200/rules/editor', { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);
    console.log('Step 2: URL:', page.url());

    // Screenshot create mode
    await page.screenshot({ path: '/a0/usr/workdir/rule-editor-test-1-create.png', fullPage: true });
    console.log('Step 2: Screenshot saved (create mode)');

    // Check for errors
    const errorText = await page.locator('text=Something went wrong').count();
    const pageContent = await page.textContent('body');
    console.log('Step 2: Error count:', errorText);
    console.log('Step 2: Page has "Create Rule":', pageContent?.includes('Create Rule'));
    console.log('Step 2: Page has "AI Assistant":', pageContent?.includes('AI Assistant'));
    console.log('Step 2: Page has "Back to Rules":', pageContent?.includes('Back to Rules'));

    // Step 3: Navigate to Rules page and check create button
    console.log('Step 3: Navigating to /rules...');
    await page.goto('http://localhost:4200/rules', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: '/a0/usr/workdir/rule-editor-test-2-rules-list.png', fullPage: true });
    console.log('Step 3: Screenshot saved (rules list)');

    // Check create button exists
    const createBtn = page.getByRole('button', { name: /create/i });
    const createBtnCount = await createBtn.count();
    console.log('Step 3: Create button count:', createBtnCount);

    console.log('\n=== ALL TESTS COMPLETE ===');
  } catch (err) {
    console.error('ERROR:', err);
    await page.screenshot({ path: '/a0/usr/workdir/rule-editor-test-error.png', fullPage: true });
  } finally {
    await browser.close();
  }
})();
