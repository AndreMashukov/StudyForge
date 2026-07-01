#!/usr/bin/env node
/**
 * Rebuild materialized directory item indexes from canonical Firestore collections.
 *
 * Usage:
 *   GCLOUD_PROJECT=study-forge-202604 npx tsx scripts/migrations/rebuild-directory-index.ts
 *   GCLOUD_PROJECT=study-forge-202604 npx tsx scripts/migrations/rebuild-directory-index.ts --user-id=UID
 *   GCLOUD_PROJECT=study-forge-202604 npx tsx scripts/migrations/rebuild-directory-index.ts --directory-id=DIR
 *   GCLOUD_PROJECT=study-forge-202604 npx tsx scripts/migrations/rebuild-directory-index.ts --dry-run
 *   GCLOUD_PROJECT=study-forge-202604 npx tsx scripts/migrations/rebuild-directory-index.ts --check-drift
 *
 * Emulator:
 *   FIRESTORE_EMULATOR_HOST=localhost:8080 GCLOUD_PROJECT=demo-project \
 *     npx tsx scripts/migrations/rebuild-directory-index.ts --dry-run
 */
import * as admin from 'firebase-admin';
import Module from 'module';
import * as path from 'path';
import { config } from 'dotenv';

config({ path: path.join(process.cwd(), '.env.local') });

const useEmulator = process.argv.includes('--emulator');
if (!useEmulator) {
  delete process.env.FIRESTORE_EMULATOR_HOST;
  delete process.env.FIREBASE_AUTH_EMULATOR_HOST;
  delete process.env.FIREBASE_STORAGE_EMULATOR_HOST;
  delete process.env.FIREBASE_FUNCTIONS_EMULATOR_HOST;
}

function registerSharedTypesAlias(): void {
  const sharedTypesEntry = path.join(
    process.cwd(),
    'dist/out-tsc/libs/shared-types/src/index.js',
  );
  const originalResolveFilename = Module._resolveFilename;
  Module._resolveFilename = function patchedResolveFilename(
    request: string,
    parent: Module | undefined,
    isMain: boolean,
    options?: Parameters<typeof Module._resolveFilename>[3],
  ) {
    if (request === '@shared-types') {
      return sharedTypesEntry;
    }
    return originalResolveFilename.call(this, request, parent, isMain, options);
  };
}

interface ParsedArgs {
  dryRun: boolean;
  checkDrift: boolean;
  userId: string | null;
  directoryId: string | null;
  help: boolean;
}

function parseArgs(): ParsedArgs {
  const args = process.argv.slice(2);
  let dryRun = false;
  let checkDrift = false;
  let userId: string | null = null;
  let directoryId: string | null = null;
  let help = false;

  for (const arg of args) {
    if (arg === '--dry-run') dryRun = true;
    else if (arg === '--check-drift') checkDrift = true;
    else if (arg === '--help' || arg === '-h') help = true;
    else if (arg.startsWith('--user-id=')) userId = arg.slice('--user-id='.length);
    else if (arg.startsWith('--directory-id=')) directoryId = arg.slice('--directory-id='.length);
  }

  return { dryRun, checkDrift, userId, directoryId, help };
}

function printHelp(): void {
  console.log(`
Rebuild directory item indexes (users/{uid}/directories/{dirId}/items/*)

  npx tsx scripts/migrations/rebuild-directory-index.ts [options]

  --dry-run           Report actions without writing
  --check-drift       Compare canonical vs index counts only
  --emulator          Use Firestore emulator from env (default: production ADC)
  --user-id=UID       Limit to one user
  --directory-id=ID   Limit to one directory (requires --user-id)
  --help              Show this message
`);
}

async function listUserIds(db: admin.firestore.Firestore, userId: string | null): Promise<string[]> {
  if (userId) {
    return [userId];
  }
  const snapshot = await db.collection('users').get();
  return snapshot.docs.map((doc) => doc.id);
}

async function listDirectoryIds(
  db: admin.firestore.Firestore,
  userId: string,
  directoryId: string | null,
): Promise<string[]> {
  if (directoryId) {
    return [directoryId];
  }
  const snapshot = await db.collection('users').doc(userId).collection('directories').get();
  return snapshot.docs.map((doc) => doc.id);
}

async function main(): Promise<void> {
  const args = parseArgs();
  if (args.help) {
    printHelp();
    return;
  }

  if (args.directoryId && !args.userId) {
    throw new Error('--directory-id requires --user-id');
  }

  const projectId = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT;
  if (!projectId) {
    throw new Error('Set GCLOUD_PROJECT or GCP_PROJECT');
  }

  if (!admin.apps.length) {
    admin.initializeApp({ projectId });
  }

  registerSharedTypesAlias();

  const { rebuildDirectoryItemsForDirectory, detectDirectoryIndexDrift } = await import(
    '../../functions/lib/src/services/directory-item-index.js'
  );

  const db = admin.firestore();
  const userIds = await listUserIds(db, args.userId);
  let rebuilt = 0;
  let driftReports = 0;

  for (const userId of userIds) {
    const directoryIds = await listDirectoryIds(db, userId, args.directoryId);

    for (const directoryId of directoryIds) {
      if (args.checkDrift || args.dryRun) {
        const report = await detectDirectoryIndexDrift(userId, directoryId);
        driftReports += 1;
        console.log(
          `[${args.dryRun ? 'dry-run' : 'drift'}] user=${userId} dir=${directoryId} canonical=${report.canonicalCount} index=${report.indexCount} drift=${report.drift}`,
        );
        continue;
      }

      const result = await rebuildDirectoryItemsForDirectory(userId, directoryId);
      rebuilt += result.itemCount;
      console.log(`Rebuilt user=${userId} dir=${directoryId} items=${result.itemCount}`);
    }
  }

  if (args.checkDrift) {
    console.log(`Checked drift for ${driftReports} directories`);
    return;
  }

  if (args.dryRun) {
    console.log(`Dry run complete (${driftReports} directories inspected)`);
    return;
  }

  console.log(`Rebuild complete. Total index rows written: ${rebuilt}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
