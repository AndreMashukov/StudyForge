
import { chromium } from 'playwright';

const BASE_URL = 'http://localhost:4200';

(async () => {
  console.log('Starting browser...');
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  try {
    console.log('Logging in...');
    await page.goto(`${BASE_URL}/auth`);
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'Test123456!');
    await page.click('button[type="submit"]');
    await page.waitForURL(`${BASE_URL}/`);
    console.log('Logged in! URL:', page.url());

    await page.goto(`${BASE_URL}/flashcards/create?documentId=perfect-doc-ml`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    await page.screenshot({ path: '/a0/usr/workdir/multi_doc_flashcard.png' });
    console.log('Flashcard screenshot saved');

    await page.goto(`${BASE_URL}/quiz/create?documentId=perfect-doc-ml`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    await page.screenshot({ path: '/a0/usr/workdir/multi_doc_quiz.png' });
    console.log('Quiz screenshot saved');

    await page.goto(`${BASE_URL}/slides/create?documentId=perfect-doc-ml`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    await page.screenshot({ path: '/a0/usr/workdir/multi_doc_slides.png' });
    console.log('Slides screenshot saved');

  } catch (err) {
    console.error('Error:', err);
    await page.screenshot({ path: '/a0/usr/workdir/multi_doc_error.png' });
  } finally {
    await browser.close();
    console.log('Done!');
  }
})();
