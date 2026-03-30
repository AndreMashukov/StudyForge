import { chromium } from '@playwright/test';

(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();

  // Login
  await page.goto('http://localhost:4200/auth', { waitUntil: 'networkidle' });
  await page.locator('input[type="email"]').fill('test@example.com');
  await page.locator('input[type="password"]').fill('Test123456!');
  await page.getByRole('button').filter({ hasText: /sign in|log in|login/i }).first().click();
  await page.waitForTimeout(3000);

  // Navigate to directory
  await page.goto('http://localhost:4200/directory/e2e-study-materials', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);

  // Full page screenshot
  await page.screenshot({ path: '/a0/usr/workdir/app-directory-full-page.png', fullPage: true });
  console.log('Full page screenshot saved');

  // Scroll to Artifacts section
  const artH2 = page.locator('h2:has-text("Artifacts")').first();
  if (await artH2.isVisible().catch(() => false)) {
    await artH2.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    await page.screenshot({ path: '/a0/usr/workdir/app-artifacts-section.png' });
    console.log('Artifacts section screenshot saved');

    // Hover over first quiz artifact
    const quizLink = page.locator('a[href*="/quiz/test-"]').first();
    if (await quizLink.count() > 0) {
      const parentDiv = quizLink.locator('xpath=..');
      await parentDiv.hover({ force: true });
      await page.waitForTimeout(500);
      await page.screenshot({ path: '/a0/usr/workdir/app-artifact-hover-delete.png' });
      console.log('Hover screenshot saved');

      // Click delete button
      const deleteBtn = parentDiv.locator('button[aria-label*="Delete"]');
      if (await deleteBtn.isVisible()) {
        await deleteBtn.click();
        await page.waitForTimeout(1000);
        await page.screenshot({ path: '/a0/usr/workdir/app-delete-dialog.png' });
        console.log('Delete dialog screenshot saved');
      }
    }
  }

  console.log('Done!');
  await browser.close();
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
