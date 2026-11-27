#!/usr/bin/env node
/**
 * Backfill library search records (`users/{uid}/searchRecords/*`) for items
 * created before the library search triggers existed. Library search on web
 * and mobile reads only these records, so without this run existing
 * directories, documents, artifacts and agent chats cannot be found.
 *
 * For every directory, document, artifact and agent chat it builds the same
 * record the `sync*SearchRecord` triggers write (documents also get their body
 * text from Cloud Storage, chats their message text) and writes it only when
 * it differs. Safe to re-run; re-run after deploying chat search (schema v2).
 *
 * @release-phase post-functions
 *
 * Usage:
 *   GCLOUD_PROJECT=study-forge-202604 npx tsx scripts/migrations/backfill-library-search-records.ts
 *   GCLOUD_PROJECT=study-forge-202604 npx tsx scripts/migrations/backfill-library-search-records.ts --write
 *   npx tsx scripts/migrations/backfill-library-search-records.ts --emulator [--write]
 *   npx tsx scripts/migrations/backfill-library-search-records.ts --user-id=UID
 *
 * Default mode is dry-run (reads only, prints counts). Pass --write to apply.
 * Uses application default credentials. The bucket comes from STORAGE_BUCKET,
 * or is found by probing the project's default bucket names.
 */
import * as path from 'path';
import { config } from 'dotenv';
import admin from 'firebase-admin';
import {
  LIBRARY_SEARCH_SCHEMA_VERSION,
  LIBRARY_SEARCH_TOMBSTONE_TTL_DAYS,
} from '../../libs/shared-types/src/library-search';
import {
  listSearchRecordTargets,
  syncSearchRecord,
  type ISearchRecordSyncDeps,
  type SearchRecordSyncOutcome,
} from '../../libs/backend/directories/src/library-search/search-record-sync';

config({ path: path.join(process.cwd(), '.env.local') });

const CONCURRENCY = 8;

interface IParsedArgs {
  write: boolean;
  userId: string | null;
  useEmulator: boolean;
}

function parseArgs(): IParsedArgs {
  let write = false;
  let userId: string | null = null;
  let useEmulator = false;
  for (const arg of process.argv.slice(2)) {
    if (arg === '--write') write = true;
    else if (arg === '--emulator') useEmulator = true;
    else if (arg.startsWith('--user-id=')) {
      userId = arg.slice('--user-id='.length).trim() || null;
    }
  }
  return { write, userId, useEmulator };
}

function resolveProjectId(): string {
  const projectId = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT;
  if (!projectId) {
    throw new Error('Set GCLOUD_PROJECT or GCP_PROJECT (e.g. study-forge-202604)');
  }
  return projectId;
}

async function resolveBucket(projectId: string, useEmulator: boolean) {
  const explicit = process.env.STORAGE_BUCKET?.trim();
  if (explicit) {
    return admin.storage().bucket(explicit);
  }
  // The emulator and seed scripts use the `.appspot.com` name.
  if (useEmulator) {
    return admin.storage().bucket(`${projectId}.appspot.com`);
  }
  for (const name of [
    `${projectId}.firebasestorage.app`,
    `${projectId}.appspot.com`,
  ]) {
    const bucket = admin.storage().bucket(name);
    const [exists] = await bucket.exists();
    if (exists) {
      return bucket;
    }
  }
  throw new Error(
    `No default Storage bucket found for ${projectId}. Set STORAGE_BUCKET.`,
  );
}

async function listUserIds(
  db: admin.firestore.Firestore,
  userId: string | null,
): Promise<string[]> {
  if (userId) {
    return [userId];
  }
  // listDocuments also returns users that only have subcollections.
  const refs = await db.collection('users').listDocuments();
  return refs.map((ref) => ref.id);
}

type Counts = Record<SearchRecordSyncOutcome | 'failed', number>;

async function main(): Promise<void> {
  const args = parseArgs();
  const projectId = resolveProjectId();

  if (args.useEmulator) {
    process.env.FIRESTORE_EMULATOR_HOST ||= 'localhost:8080';
    process.env.FIREBASE_STORAGE_EMULATOR_HOST ||= 'localhost:9199';
  } else {
    delete process.env.FIRESTORE_EMULATOR_HOST;
    delete process.env.FIREBASE_STORAGE_EMULATOR_HOST;
  }

  admin.initializeApp({ projectId });
  const db = admin.firestore();
  const bucket = await resolveBucket(projectId, args.useEmulator);
  const deps: ISearchRecordSyncDeps = {
    db,
    bucket,
    schemaVersion: LIBRARY_SEARCH_SCHEMA_VERSION,
    tombstoneTtlDays: LIBRARY_SEARCH_TOMBSTONE_TTL_DAYS,
  };

  console.log(
    `Backfill library search records (${args.write ? 'WRITE' : 'DRY RUN'}) — ` +
      `project ${projectId}, bucket ${bucket.name}` +
      (args.useEmulator ? ', emulator' : ''),
  );

  const counts: Counts = {
    written: 0,
    unchanged: 0,
    tombstoned: 0,
    absent: 0,
    failed: 0,
  };
  const userIds = await listUserIds(db, args.userId);

  for (const userId of userIds) {
    const targets = await listSearchRecordTargets(db, userId);
    for (let start = 0; start < targets.length; start += CONCURRENCY) {
      await Promise.all(
        targets.slice(start, start + CONCURRENCY).map(async (target) => {
          try {
            const outcome = await syncSearchRecord(deps, target, {
              dryRun: !args.write,
            });
            counts[outcome] += 1;
          } catch (error) {
            counts.failed += 1;
            console.error(
              `  failed ${userId}/${target.itemType}/${target.sourceId}:`,
              error instanceof Error ? error.message : String(error),
            );
          }
        }),
      );
    }
    console.log(`  ${userId}: ${targets.length} items`);
  }

  console.log(
    `Users: ${userIds.length}. ` +
      `${args.write ? 'Written' : 'Would write'}: ${counts.written}, ` +
      `unchanged: ${counts.unchanged}, failed: ${counts.failed}.`,
  );

  if (counts.failed > 0) {
    throw new Error(`${counts.failed} items failed; re-run to retry them.`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
