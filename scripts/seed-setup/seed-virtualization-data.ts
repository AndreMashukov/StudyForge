#!/usr/bin/env node
/**
 * Bulk seed for list-virtualization QA.
 *
 * Run after setup-seed-data.ts with emulators already up:
 *   npx tsx scripts/seed-setup/seed-virtualization-data.ts
 *
 * Creates enough rows to exercise scrolling, row virtualization, and
 * document cursor pagination (page size 100):
 *   - 120 extra documents in Study Materials
 *   - 40 rules
 *   - 45 quizzes / flashcard sets / slide decks (+ directory item index)
 *   - 8 API keys (under the 10-key cap)
 */

import * as admin from 'firebase-admin';
import * as crypto from 'crypto';
import * as path from 'path';
import { config } from 'dotenv';
import {
  buildHtmlStoragePath,
  buildHtmlStorageUrl,
  markdownToHtmlDocument,
} from './seed-html-utils';

config({ path: path.join(process.cwd(), '.env.local') });

const PROJECT_ID = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || 'study-forge-202604';
const STORAGE_BUCKET = 'study-forge-202604.appspot.com';
const TARGET_UID = '4ZBsEPIUJ4jrlylcXkg7t3sFdPZv';
const DIR_ID = 'e2estudymaterials';
const SOURCE_DOC_ID = 'perfect-doc-ml';

const EXTRA_DOC_COUNT = 120;
const RULE_COUNT = 40;
const QUIZ_COUNT = 45;
const FLASHCARD_COUNT = 45;
const SLIDE_COUNT = 45;
const API_KEY_COUNT = 8;
const BATCH_LIMIT = 400;

const TOPICS = [
  'Algorithms',
  'Data Structures',
  'Networking',
  'Databases',
  'Operating Systems',
  'Distributed Systems',
  'Security',
  'Cloud Computing',
  'Frontend',
  'Backend',
  'DevOps',
  'Testing',
];

function buildDocContent(title: string, index: number): string {
  return `# ${title}

This is seeded study content #${index} for virtualization testing.

## Overview
${title} covers foundational ideas used in software engineering interviews and production systems.

## Key Points
- Concept A for ${title}
- Concept B for ${title}
- Concept C for ${title}

## Summary
Use this document as filler content so list virtualization and cursor pagination can be exercised locally.
`;
}

async function commitInBatches(
  db: admin.firestore.Firestore,
  writers: Array<(batch: admin.firestore.WriteBatch) => void>,
): Promise<void> {
  for (let i = 0; i < writers.length; i += BATCH_LIMIT) {
    const batch = db.batch();
    for (const write of writers.slice(i, i + BATCH_LIMIT)) {
      write(batch);
    }
    await batch.commit();
  }
}

async function main() {
  process.env.FIREBASE_AUTH_EMULATOR_HOST =
    process.env.FIREBASE_AUTH_EMULATOR_HOST || 'localhost:9099';
  process.env.FIRESTORE_EMULATOR_HOST =
    process.env.FIRESTORE_EMULATOR_HOST || 'localhost:8080';
  process.env.FIREBASE_STORAGE_EMULATOR_HOST =
    process.env.FIREBASE_STORAGE_EMULATOR_HOST || 'localhost:9199';

  if (admin.apps.length === 0) {
    admin.initializeApp({
      projectId: PROJECT_ID,
      storageBucket: STORAGE_BUCKET,
    });
  }

  const db = admin.firestore();
  const bucket = admin.storage().bucket(STORAGE_BUCKET);
  const now = admin.firestore.Timestamp.now();
  const storageHost = process.env.FIREBASE_STORAGE_EMULATOR_HOST || 'localhost:9199';

  const dirRef = db.doc(`users/${TARGET_UID}/directories/${DIR_ID}`);
  const dirSnap = await dirRef.get();
  if (!dirSnap.exists) {
    throw new Error(
      `Directory ${DIR_ID} not found. Run setup-seed-data.ts first.`,
    );
  }

  console.log('\n[1] Seeding bulk documents …');
  const documentWriters: Array<(batch: admin.firestore.WriteBatch) => void> = [];
  const storageUploads: Array<{ path: string; content: string }> = [];

  for (let i = 1; i <= EXTRA_DOC_COUNT; i++) {
    const topic = TOPICS[(i - 1) % TOPICS.length];
    const id = `bulk-doc-${String(i).padStart(3, '0')}`;
    const title = `${topic} Notes ${i}`;
    const content = buildDocContent(title, i);
    const htmlContent = markdownToHtmlDocument(content, title);
    const wordCount = content.split(/\s+/).length;
    const storagePath = buildHtmlStoragePath(TARGET_UID, id);
    const storageUrl = buildHtmlStorageUrl(TARGET_UID, id, storageHost, STORAGE_BUCKET);

    documentWriters.push((batch) => {
      batch.set(db.doc(`users/${TARGET_UID}/documents/${id}`), {
        id,
        userId: TARGET_UID,
        directoryId: DIR_ID,
        title,
        description: `Seeded ${topic.toLowerCase()} study notes for virtualization QA.`,
        sourceType: 'generated',
        status: 'active',
        wordCount,
        contentFormat: 'html',
        storagePath,
        storageUrl,
        tags: [topic.toLowerCase().replace(/\s+/g, '-'), 'bulk-seed', 'virtualization'],
        createdAt: now,
        updatedAt: now,
      });
      batch.set(db.doc(`users/${TARGET_UID}/directories/${DIR_ID}/items/document_${id}`), {
        id: `document_${id}`,
        sourceId: id,
        directoryId: DIR_ID,
        itemType: 'document',
        title,
        createdAt: now,
        updatedAt: now,
        wordCount,
      });
    });

    storageUploads.push({ path: storagePath, content: htmlContent });
  }

  await commitInBatches(db, documentWriters);
  console.log(`   ✅ ${EXTRA_DOC_COUNT} document metadata + index rows written`);

  console.log('\n[2] Uploading document content to Storage …');
  const uploadChunk = 20;
  for (let i = 0; i < storageUploads.length; i += uploadChunk) {
    const slice = storageUploads.slice(i, i + uploadChunk);
    await Promise.all(
      slice.map(async (file) => {
        await bucket.file(file.path).save(Buffer.from(file.content, 'utf8'), {
          metadata: { contentType: 'text/html; charset=utf-8' },
          resumable: false,
        });
      }),
    );
    process.stdout.write(`   … ${Math.min(i + uploadChunk, storageUploads.length)}/${storageUploads.length}\r`);
  }
  console.log(`\n   ✅ ${storageUploads.length} content files uploaded`);

  console.log('\n[3] Seeding rules …');
  const ruleWriters: Array<(batch: admin.firestore.WriteBatch) => void> = [];
  const ruleIds: string[] = [];
  for (let i = 1; i <= RULE_COUNT; i++) {
    const id = `bulk-rule-${String(i).padStart(3, '0')}`;
    ruleIds.push(id);
    ruleWriters.push((batch) => {
      batch.set(db.doc(`users/${TARGET_UID}/rules/${id}`), {
        id,
        userId: TARGET_UID,
        name: `Bulk Rule ${i}`,
        description: `Seeded prompt rule #${i} for virtualization QA.`,
        content: `When generating content, emphasize clarity and include one concrete example related to topic slot ${i}.`,
        color: ['blue', 'green', 'purple', 'orange', 'red'][(i - 1) % 5],
        tags: ['bulk-seed', i % 2 === 0 ? 'quiz' : 'prompt'],
        applicableTo: ['prompt', 'quiz', 'flashcard', 'slide_deck'],
        isDefault: false,
        directoryIds: i <= 5 ? [DIR_ID] : [],
        createdAt: now,
        updatedAt: now,
      });
    });
  }
  await commitInBatches(db, ruleWriters);
  console.log(`   ✅ ${RULE_COUNT} rules written`);

  console.log('\n[4] Seeding artifacts + directory item index …');
  const artifactWriters: Array<(batch: admin.firestore.WriteBatch) => void> = [];

  for (let i = 1; i <= QUIZ_COUNT; i++) {
    const id = `bulk-quiz-${String(i).padStart(3, '0')}`;
    artifactWriters.push((batch) => {
      batch.set(db.doc(`users/${TARGET_UID}/quizzes/${id}`), {
        id,
        documentId: SOURCE_DOC_ID,
        documentIds: [SOURCE_DOC_ID],
        title: `Bulk Quiz ${i}`,
        questions: [
          {
            question: `What is the main idea of topic ${i}?`,
            options: ['Option A', 'Option B', 'Option C', 'Option D'],
            correctAnswer: 0,
            explanation: 'Seeded explanation for virtualization QA.',
          },
        ],
        createdAt: now,
        userId: TARGET_UID,
        directoryId: DIR_ID,
        generationAttempt: 1,
        documentTitle: 'Machine Learning',
        generationStatus: 'completed',
      });
      batch.set(db.doc(`users/${TARGET_UID}/directories/${DIR_ID}/items/quiz_${id}`), {
        id: `quiz_${id}`,
        sourceId: id,
        directoryId: DIR_ID,
        itemType: 'quiz',
        title: `Bulk Quiz ${i}`,
        createdAt: now,
        updatedAt: now,
        generationStatus: 'completed',
      });
    });
  }

  for (let i = 1; i <= FLASHCARD_COUNT; i++) {
    const id = `bulk-flashcard-${String(i).padStart(3, '0')}`;
    artifactWriters.push((batch) => {
      batch.set(db.doc(`users/${TARGET_UID}/flashcardSets/${id}`), {
        id,
        documentId: SOURCE_DOC_ID,
        documentIds: [SOURCE_DOC_ID],
        title: `Bulk Flashcards ${i}`,
        cards: [
          { front: `Term ${i}`, back: `Definition ${i}` },
          { front: `Concept ${i}`, back: `Explanation ${i}` },
        ],
        createdAt: now,
        userId: TARGET_UID,
        directoryId: DIR_ID,
        documentTitle: 'Machine Learning',
        generationStatus: 'completed',
      });
      batch.set(db.doc(`users/${TARGET_UID}/directories/${DIR_ID}/items/flashcard_${id}`), {
        id: `flashcard_${id}`,
        sourceId: id,
        directoryId: DIR_ID,
        itemType: 'flashcard',
        title: `Bulk Flashcards ${i}`,
        createdAt: now,
        updatedAt: now,
        generationStatus: 'completed',
      });
    });
  }

  for (let i = 1; i <= SLIDE_COUNT; i++) {
    const id = `bulk-slides-${String(i).padStart(3, '0')}`;
    artifactWriters.push((batch) => {
      batch.set(db.doc(`users/${TARGET_UID}/slideDecks/${id}`), {
        id,
        documentId: SOURCE_DOC_ID,
        documentIds: [SOURCE_DOC_ID],
        title: `Bulk Slides ${i}`,
        slides: [
          { title: `Intro ${i}`, content: `Overview of topic ${i}`, order: 1 },
          { title: `Details ${i}`, content: `Details for topic ${i}`, order: 2 },
        ],
        createdAt: now,
        userId: TARGET_UID,
        directoryId: DIR_ID,
        documentTitle: 'Machine Learning',
        generationStatus: 'completed',
      });
      batch.set(db.doc(`users/${TARGET_UID}/directories/${DIR_ID}/items/slideDeck_${id}`), {
        id: `slideDeck_${id}`,
        sourceId: id,
        directoryId: DIR_ID,
        itemType: 'slideDeck',
        title: `Bulk Slides ${i}`,
        createdAt: now,
        updatedAt: now,
        generationStatus: 'completed',
      });
    });
  }

  await commitInBatches(db, artifactWriters);
  console.log(
    `   ✅ ${QUIZ_COUNT} quizzes, ${FLASHCARD_COUNT} flashcard sets, ${SLIDE_COUNT} slide decks`,
  );

  console.log('\n[5] Seeding API keys …');
  const apiKeyWriters: Array<(batch: admin.firestore.WriteBatch) => void> = [];
  for (let i = 1; i <= API_KEY_COUNT; i++) {
    const id = `bulk-apikey-${String(i).padStart(2, '0')}`;
    const rawKey = `sf-${crypto.randomBytes(32).toString('hex')}`;
    apiKeyWriters.push((batch) => {
      batch.set(db.doc(`users/${TARGET_UID}/apiKeys/${id}`), {
        name: `Bulk Key ${i}`,
        keyHash: crypto.createHash('sha256').update(rawKey).digest('hex'),
        keyPrefix: rawKey.slice(0, 12),
        createdAt: now.toDate(),
        lastUsedAt: null,
        active: true,
      });
    });
  }
  await commitInBatches(db, apiKeyWriters);
  console.log(`   ✅ ${API_KEY_COUNT} API keys written`);

  console.log('\n[6] Updating directory counts …');
  const baseDocCount = 4; // from setup-seed-data.ts
  await dirRef.set(
    {
      documentCount: baseDocCount + EXTRA_DOC_COUNT,
      quizCount: QUIZ_COUNT,
      flashcardSetCount: FLASHCARD_COUNT,
      slideDeckCount: SLIDE_COUNT,
      ruleIds: admin.firestore.FieldValue.arrayUnion(...ruleIds.slice(0, 5)),
      updatedAt: now,
    },
    { merge: true },
  );
  console.log('   ✅ Directory counters updated');

  console.log('\n✅ Virtualization seed complete.');
  console.log(`   Documents: ${baseDocCount + EXTRA_DOC_COUNT} (page size 100 → hasMore)`);
  console.log(`   Rules: ${RULE_COUNT}+ existing`);
  console.log(`   Quizzes / flashcards / slides: ${QUIZ_COUNT} each`);
  console.log(`   API keys: ${API_KEY_COUNT}`);
}

main().catch((err) => {
  console.error('\n❌ Virtualization seed failed:', err);
  process.exit(1);
});
