#!/usr/bin/env node
/**
 * E2E test data setup — single script that wires the full local environment.
 *
 * Steps performed:
 *   1. Create / update Auth user with a fixed UID in the Auth emulator
 *   2. Ensure Firestore user document exists
 *   3. Inject a root-level "Machine Learning" document into Firestore
 *   4. Upload the document content file to the Storage emulator
 *
 * Usage:
 *   npx tsx scripts/e2e-setup/setup-e2e-data.ts
 *
 * All emulator hosts default to localhost — override via env if needed:
 *   FIREBASE_AUTH_EMULATOR_HOST=localhost:9099
 *   FIRESTORE_EMULATOR_HOST=localhost:8080
 *   FIREBASE_STORAGE_EMULATOR_HOST=localhost:9199
 *
 * Prerequisites:
 *   - Firebase emulators running (Auth:9099, Firestore:8080, Storage:9199)
 */

import * as admin from 'firebase-admin';
import * as path from 'path';
import { config } from 'dotenv';

config({ path: path.join(process.cwd(), '.env.local') });

const PROJECT_ID = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || 'code-insights-quiz-ai';
const STORAGE_BUCKET = 'code-insights-quiz-ai.appspot.com';
const TARGET_UID = '4ZBsEPIUJ4jrlylcXkg7t3sFdPZv';
const TEST_EMAIL = 'test@example.com';
const TEST_PASSWORD = 'Test123456!';
const DOC_ID = 'perfect-doc-ml';

const DOCUMENT_CONTENT = `# Machine Learning

Machine learning is a subset of artificial intelligence that enables systems to learn and improve from experience without being explicitly programmed. It focuses on developing computer programs that can access data and use it to learn for themselves.

## Key Concepts

### Supervised Learning
In supervised learning, the algorithm learns from labeled training data. Common applications include:
- **Classification**: Categorizing emails as spam or not spam
- **Regression**: Predicting house prices based on features

### Unsupervised Learning
Unsupervised learning finds hidden patterns in data without labeled responses. Examples include:
- **Clustering**: Grouping customers by purchasing behavior
- **Dimensionality Reduction**: Reducing features for visualization

### Neural Networks
Neural networks are inspired by the human brain. They consist of layers of interconnected nodes that process information. Deep learning uses neural networks with many hidden layers to solve complex problems like image recognition and natural language processing.

## Applications

Machine learning powers many modern applications:
- Recommendation systems (Netflix, Spotify)
- Voice assistants (Siri, Alexa)
- Fraud detection in finance
- Medical diagnosis support
- Autonomous vehicles

## Summary

Machine learning continues to transform industries by enabling computers to learn from data and make intelligent decisions. Understanding its fundamentals is essential for anyone working in technology.
`;

async function main() {
  // --- Emulator hosts (must be set before admin.initializeApp) ---
  process.env.FIREBASE_AUTH_EMULATOR_HOST =
    process.env.FIREBASE_AUTH_EMULATOR_HOST || 'localhost:9099';
  process.env.FIRESTORE_EMULATOR_HOST =
    process.env.FIRESTORE_EMULATOR_HOST || 'localhost:8080';
  process.env.FIREBASE_STORAGE_EMULATOR_HOST =
    process.env.FIREBASE_STORAGE_EMULATOR_HOST || 'localhost:9199';

  console.log('Emulator hosts:');
  console.log(`  Auth:     ${process.env.FIREBASE_AUTH_EMULATOR_HOST}`);
  console.log(`  Firestore: ${process.env.FIRESTORE_EMULATOR_HOST}`);
  console.log(`  Storage:  ${process.env.FIREBASE_STORAGE_EMULATOR_HOST}`);

  if (admin.apps.length === 0) {
    admin.initializeApp({
      projectId: PROJECT_ID,
      storageBucket: STORAGE_BUCKET,
    });
  }

  const auth = admin.auth();
  const db = admin.firestore();
  const now = admin.firestore.Timestamp.now();

  // ── Step 1: Auth user ────────────────────────────────────────────────────
  console.log('\n[1] Setting up Auth user …');

  // Remove any existing user with the same email but a different UID
  try {
    const existingByEmail = await auth.getUserByEmail(TEST_EMAIL);
    if (existingByEmail.uid !== TARGET_UID) {
      console.log(`   Deleting existing user ${existingByEmail.uid} (wrong UID) …`);
      await auth.deleteUser(existingByEmail.uid);
    }
  } catch {
    // No user with that email — fine
  }

  // Create or update the user with the target UID
  try {
    await auth.getUser(TARGET_UID);
    await auth.updateUser(TARGET_UID, {
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      emailVerified: true,
    });
    console.log(`   ✅ Auth user updated: ${TEST_EMAIL} (UID: ${TARGET_UID})`);
  } catch {
    await auth.createUser({
      uid: TARGET_UID,
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      emailVerified: true,
    });
    console.log(`   ✅ Auth user created: ${TEST_EMAIL} (UID: ${TARGET_UID})`);
  }

  // ── Step 2: Firestore user document ─────────────────────────────────────
  console.log('\n[2] Ensuring Firestore user document …');
  await db.doc(`users/${TARGET_UID}`).set(
    { email: TEST_EMAIL, createdAt: now },
    { merge: true }
  );
  console.log('   ✅ User document ready');

  // ── Step 3: Firestore document metadata ─────────────────────────────────
  console.log('\n[3] Injecting document into Firestore …');
  console.log(`   User: ${TARGET_UID}`);
  console.log(`   Document ID: ${DOC_ID}`);

  // Root-level document: directoryId must be null so getDirectoryContents(null)
  // picks it up when listing the root.
  const docData = {
    id: DOC_ID,
    userId: TARGET_UID,
    directoryId: null as string | null,
    title: 'Machine Learning',
    description: 'A comprehensive introduction to machine learning concepts and applications.',
    sourceType: 'generated',
    status: 'active',
    wordCount: DOCUMENT_CONTENT.split(/\s+/).length,
    storagePath: `users/${TARGET_UID}/documents/${DOC_ID}/content.md`,
    storageUrl: `http://${process.env.FIREBASE_STORAGE_EMULATOR_HOST}/v0/b/${STORAGE_BUCKET}/o/users%2F${encodeURIComponent(TARGET_UID)}%2Fdocuments%2F${DOC_ID}%2Fcontent.md?alt=media`,
    tags: ['machine-learning', 'AI', 'neural-networks'],
    createdAt: now,
    updatedAt: now,
  };

  await db.doc(`users/${TARGET_UID}/documents/${DOC_ID}`).set(docData);
  console.log('   ✅ Document metadata written');

  // ── Step 4: Storage content file ────────────────────────────────────────
  console.log('\n[4] Uploading content to Storage emulator …');
  const filePath = `users/${TARGET_UID}/documents/${DOC_ID}/content.md`;
  const file = admin.storage().bucket(STORAGE_BUCKET).file(filePath);

  await file.save(Buffer.from(DOCUMENT_CONTENT, 'utf8'), {
    metadata: { contentType: 'text/markdown; charset=utf-8' },
    resumable: false,
  });
  console.log(`   ✅ Content uploaded to: ${filePath}`);

  console.log('\n✅ E2E setup complete. Ready to run tests.');
}

main().catch((err) => {
  console.error('\n❌ Setup failed:', err);
  process.exit(1);
});
