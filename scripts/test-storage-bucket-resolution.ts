#!/usr/bin/env node
/**
 * Test getDocumentContent against PRODUCTION.
 *
 * Usage:
 *   AUTH_TOKEN=<your-firebase-id-token> DOCUMENT_ID=GAtlDTPqTjwpDQZ7CEz3 npx tsx scripts/test-storage-bucket-resolution.ts
 *
 * Get AUTH_TOKEN: Log in at https://code-insights-quiz-ai.web.app, open DevTools Console, run:
 *   (await firebase.auth().currentUser?.getIdToken()) || 'NOT_LOGGED_IN'
 * Or use: firebase.auth().currentUser.getIdToken().then(t => console.log(t))
 */

const PROD_URL = 'https://asia-east1-code-insights-quiz-ai.cloudfunctions.net/getDocumentContent';
const DOCUMENT_ID = process.env.DOCUMENT_ID || 'GAtlDTPqTjwpDQZ7CEz3';
const AUTH_TOKEN = process.env.AUTH_TOKEN;

async function main() {
  if (!AUTH_TOKEN || AUTH_TOKEN === 'NOT_LOGGED_IN') {
    console.error('\n❌ AUTH_TOKEN required. Get it from the browser console while logged in at code-insights-quiz-ai.web.app:');
    console.error('   (await firebase.auth().currentUser?.getIdToken()) || "NOT_LOGGED_IN"\n');
    process.exit(1);
  }

  console.log('\nTesting getDocumentContent against PRODUCTION...');
  console.log('  URL:', PROD_URL);
  console.log('  Document ID:', DOCUMENT_ID);

  const res = await fetch(PROD_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${AUTH_TOKEN}`,
    },
    body: JSON.stringify({ data: { documentId: DOCUMENT_ID } }),
  });

  const json = (await res.json()) as {
    result?: { success?: boolean; content?: string };
    error?: { message?: string; status?: string };
  };

  if (json.error) {
    console.error('\n❌ FAILED:', json.error.status || 'ERROR', json.error.message || JSON.stringify(json.error));
    process.exit(1);
  }

  if (json.result?.success && json.result?.content) {
    const len = json.result.content.length;
    const preview = json.result.content.slice(0, 80).replace(/\n/g, ' ');
    console.log('\n✅ SUCCESS');
    console.log('  Content length:', len);
    console.log('  Preview:', preview + (len > 80 ? '...' : ''));
    process.exit(0);
  }

  console.error('\n❌ Unexpected response:', JSON.stringify(json, null, 2));
  process.exit(1);
}

main().catch((err) => {
  console.error('\n❌ Error:', err.message);
  process.exit(1);
});
