/**
 * E2E test v2: Auth → Documents → Document Viewer → Generate Flashcards → Flashcards page
 *
 * Fixes over v1:
 * - waitForNavigation is initiated BEFORE the click that triggers navigation (no race condition)
 * - waitForResponse on the Firebase identitytoolkit endpoint so we know auth completed
 * - 'domcontentloaded' instead of 'networkidle' for goto() — Firebase SDK keeps persistent
 *   connections that prevent networkidle from ever resolving
 * - Browser console logs captured and printed throughout the test
 * - Generous timeouts tuned for emulator cold-start latency
 * - Screenshots saved to /tmp/openclaw/final-success.png and /tmp/openclaw/final-error.png
 *
 * Prerequisites:
 * - Web app running at http://localhost:4200
 * - Firebase emulators running (Auth:9099, Firestore:8080, Functions:5001, Storage:9199)
 * - Test user created: test@example.com / Test123456!
 * - At least one folder and one document exist in Firestore (dynamically selected)
 *
 * Run: npx tsx e2e/e2e-flashcards-test-v2.ts
 * Or:  npx playwright test e2e/e2e-flashcards-test-v2.ts --project=chromium
 */

import { chromium, Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

const BASE_URL = 'http://localhost:4200';
const SUCCESS_SCREENSHOT = '/tmp/openclaw/final-success.png';
const ERROR_SCREENSHOT = '/tmp/openclaw/final-error.png';

// Firebase Auth emulator sign-in endpoint pattern (signInWithPassword only)
const FIREBASE_AUTH_PATTERN =
  /identitytoolkit\.googleapis\.com\/v1\/accounts:signInWithPassword/;

function ensureDir(filePath: string) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function attachConsoleLogger(page: Page) {
  page.on('console', (msg) => {
    const type = msg.type();
    const text = msg.text();
    // Print browser console messages with a prefix so they are distinct
    console.log(`  [browser:${type}] ${text}`);
  });

  page.on('pageerror', (err) => {
    console.error(`  [browser:pageerror] ${err.message}`);
  });
}

async function runTest() {
  const browser = await chromium.launch({
    headless: true,
    // Slow down actions slightly so the app has time to react
    slowMo: 50,
  });

  const context = await browser.newContext();

  // Longer default navigation timeout for all operations
  context.setDefaultNavigationTimeout(60_000);
  // Increase default action timeout globally
  context.setDefaultTimeout(30_000);

  const page = await context.newPage();

  // Attach console log capture immediately so we never miss early messages
  attachConsoleLogger(page);

  try {
    // ── Step 1: Navigate to /auth ────────────────────────────────────────────
    console.log('\n[1] Navigating to /auth …');
    // Use 'domcontentloaded' instead of 'networkidle': the Firebase SDK holds
    // open WebSocket / long-poll connections that prevent networkidle from
    // resolving, causing a guaranteed timeout.
    await page.goto(`${BASE_URL}/auth`, { waitUntil: 'domcontentloaded' });
    console.log('    Page loaded:', page.url());

    // ── Step 2: Fill credentials ─────────────────────────────────────────────
    console.log('\n[2] Filling credentials …');
    await page.getByLabel(/email/i).fill('test@example.com');
    await page.getByLabel(/password/i).fill('Test123456!');

    // ── Step 3: Click Sign In — wait for Firebase auth response first ─────────
    // Register the waitForResponse listener BEFORE clicking so we never miss
    // the response if the emulator replies very fast.
    console.log('\n[3] Clicking Sign In and waiting for Firebase auth response …');
    const [authResponse] = await Promise.all([
      // Wait for the Firebase identitytoolkit sign-in response
      page.waitForResponse(
        (res) => FIREBASE_AUTH_PATTERN.test(res.url()) && res.status() === 200,
        { timeout: 30_000 },
      ),
      page.getByRole('button', { name: /sign in/i }).click(),
    ]);

    const authStatus = authResponse.status();
    console.log(`    Auth response status: ${authStatus} — ${authResponse.url()}`);

    if (authStatus !== 200) {
      const body = await authResponse.text().catch(() => '(unreadable)');
      throw new Error(`Firebase auth returned HTTP ${authStatus}: ${body}`);
    }

    // ── Step 4: Wait for the app to redirect post-login ──────────────────────
    // The React app sets auth state and navigates; give it up to 20 s.
    console.log('\n[4] Waiting for post-login redirect …');
    await page.waitForURL(
      (url) => !url.pathname.startsWith('/auth'),
      { timeout: 20_000 },
    );
    console.log('    Redirected to:', page.url());

    // ── Step 5: Ensure we are on /documents ──────────────────────────────────
    if (!page.url().includes('/documents')) {
      console.log('\n[5] Navigating explicitly to /documents …');
      await page.goto(`${BASE_URL}/documents`, { waitUntil: 'domcontentloaded' });
    } else {
      console.log('\n[5] Already on /documents.');
    }

    // Wait for at least one document or folder to be visible
    // The app renders folders as role="button" divs and documents in Card components.
    // Wait for either: a folder card (role button) or a document card heading to appear.
    console.log('\n[5a] Waiting for document/folder list to render …');
    await page.waitForSelector('h2, h3, [role="button"]', {
      state: 'visible',
      timeout: 20_000,
    });
    // Give the React state a moment to settle
    await page.waitForTimeout(1000);
    console.log('    Page content is visible.');

    // ── Step 6: Click first available folder ──────────────────────────────────
    // FolderCard renders as div with role="button" containing an h3 with the folder name
    const firstFolder = page.locator('[role="button"]').filter({ has: page.locator('h3') }).first();
    const folderCount = await firstFolder.count();
    if (folderCount > 0) {
      console.log('\n[6] Clicking first available folder …');
      await firstFolder.click({ timeout: 15_000 });
      // Wait for folder contents to load
      await page.waitForTimeout(1000);
    } else {
      console.log('\n[6] No folders at root, proceeding to documents …');
    }

    // ── Step 7: Click first available document (View button) ───────────────────
    console.log('\n[7] Clicking first available document (View button) …');
    await page.getByRole('button', { name: /view/i }).first().click({ timeout: 15_000 });

    // ── Step 8: Wait for document viewer page ────────────────────────────────
    console.log('\n[8] Waiting for document viewer page …');
    await page.waitForURL(/\/document\//, { timeout: 20_000 });
    // Wait for the page content to settle (not networkidle — see above)
    await page.waitForLoadState('domcontentloaded');
    console.log('    Document page loaded:', page.url());

    // ── Step 9: Open Actions menu ─────────────────────────────────────────────
    console.log('\n[9] Opening Actions menu …');
    await page.getByRole('button', { name: /actions/i }).click({ timeout: 15_000 });

    // ── Step 10: Click "Generate Flashcards" ───────────────────────────────────
    console.log('\n[10] Clicking "Generate Flashcards" …');
    await page.getByRole('menuitem', { name: /generate flashcards/i }).click({ timeout: 10_000 });

    // ── Step 11: Wait for the flashcards page (AI generation can be slow) ────
    // The app navigates to /flashcards/{flashcardSetId} after generation
    console.log('\n[11] Waiting for /flashcards page (up to 120 s for AI generation) …');
    await page.waitForURL(/\/flashcards\//, { timeout: 120_000 });
    await page.waitForLoadState('domcontentloaded');
    console.log('    Flashcards page loaded:', page.url());

    // ── Step 12: Success screenshot ───────────────────────────────────────────
    console.log('\n[12] Taking success screenshot …');
    ensureDir(SUCCESS_SCREENSHOT);
    await page.screenshot({ path: SUCCESS_SCREENSHOT, type: 'png', fullPage: true });
    console.log(`\n✅ Test passed! Screenshot saved to ${SUCCESS_SCREENSHOT}`);

  } catch (error) {
    console.error('\n❌ Test failed:', (error as Error).message);

    // Capture failure screenshot
    try {
      ensureDir(ERROR_SCREENSHOT);
      await page.screenshot({ path: ERROR_SCREENSHOT, type: 'png', fullPage: true });
      console.error(`   Failure screenshot saved to ${ERROR_SCREENSHOT}`);
    } catch (screenshotError) {
      console.error('   Could not capture failure screenshot:', screenshotError);
    }

    throw error;
  } finally {
    await browser.close();
  }
}

runTest().catch((err) => {
  console.error(err);
  process.exit(1);
});
