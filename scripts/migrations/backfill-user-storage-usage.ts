#!/usr/bin/env node
/**
 * Backfill users/{uid}/storageUsage/current from durable Storage prefixes.
 *
 * Usage:
 *   npx tsx scripts/migrations/backfill-user-storage-usage.ts --dry-run [--user-id=<uid>]
 *   npx tsx scripts/migrations/backfill-user-storage-usage.ts --confirm-live [--user-id=<uid>]
 *
 * Live runs require --confirm-live. Run during a maintenance window when storage
 * accounting writers are paused, so the point-in-time Storage scan cannot race
 * with adjustUserStorageUsage merges.
 */
import * as admin from 'firebase-admin';
import { resolveLegacySetupQuotaDefaults } from '../../libs/shared-types/src/usage-limits';

const PROJECT_ID =
  process.env.GCLOUD_PROJECT ?? process.env.GCP_PROJECT ?? 'study-forge-202604';
// Prefer STORAGE_BUCKET; fall back to the production appspot bucket used by seed scripts.
const STORAGE_BUCKET =
  process.env.STORAGE_BUCKET?.trim() || `${PROJECT_ID}.appspot.com`;
const dryRun = process.argv.includes('--dry-run');
const confirmLive = process.argv.includes('--confirm-live');
const userIdArg = process.argv.find((arg) => arg.startsWith('--user-id='));
const targetUserId = userIdArg?.slice('--user-id='.length).trim();

if (userIdArg !== undefined && !targetUserId) {
  throw new Error('--user-id must contain a Firebase user ID');
}

if (!dryRun && !confirmLive) {
  throw new Error(
    'Live backfill requires --confirm-live (or use --dry-run). Run during a maintenance window when storage writes are paused.',
  );
}

if (dryRun && confirmLive) {
  throw new Error('Use either --dry-run or --confirm-live, not both.');
}

const USAGE_LIMITS_SETUPS_COLLECTION = 'usageLimitsSetups';
const USERS_COLLECTION = 'users';

const DURABLE_PREFIXES = ['documents/', 'slideDecks/'] as const;

if (!admin.apps.length) {
  admin.initializeApp({
    projectId: PROJECT_ID,
    storageBucket: STORAGE_BUCKET,
  });
}

const db = admin.firestore();
const bucket = admin.storage().bucket(STORAGE_BUCKET);

async function listUserIds(): Promise<string[]> {
  if (targetUserId) {
    return [targetUserId];
  }

  const snapshot = await db.collection(USERS_COLLECTION).select().get();
  return snapshot.docs.map((doc) => doc.id);
}

async function sumDurableStorageBytes(userId: string): Promise<number> {
  let totalBytes = 0;

  for (const prefix of DURABLE_PREFIXES) {
    const [files] = await bucket.getFiles({ prefix: `users/${userId}/${prefix}` });
    for (const file of files) {
      const [metadata] = await file.getMetadata();
      totalBytes += parseInt(String(metadata.size || '0'), 10);
    }
  }

  return totalBytes;
}

async function backfillExistingSetupQuotas(): Promise<void> {
  const snapshot = await db.collection(USAGE_LIMITS_SETUPS_COLLECTION).get();

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const name = typeof data.name === 'string' ? data.name : doc.id;
    const legacyDefaults = resolveLegacySetupQuotaDefaults(name);
    const patch: Record<string, number | string> = {};

    if (typeof data.storageLimitBytes !== 'number') {
      patch.storageLimitBytes = legacyDefaults.storageLimitBytes;
    }
    if (typeof data.dailySlideDeckLimit !== 'number') {
      patch.dailySlideDeckLimit = legacyDefaults.dailySlideDeckLimit;
    }

    if (Object.keys(patch).length === 0) {
      continue;
    }

    patch.updatedAt = new Date().toISOString();
    patch.updatedBy = 'backfill-user-storage-usage';

    if (dryRun) {
      console.log(`  would patch setup ${doc.id} (${name})`, patch);
      continue;
    }

    await doc.ref.set(patch, { merge: true });
    console.log(`  patched setup ${doc.id} (${name})`);
  }
}

async function backfillUserStorageUsage(userId: string): Promise<void> {
  const usedBytes = await sumDurableStorageBytes(userId);
  const docRef = db.collection(USERS_COLLECTION).doc(userId).collection('storageUsage').doc('current');

  if (dryRun) {
    console.log(`  would set users/${userId}/storageUsage/current.usedBytes = ${usedBytes}`);
    return;
  }

  await docRef.set(
    {
      usedBytes,
      updatedAt: new Date().toISOString(),
      backfilledBy: 'backfill-user-storage-usage',
    },
    { merge: true },
  );
  console.log(`  updated users/${userId}/storageUsage/current = ${usedBytes} bytes`);
}

async function main(): Promise<void> {
  console.log(
    `Backfill user storage usage (${dryRun ? 'DRY RUN' : 'LIVE'}) — project ${PROJECT_ID}, bucket ${STORAGE_BUCKET}\n`,
  );
  if (!dryRun) {
    console.log(
      'Maintenance window required: pause storage accounting writers before a live run.\n',
    );
  }

  console.log('Patching usage limit setups missing quota fields...');
  await backfillExistingSetupQuotas();

  console.log('\nScanning user storage prefixes...');
  const userIds = await listUserIds();
  for (const userId of userIds) {
    await backfillUserStorageUsage(userId);
  }

  console.log('\nDone.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
