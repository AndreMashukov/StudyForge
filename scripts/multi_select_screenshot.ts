
import { chromium } from 'playwright';

const BASE_URL = 'http://localhost:4200';

(async () => {
  console.log('Starting browser...');
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  try {
    // Login
    console.log('Logging in...');
    await page.goto(`${BASE_URL}/auth`);
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'Test123456!');
    await page.click('button[type="submit"]');
    await page.waitForURL(`${BASE_URL}/`);
    console.log('Logged in!');

    // Navigate to flashcard create with pre-selected doc
    await page.goto(`${BASE_URL}/flashcards/create?documentId=perfect-doc-ml`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    console.log('Page loaded, taking initial screenshot...');
    await page.screenshot({ path: '/a0/usr/workdir/multi_select_1_initial.png' });

    // Click "+ Add more documents" button
    console.log('Looking for Add more documents button...');
    const addBtn = page.getByRole('button', { name: /add more documents/i })
      .or(page.locator('button:has-text("Add more")'))
      .or(page.locator('[data-testid="add-more-documents"]'))
      .first();

    if (await addBtn.isVisible()) {
      await addBtn.click();
      console.log('Clicked Add more documents');
      await page.waitForTimeout(1500);
      await page.screenshot({ path: '/a0/usr/workdir/multi_select_2_list_expanded.png' });
      console.log('List expanded screenshot saved');

      // Try to select Ruby vs JavaScript doc
      const rubyDoc = page.getByText('Ruby vs JavaScript').first();
      if (await rubyDoc.isVisible()) {
        await rubyDoc.click();
        await page.waitForTimeout(1500);
        console.log('Selected Ruby vs JavaScript');
        await page.screenshot({ path: '/a0/usr/workdir/multi_select_3_two_docs.png' });
        console.log('Two docs selected screenshot saved');

        // Also add System Design
        const addBtn2 = page.getByRole('button', { name: /add more documents/i }).first();
        if (await addBtn2.isVisible()) {
          await addBtn2.click();
          await page.waitForTimeout(1000);
          const sysDoc = page.getByText('System Design Fundamentals').first();
          if (await sysDoc.isVisible()) {
            await sysDoc.click();
            await page.waitForTimeout(1500);
            console.log('Selected System Design Fundamentals');
            await page.screenshot({ path: '/a0/usr/workdir/multi_select_4_three_docs.png' });
            console.log('Three docs selected screenshot saved');
          }
        }
      } else {
        console.log('Ruby doc not visible - taking screenshot of current state');
        await page.screenshot({ path: '/a0/usr/workdir/multi_select_debug.png' });
      }
    } else {
      console.log('Add more button not found - current page state:');
      console.log(await page.content().then(c => c.substring(0, 500)));
      await page.screenshot({ path: '/a0/usr/workdir/multi_select_debug.png' });
    }

  } catch (err) {
    console.error('Error:', err);
    await page.screenshot({ path: '/a0/usr/workdir/multi_select_error.png' });
  } finally {
    await browser.close();
    console.log('Done!');
  }
})();
