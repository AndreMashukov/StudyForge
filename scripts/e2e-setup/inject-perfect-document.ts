#!/usr/bin/env node
/**
 * Inject a perfectly valid document for E2E testing.
 *
 * Connects to local Firebase emulators and injects:
 * 1. A document in Firestore: users/{userId}/documents/{docId}
 *    - userId: 4ZBsEPIUJ4jrlylcXkg7t3sFdPZv
 *    - directoryId: "root" (root-level document)
 *    - title: "Machine Learning"
 *    - Valid content reference
 * 2. The document content file in Storage emulator
 *
 * Usage:
 *   FIRESTORE_EMULATOR_HOST=localhost:8080 \
 *   FIREBASE_STORAGE_EMULATOR_HOST=localhost:9199 \
 *   npx tsx scripts/e2e-setup/inject-perfect-document.ts
 *
 * Prerequisites:
 *   - Firebase emulators running (Firestore:8080, Storage:9199)
 *   - User 4ZBsEPIUJ4jrlylcXkg7t3sFdPZv exists in Auth emulator (create via create-specific-user.ts)
 */

import * as admin from 'firebase-admin';
import * as path from 'path';
import { config } from 'dotenv';

config({ path: path.join(process.cwd(), '.env.local') });

const PROJECT_ID = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || 'code-insights-quiz-ai';
const STORAGE_BUCKET = 'code-insights-quiz-ai.appspot.com';
const TARGET_UID = '4ZBsEPIUJ4jrlylcXkg7t3sFdPZv';
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
  process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || 'localhost:8080';
  process.env.FIREBASE_STORAGE_EMULATOR_HOST =
    process.env.FIREBASE_STORAGE_EMULATOR_HOST || 'localhost:9199';

  if (admin.apps.length === 0) {
    admin.initializeApp({
      projectId: PROJECT_ID,
      storageBucket: STORAGE_BUCKET,
    });
  }

  const db = admin.firestore();
  const now = admin.firestore.Timestamp.now();

  console.log('\n[1] Ensuring user document exists …');
  await db.doc(`users/${TARGET_UID}`).set(
    { email: 'test@example.com', createdAt: now },
    { merge: true }
  );
  console.log('   ✅ User document ready');

  console.log('\n[2] Injecting document into Firestore …');
  console.log(`   User: ${TARGET_UID}`);
  console.log(`   Document ID: ${DOC_ID}`);

  // Root-level document: directoryId must be null (getDirectoryContents(null) queries
  // documents where directoryId == null). Task spec "root" = root level.
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
  console.log('   ✅ Document created in Firestore');

  console.log('\n[3] Uploading content to Storage emulator …');
  const bucket = admin.storage().bucket(STORAGE_BUCKET);
  const filePath = `users/${TARGET_UID}/documents/${DOC_ID}/content.md`;
  const file = bucket.file(filePath);

  await file.save(Buffer.from(DOCUMENT_CONTENT, 'utf8'), {
    metadata: {
      contentType: 'text/markdown; charset=utf-8',
    },
    resumable: false,
  });

  console.log(`   ✅ Content uploaded to: ${filePath}`);
  console.log(`\n✅ Inject complete! Document ready for E2E test.`);
}

main().catch((err) => {
  console.error('\n❌ Inject failed:', err);
  process.exit(1);
});
