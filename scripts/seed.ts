#!/usr/bin/env node
/**
 * Unified emulator seed script.
 *
 * Runs after Firebase emulators are already up (use `emulators:dev` npm script
 * to start emulators + seed in one step).
 *
 * What it seeds:
 *   1. Auth  — creates test@example.com with a fixed UID
 *   2. Firestore — injects a "Machine Learning" document for that user
 *   3. Storage  — uploads the document's markdown content file
 *
 * Usage (manual, emulators already running):
 *   FIRESTORE_EMULATOR_HOST=localhost:8080 \
 *   FIREBASE_AUTH_EMULATOR_HOST=localhost:9099 \
 *   FIREBASE_STORAGE_EMULATOR_HOST=localhost:9199 \
 *   npx tsx scripts/seed.ts
 *
 * Or via npm script (starts emulators + waits + seeds automatically):
 *   yarn emulators:dev
 */

import * as admin from 'firebase-admin';

// ── Config ────────────────────────────────────────────────────────────────────

const PROJECT_ID = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || 'code-insights-quiz-ai';
const STORAGE_BUCKET = 'code-insights-quiz-ai.appspot.com';
const TARGET_UID = '4ZBsEPIUJ4jrlylcXkg7t3sFdPZv';
const TEST_EMAIL = 'test@example.com';
const TEST_PASSWORD = 'Test123456!';
const DOC_ID = 'perfect-doc-ml';

// ── Emulator env vars (set defaults so the script works without prefix) ───────

process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || 'localhost:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST =
  process.env.FIREBASE_AUTH_EMULATOR_HOST || 'localhost:9099';
process.env.FIREBASE_STORAGE_EMULATOR_HOST =
  process.env.FIREBASE_STORAGE_EMULATOR_HOST || 'localhost:9199';

// ── Document content ──────────────────────────────────────────────────────────

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

// ── Helpers ───────────────────────────────────────────────────────────────────

function initAdmin() {
  if (admin.apps.length === 0) {
    admin.initializeApp({ projectId: PROJECT_ID, storageBucket: STORAGE_BUCKET });
  }
}

async function seedAuth() {
  console.log('\n[Auth] Seeding user …');
  const auth = admin.auth();

  // Remove any existing user with the same email but wrong UID
  try {
    const existing = await auth.getUserByEmail(TEST_EMAIL);
    if (existing.uid !== TARGET_UID) {
      await auth.deleteUser(existing.uid);
      console.log(`  Deleted stale user ${existing.uid}`);
    }
  } catch {
    // User not found by email — fine
  }

  // Create (or update) user with the fixed UID
  try {
    await auth.getUser(TARGET_UID);
    await auth.updateUser(TARGET_UID, {
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      emailVerified: true,
    });
    console.log(`  ✅ User updated: ${TEST_EMAIL} (uid: ${TARGET_UID})`);
  } catch {
    await auth.createUser({
      uid: TARGET_UID,
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      emailVerified: true,
    });
    console.log(`  ✅ User created: ${TEST_EMAIL} (uid: ${TARGET_UID})`);
  }
}

async function seedFirestore() {
  console.log('\n[Firestore] Injecting document …');
  const db = admin.firestore();
  const now = admin.firestore.Timestamp.now();

  // Ensure user record exists
  await db.doc(`users/${TARGET_UID}`).set({ email: TEST_EMAIL, createdAt: now }, { merge: true });

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
  console.log(`  ✅ Document "${DOC_ID}" created`);
}

async function seedStorage() {
  console.log('\n[Storage] Uploading content file …');
  const bucket = admin.storage().bucket(STORAGE_BUCKET);
  const filePath = `users/${TARGET_UID}/documents/${DOC_ID}/content.md`;

  await bucket.file(filePath).save(Buffer.from(DOCUMENT_CONTENT, 'utf8'), {
    metadata: { contentType: 'text/markdown; charset=utf-8' },
    resumable: false,
  });

  console.log(`  ✅ Uploaded: ${filePath}`);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🌱 Seeding Firebase emulators …');
  console.log(`   Firestore : ${process.env.FIRESTORE_EMULATOR_HOST}`);
  console.log(`   Auth      : ${process.env.FIREBASE_AUTH_EMULATOR_HOST}`);
  console.log(`   Storage   : ${process.env.FIREBASE_STORAGE_EMULATOR_HOST}`);

  initAdmin();
  await seedAuth();
  await seedFirestore();
  await seedStorage();

  console.log('\n✅ Seed complete!\n');
}

main().catch((err) => {
  console.error('\n❌ Seed failed:', err);
  process.exit(1);
});
