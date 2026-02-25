/**
 * One-time migration: Copy documents, quizzes, directories from root
 * collections into users/{userId}/documents, users/{userId}/quizzes,
 * users/{userId}/directories.
 *
 * Prerequisites:
 * - Full backup of Firestore
 * - Run in maintenance window or with dual-write
 *
 * Migration order: directories first (parentId refs stay valid within
 * same user), then documents, then quizzes.
 *
 * Usage:
 *   npx tsx scripts/migrate-to-user-collections.ts [--dry-run] [--delete-old]
 */

import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const BATCH_LIMIT = 500;

const isEmulator =
  !!process.env.FIRESTORE_EMULATOR_HOST ||
  !!process.env.FIREBASE_AUTH_EMULATOR_HOST;

if (!admin.apps.length) {
  if (isEmulator) {
    admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT || 'demo-project' });
    console.log('Initialized Firebase Admin SDK in emulator mode');
  } else {
    admin.initializeApp();
    console.log('Initialized Firebase Admin SDK with default credentials');
  }
}

const db = admin.firestore();

interface MigrationStats {
  directories: { total: number; migrated: number; errors: number };
  documents: { total: number; migrated: number; errors: number };
  quizzes: { total: number; migrated: number; errors: number };
}

async function migrateCollection(
  sourceName: string,
  stats: { total: number; migrated: number; errors: number },
  dryRun: boolean,
  deleteOld: boolean
): Promise<void> {
  console.log(`\n--- Migrating ${sourceName} ---`);

  const snapshot = await db.collection(sourceName).get();
  stats.total = snapshot.size;

  if (snapshot.empty) {
    console.log(`  No documents found in root "${sourceName}" collection.`);
    return;
  }

  console.log(`  Found ${stats.total} documents to migrate.`);

  let batch = db.batch();
  let batchCount = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const userId = data.userId as string | undefined;

    if (!userId) {
      console.warn(`  SKIP ${doc.id}: no userId field`);
      stats.errors++;
      continue;
    }

    const targetRef = db
      .collection('users')
      .doc(userId)
      .collection(sourceName)
      .doc(doc.id);

    if (dryRun) {
      console.log(`  [DRY-RUN] Would copy ${sourceName}/${doc.id} -> users/${userId}/${sourceName}/${doc.id}`);
      stats.migrated++;
      continue;
    }

    batch.set(targetRef, data);
    batchCount++;

    if (batchCount >= BATCH_LIMIT) {
      await batch.commit();
      console.log(`  Committed batch of ${batchCount}`);
      batch = db.batch();
      batchCount = 0;
    }

    stats.migrated++;
  }

  if (batchCount > 0 && !dryRun) {
    await batch.commit();
    console.log(`  Committed final batch of ${batchCount}`);
  }

  // Optionally delete old documents
  if (deleteOld && !dryRun) {
    console.log(`  Deleting old root-level ${sourceName}...`);
    let deleteBatch = db.batch();
    let deleteCount = 0;

    for (const doc of snapshot.docs) {
      deleteBatch.delete(doc.ref);
      deleteCount++;

      if (deleteCount >= BATCH_LIMIT) {
        await deleteBatch.commit();
        console.log(`  Deleted batch of ${deleteCount}`);
        deleteBatch = db.batch();
        deleteCount = 0;
      }
    }

    if (deleteCount > 0) {
      await deleteBatch.commit();
      console.log(`  Deleted final batch of ${deleteCount}`);
    }
  }

  console.log(
    `  ${sourceName}: ${stats.migrated}/${stats.total} migrated, ${stats.errors} errors`
  );
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const deleteOld = args.includes('--delete-old');

  console.log('=== Firestore Migration: Root Collections -> User Subcollections ===');
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log(`Delete old: ${deleteOld}`);
  console.log(`Emulator: ${isEmulator}`);

  const stats: MigrationStats = {
    directories: { total: 0, migrated: 0, errors: 0 },
    documents: { total: 0, migrated: 0, errors: 0 },
    quizzes: { total: 0, migrated: 0, errors: 0 },
  };

  // Migration order: directories, documents, quizzes
  await migrateCollection('directories', stats.directories, dryRun, deleteOld);
  await migrateCollection('documents', stats.documents, dryRun, deleteOld);
  await migrateCollection('quizzes', stats.quizzes, dryRun, deleteOld);

  console.log('\n=== Migration Summary ===');
  console.log(`Directories: ${stats.directories.migrated}/${stats.directories.total} (${stats.directories.errors} errors)`);
  console.log(`Documents:   ${stats.documents.migrated}/${stats.documents.total} (${stats.documents.errors} errors)`);
  console.log(`Quizzes:     ${stats.quizzes.migrated}/${stats.quizzes.total} (${stats.quizzes.errors} errors)`);
  console.log('========================');
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
