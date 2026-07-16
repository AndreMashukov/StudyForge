#!/usr/bin/env node
/**
 * Fail stale pending documents in a directory (one-off remediation).
 *
 * Usage:
 *   GCLOUD_PROJECT=study-forge-202604 npx tsx scripts/fail-pending-in-directory.ts --directory-id=nyhNzUldfDD9nMZxu06z
 */
import * as path from 'path';
import { config } from 'dotenv';
import admin from 'firebase-admin';

config({ path: path.join(process.cwd(), '.env.local') });

delete process.env.FIRESTORE_EMULATOR_HOST;
delete process.env.FIREBASE_AUTH_EMULATOR_HOST;
delete process.env.FIREBASE_STORAGE_EMULATOR_HOST;
delete process.env.FUNCTIONS_EMULATOR;

const STALE_MESSAGE = 'Timed out — generation did not finish';

function parseDirectoryId(): string {
  const arg = process.argv.find((entry) => entry.startsWith('--directory-id='));
  if (!arg) {
    throw new Error('Missing --directory-id=DIR_ID');
  }
  return arg.split('=')[1];
}

async function main(): Promise<void> {
  const directoryId = parseDirectoryId();
  const projectId = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || 'study-forge-202604';

  if (!admin.apps.length) {
    admin.initializeApp({ projectId });
  }

  const db = admin.firestore();
  const usersSnap = await db.collection('users').get();
  let failedCount = 0;

  for (const userDoc of usersSnap.docs) {
    const userId = userDoc.id;
    const pendingSnap = await db
      .collection('users')
      .doc(userId)
      .collection('documents')
      .where('directoryId', '==', directoryId)
      .where('generationStatus', '==', 'pending')
      .get();

    for (const doc of pendingSnap.docs) {
      await doc.ref.update({
        generationStatus: 'failed',
        generationError: STALE_MESSAGE,
        updatedAt: admin.firestore.Timestamp.now(),
      });
      console.log(`Failed pending document ${doc.id} for user ${userId}`);
      failedCount += 1;
    }
  }

  if (failedCount === 0) {
    console.log(`No pending documents found in directory ${directoryId}`);
    return;
  }

  console.log(`Marked ${failedCount} pending document(s) as failed in directory ${directoryId}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
