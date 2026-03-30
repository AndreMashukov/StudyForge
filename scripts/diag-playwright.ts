import { chromium } from '@playwright/test';

(async () => {
  console.log('Launching browser...');
  const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  console.log('Browser launched!');
  const page = await browser.newPage();
  await page.goto('http://localhost:4200');
  console.log('URL:', page.url());
  await page.screenshot({ path: '/a0/usr/workdir/diag-test.png' });
  console.log('Screenshot saved!');
  await browser.close();
  console.log('DONE');
})().catch(err => { console.error('ERROR:', err.message); process.exit(1); });
