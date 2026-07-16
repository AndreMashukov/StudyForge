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
import {
  getRecordStaleReferenceTime,
  isStaleByAge,
  STALE_ORPHAN_PENDING_MS,
  STALE_PENDING_SWEEP_MESSAGE,
  staleCutoffTimestamp,
} from '../functions/src/services/generation-stale';

config({ path: path.join(process.cwd(), '.env.local') });

delete process.env.FIRESTORE_EMULATOR_HOST;
delete process.env.FIREBASE_AUTH_EMULATOR_HOST;
delete process.env.FIREBASE_STORAGE_EMULATOR_HOST;
delete process.env.FUNCTIONS_EMULATOR;

function parseDirectoryId(): string {
  const arg = process.argv.find((entry) => entry.startsWith('--directory-id='));
  if (!arg) {
    throw new Error('Missing --directory-id=DIR_ID');
  }
  return arg.split('=')[1];
}

async function failIfStillStalePending(
  docRef: FirebaseFirestore.DocumentReference,
  nowMs: number
): Promise<boolean> {
  return docRef.firestore.runTransaction(async (transaction) => {
    const snap = await transaction.get(docRef);
    if (!snap.exists) {
      return false;
    }

    const data = snap.data() as {
      generationStatus?: string;
      createdAt?: FirebaseFirestore.Timestamp;
    };

    if (data.generationStatus !== 'pending') {
      return false;
    }

    if (!isStaleByAge(getRecordStaleReferenceTime(data.createdAt), STALE_ORPHAN_PENDING_MS, nowMs)) {
      return false;
    }

    transaction.update(docRef, {
      generationStatus: 'failed',
      generationError: STALE_PENDING_SWEEP_MESSAGE,
      updatedAt: admin.firestore.Timestamp.now(),
    });
    return true;
  });
}

async function main(): Promise<void> {
  const directoryId = parseDirectoryId();
  const projectId = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT;
  if (!projectId) {
    throw new Error(
      'Missing project ID. Set GCLOUD_PROJECT or GOOGLE_CLOUD_PROJECT before running this script.'
    );
  }

  if (!admin.apps.length) {
    admin.initializeApp({ projectId });
  }

  const db = admin.firestore();
  const nowMs = Date.now();
  const cutoff = staleCutoffTimestamp(STALE_ORPHAN_PENDING_MS, nowMs);
  const usersSnap = await db.collection('users').get();
  let failedCount = 0;
  let skippedCount = 0;

  for (const userDoc of usersSnap.docs) {
    const userId = userDoc.id;
    const pendingSnap = await db
      .collection('users')
      .doc(userId)
      .collection('documents')
      .where('directoryId', '==', directoryId)
      .where('generationStatus', '==', 'pending')
      .where('createdAt', '<', cutoff)
      .get();

    for (const doc of pendingSnap.docs) {
      const didFail = await failIfStillStalePending(doc.ref, nowMs);
      if (!didFail) {
        console.log(`Skipped document ${doc.id} for user ${userId} (no longer stale/pending)`);
        skippedCount += 1;
        continue;
      }
      console.log(`Failed pending document ${doc.id} for user ${userId}`);
      failedCount += 1;
    }
  }

  if (failedCount === 0) {
    console.log(
      `No stale pending documents found in directory ${directoryId}` +
        (skippedCount > 0 ? ` (${skippedCount} skipped)` : '')
    );
    return;
  }

  console.log(
    `Marked ${failedCount} pending document(s) as failed in directory ${directoryId}` +
      (skippedCount > 0 ? ` (${skippedCount} skipped)` : '')
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
