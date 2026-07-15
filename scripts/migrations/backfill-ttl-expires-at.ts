#!/usr/bin/env node
/**
 * Backfill Firestore TTL `expiresAt` on raw/transient records.
 *
 * Usage:
 *   GCLOUD_PROJECT=study-forge-202604 npx tsx scripts/migrations/backfill-ttl-expires-at.ts
 *   GCLOUD_PROJECT=study-forge-202604 npx tsx scripts/migrations/backfill-ttl-expires-at.ts --write
 *   npx tsx scripts/migrations/backfill-ttl-expires-at.ts --emulator
 *   npx tsx scripts/migrations/backfill-ttl-expires-at.ts --user-id=UID
 *
 * Default mode is dry-run (counts + sample paths). Pass --write to apply updates.
 *
 * Credentials (production — any one):
 *   gcloud auth application-default login
 *   export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
 *
 * Emulator (no credentials):
 *   npx tsx scripts/migrations/backfill-ttl-expires-at.ts --emulator
 */
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { config } from 'dotenv';
import admin from 'firebase-admin';
import {
  TTL_RETENTION_DAYS,
  type TtlRetentionCategory,
} from '../../functions/src/lib/firestore-ttl';

config({ path: path.join(process.cwd(), '.env.local') });

function computeExpiresAt(from: Date, category: TtlRetentionCategory): admin.firestore.Timestamp {
  const result = new Date(from);
  result.setUTCDate(result.getUTCDate() + TTL_RETENTION_DAYS[category]);
  return admin.firestore.Timestamp.fromDate(result);
}

const BATCH_SIZE = 400;
const PAGE_SIZE = 500;
const SAMPLE_LIMIT = 5;

interface ParsedArgs {
  write: boolean;
  userId: string | null;
  credentialsPath: string | null;
  useEmulator: boolean;
  help: boolean;
}

interface BackfillStats {
  scanned: number;
  skippedHasExpiresAt: number;
  skippedIneligible: number;
  toUpdate: number;
  updated: number;
  samples: string[];
}

function parseArgs(): ParsedArgs {
  const args = process.argv.slice(2);
  let write = false;
  let userId: string | null = null;
  let credentialsPath: string | null = process.env.GOOGLE_APPLICATION_CREDENTIALS ?? null;
  let useEmulator = false;
  let help = false;

  for (const arg of args) {
    if (arg === '--write') write = true;
    else if (arg === '--emulator') useEmulator = true;
    else if (arg === '--help' || arg === '-h') help = true;
    else if (arg.startsWith('--user-id=')) userId = arg.slice('--user-id='.length);
    else if (arg.startsWith('--credentials=')) {
      credentialsPath = arg.slice('--credentials='.length);
    }
  }

  return { write, userId, credentialsPath, useEmulator, help };
}

function hasGcloudUserAuth(): boolean {
  try {
    execSync('gcloud auth print-access-token', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return true;
  } catch {
    return false;
  }
}

function hasApplicationDefaultCredentialsFile(): boolean {
  const home = process.env.HOME || process.env.USERPROFILE;
  if (!home) {
    return false;
  }
  return fs.existsSync(path.join(home, '.config/gcloud/application_default_credentials.json'));
}

function printCredentialHelp(): void {
  console.error('\nProduction Firestore requires credentials (firebase login is not enough).\n');

  if (hasGcloudUserAuth() && !hasApplicationDefaultCredentialsFile()) {
    console.error('Detected: `gcloud auth login` ✓  but Application Default Credentials ✗');
    console.error('Run this once (opens browser):');
    console.error('  gcloud auth application-default login');
    console.error('Then rerun this script.\n');
  }

  console.error('Option 1 — Application Default Credentials:');
  console.error('  gcloud auth application-default login');
  console.error('\nOption 2 — Service account key file:');
  console.error('  export GOOGLE_APPLICATION_CREDENTIALS="/path/to/key.json"');
  console.error('\nOption 3 — Emulator only (local data):');
  console.error('  firebase emulators:start');
  console.error('  npx tsx scripts/migrations/backfill-ttl-expires-at.ts --emulator');
}

function initializeFirebase(args: ParsedArgs): admin.firestore.Firestore {
  if (admin.apps.length > 0) {
    return admin.firestore();
  }

  const projectId = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT;
  if (!projectId) {
    throw new Error('Set GCLOUD_PROJECT or GCP_PROJECT (e.g. study-forge-202604)');
  }

  if (args.useEmulator) {
    if (!process.env.FIRESTORE_EMULATOR_HOST) {
      process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
    }
    admin.initializeApp({ projectId });
    console.log(`Firebase Admin: emulator (${process.env.FIRESTORE_EMULATOR_HOST})`);
    return admin.firestore();
  }

  delete process.env.FIRESTORE_EMULATOR_HOST;
  delete process.env.FIREBASE_AUTH_EMULATOR_HOST;
  delete process.env.FIREBASE_STORAGE_EMULATOR_HOST;
  delete process.env.FIREBASE_FUNCTIONS_EMULATOR_HOST;

  const credentialsPath = args.credentialsPath;
  if (credentialsPath) {
    if (!fs.existsSync(credentialsPath)) {
      throw new Error(`Credentials file not found: ${credentialsPath}`);
    }
    process.env.GOOGLE_APPLICATION_CREDENTIALS = credentialsPath;
    const serviceAccount = JSON.parse(fs.readFileSync(credentialsPath, 'utf8')) as admin.ServiceAccount;
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId,
    });
    console.log('Firebase Admin: production (service account file)');
    return admin.firestore();
  }

  try {
    admin.initializeApp({ projectId });
    console.log('Firebase Admin: production (Application Default Credentials)');
    return admin.firestore();
  } catch (error) {
    printCredentialHelp();
    throw error;
  }
}

async function assertFirestoreReachable(db: admin.firestore.Firestore): Promise<void> {
  try {
    await db.collection('users').limit(1).get();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('Could not load the default credentials')) {
      printCredentialHelp();
    }
    throw error;
  }
}

function toDate(value: unknown): Date | null {
  if (value instanceof admin.firestore.Timestamp) {
    return value.toDate();
  }
  if (value instanceof Date) {
    return value;
  }
  if (value && typeof value === 'object' && 'toDate' in value) {
    const maybeTimestamp = value as { toDate?: () => Date };
    if (typeof maybeTimestamp.toDate === 'function') {
      return maybeTimestamp.toDate();
    }
  }
  return null;
}

function hasValidExpiresAt(data: admin.firestore.DocumentData): boolean {
  const date = toDate(data.expiresAt);
  return date !== null && !Number.isNaN(date.getTime());
}

function createStats(): BackfillStats {
  return {
    scanned: 0,
    skippedHasExpiresAt: 0,
    skippedIneligible: 0,
    toUpdate: 0,
    updated: 0,
    samples: [],
  };
}

function recordSample(stats: BackfillStats, docPath: string): void {
  if (stats.samples.length < SAMPLE_LIMIT) {
    stats.samples.push(docPath);
  }
}

async function commitBatch(
  db: admin.firestore.Firestore,
  updates: Array<{ ref: admin.firestore.DocumentReference; expiresAt: admin.firestore.Timestamp }>,
  write: boolean,
): Promise<number> {
  if (updates.length === 0) {
    return 0;
  }

  if (!write) {
    return updates.length;
  }

  const batch = db.batch();
  for (const update of updates) {
    batch.update(update.ref, { expiresAt: update.expiresAt });
  }
  await batch.commit();
  return updates.length;
}

async function scanCollectionGroup(
  db: admin.firestore.Firestore,
  collectionGroup: string,
  resolveAnchor: (
    data: admin.firestore.DocumentData,
    doc: admin.firestore.QueryDocumentSnapshot,
  ) => { anchor: Date; category: TtlRetentionCategory } | null,
  write: boolean,
  userIdFilter: string | null,
): Promise<BackfillStats> {
  const stats = createStats();
  let lastDoc: admin.firestore.QueryDocumentSnapshot | undefined;
  let pending: Array<{ ref: admin.firestore.DocumentReference; expiresAt: admin.firestore.Timestamp }> = [];

  while (true) {
    let query: admin.firestore.Query = db.collectionGroup(collectionGroup).limit(PAGE_SIZE);
    if (lastDoc) {
      query = query.startAfter(lastDoc);
    }

    const snapshot = await query.get();
    if (snapshot.empty) {
      break;
    }

    for (const doc of snapshot.docs) {
      stats.scanned += 1;
      const data = doc.data();

      if (userIdFilter) {
        const pathUserId = doc.ref.path.split('/')[1];
        if (pathUserId !== userIdFilter) {
          continue;
        }
      }

      if (hasValidExpiresAt(data)) {
        stats.skippedHasExpiresAt += 1;
        continue;
      }

      const resolved = resolveAnchor(data, doc);
      if (!resolved) {
        stats.skippedIneligible += 1;
        continue;
      }

      stats.toUpdate += 1;
      recordSample(stats, doc.ref.path);
      pending.push({
        ref: doc.ref,
        expiresAt: computeExpiresAt(resolved.anchor, resolved.category),
      });

      if (pending.length >= BATCH_SIZE) {
        stats.updated += await commitBatch(db, pending, write);
        pending = [];
      }
    }

    lastDoc = snapshot.docs[snapshot.docs.length - 1];
    if (snapshot.size < PAGE_SIZE) {
      break;
    }
  }

  stats.updated += await commitBatch(db, pending, write);
  return stats;
}

function resolveGenerationJobAnchor(
  data: admin.firestore.DocumentData,
): { anchor: Date; category: TtlRetentionCategory } | null {
  const status = data.status;
  if (status !== 'completed' && status !== 'failed') {
    return null;
  }

  const anchor =
    toDate(status === 'completed' ? data.completedAt : data.failedAt)
    ?? toDate(data.updatedAt)
    ?? toDate(data.createdAt);

  return anchor ? { anchor, category: 'generationJob' } : null;
}

function resolveInteractionSessionAnchor(
  data: admin.firestore.DocumentData,
): { anchor: Date; category: TtlRetentionCategory } | null {
  const anchor = toDate(data.lastActiveAt) ?? toDate(data.startedAt);
  return anchor ? { anchor, category: 'interactionSession' } : null;
}

function resolveLearningEventAnchor(
  data: admin.firestore.DocumentData,
): { anchor: Date; category: TtlRetentionCategory } | null {
  const anchor = toDate(data.occurredAt);
  return anchor ? { anchor, category: 'learningRaw' } : null;
}

function resolveQuizAttemptAnchor(
  data: admin.firestore.DocumentData,
): { anchor: Date; category: TtlRetentionCategory } | null {
  const anchor = toDate(data.completedAt);
  return anchor ? { anchor, category: 'learningRaw' } : null;
}

function resolveChatMessageAnchor(
  data: admin.firestore.DocumentData,
): { anchor: Date; category: TtlRetentionCategory } | null {
  const anchor = toDate(data.createdAt);
  return anchor ? { anchor, category: 'directoryChat' } : null;
}

function resolveChatThreadAnchor(
  data: admin.firestore.DocumentData,
  doc: admin.firestore.QueryDocumentSnapshot,
): { anchor: Date; category: TtlRetentionCategory } | null {
  if (doc.id !== 'thread') {
    return null;
  }
  const anchor = toDate(data.updatedAt) ?? toDate(data.createdAt);
  return anchor ? { anchor, category: 'directoryChat' } : null;
}

function printStats(label: string, stats: BackfillStats, write: boolean): void {
  console.log(`\n${label}`);
  console.log(`  scanned: ${stats.scanned}`);
  console.log(`  skipped (already has expiresAt): ${stats.skippedHasExpiresAt}`);
  console.log(`  skipped (ineligible): ${stats.skippedIneligible}`);
  console.log(`  ${write ? 'updated' : 'would update'}: ${write ? stats.updated : stats.toUpdate}`);
  if (stats.samples.length > 0) {
    console.log('  sample paths:');
    for (const sample of stats.samples) {
      console.log(`    - ${sample}`);
    }
  }
}

function printHelp(): void {
  console.log(`
Backfill Firestore TTL expiresAt on raw/transient records.

  npx tsx scripts/migrations/backfill-ttl-expires-at.ts [options]

  --write                Apply batched updates (default: dry-run only)
  --emulator             Use Firestore emulator (no credentials)
  --credentials=PATH     Service account JSON
  --user-id=UID          Limit to one user's subtree
  --help                 Show this message

  Deploy TTL policies separately:
  firebase deploy --only firestore:indexes --project study-forge-202604
`);
}

async function main(): Promise<void> {
  const args = parseArgs();
  if (args.help) {
    printHelp();
    return;
  }

  const db = initializeFirebase(args);
  await assertFirestoreReachable(db);

  console.log(args.write ? 'Mode: WRITE' : 'Mode: dry-run (pass --write to apply)');

  const targets: Array<{
    label: string;
    collectionGroup: string;
    resolve: (
      data: admin.firestore.DocumentData,
      doc: admin.firestore.QueryDocumentSnapshot,
    ) => { anchor: Date; category: TtlRetentionCategory } | null;
  }> = [
    {
      label: 'generationJobs',
      collectionGroup: 'generationJobs',
      resolve: (data) => resolveGenerationJobAnchor(data),
    },
    {
      label: 'interactionSessions',
      collectionGroup: 'interactionSessions',
      resolve: (data) => resolveInteractionSessionAnchor(data),
    },
    {
      label: 'learningEvents',
      collectionGroup: 'learningEvents',
      resolve: (data) => resolveLearningEventAnchor(data),
    },
    {
      label: 'quizAttempts',
      collectionGroup: 'quizAttempts',
      resolve: (data) => resolveQuizAttemptAnchor(data),
    },
    {
      label: 'directoryChat messages',
      collectionGroup: 'messages',
      resolve: (data) => resolveChatMessageAnchor(data),
    },
    {
      label: 'directoryChat threads',
      collectionGroup: 'chat',
      resolve: (data, doc) => resolveChatThreadAnchor(data, doc),
    },
  ];

  let totalWouldUpdate = 0;
  let totalUpdated = 0;

  for (const target of targets) {
    const stats = await scanCollectionGroup(
      db,
      target.collectionGroup,
      target.resolve,
      args.write,
      args.userId,
    );
    printStats(target.label, stats, args.write);
    totalWouldUpdate += stats.toUpdate;
    totalUpdated += stats.updated;
  }

  if (args.write) {
    console.log(`\nBackfill complete. Updated ${totalUpdated} documents.`);
  } else {
    console.log(`\nDry run complete. ${totalWouldUpdate} documents would be updated.`);
    console.log('Re-run with --write to apply changes.');
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
