import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const shots = path.resolve(
  '../sf-support/tests/e2e/screenshots',
);
const base = process.env.SF_WEB_URL || 'http://localhost:4200';

await mkdir(shots, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

await page.goto(`${base}/auth`, { waitUntil: 'domcontentloaded' });
await page.screenshot({ path: path.join(shots, '01-auth.png'), fullPage: true });

await page.locator('#email').fill('test@example.com');
await page.locator('#password').fill('Test123456!');
await page.getByRole('button', { name: 'Sign in' }).click();
await page.waitForURL((url) => !url.pathname.includes('/auth'), { timeout: 30000 });

await page.goto(`${base}/support`, { waitUntil: 'domcontentloaded' });
await page.getByTestId('support-query').waitFor({ timeout: 15000 });
await page.screenshot({ path: path.join(shots, '02-support-home.png'), fullPage: true });

await page.getByTestId('support-query').fill('How do credits work?');
await page.getByTestId('support-submit').click();
try {
  await page.getByTestId('support-ask-result').waitFor({ timeout: 20000 });
} catch {
  await page.screenshot({ path: path.join(shots, '03-ask-timeout.png'), fullPage: true });
  throw new Error('Ask result did not appear. Restart Firebase emulators to load new Firestore rules.');
}
await page.screenshot({ path: path.join(shots, '03-ask-result.png'), fullPage: true });

await page.getByTestId('support-category').selectOption('bug');
await page.getByRole('button', { name: 'Create ticket' }).waitFor();
await page.getByTestId('support-query').fill('The quiz submit button does nothing.');
await page.getByTestId('support-submit').click();
await page.getByTestId('support-ticket-list').waitFor({ timeout: 20000 });
await page.screenshot({ path: path.join(shots, '04-ticket-created.png'), fullPage: true });

await page.getByTestId('support-ticket-list').locator('a').first().click();
await page.getByTestId('support-thread').waitFor({ timeout: 15000 });
await page.screenshot({ path: path.join(shots, '05-ticket-thread.png'), fullPage: true });

await browser.close();
console.log(`Wrote screenshots to ${shots}`);
