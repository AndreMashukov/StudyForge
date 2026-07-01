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
 * Credentials (production — any one):
 *   gcloud auth application-default login   (required even if gcloud auth login already done)
 *   export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
 *
 * Emulator (no credentials):
 *   npx tsx scripts/migrations/rebuild-directory-index.ts --emulator --dry-run
 */
import { execSync } from 'child_process';
import { createRequire } from 'module';
import * as fs from 'fs';
import Module from 'module';
import * as path from 'path';
import { config } from 'dotenv';
import type * as FirebaseAdmin from 'firebase-admin';

config({ path: path.join(process.cwd(), '.env.local') });

const DIRECTORY_INDEX_SERVICE = path.join(
  process.cwd(),
  'functions/lib/src/services/directory-item-index.js',
);
const requireFromFunctions = createRequire(DIRECTORY_INDEX_SERVICE);
// Use functions' firebase-admin so initializeApp() is visible to FirestorePaths.
const admin = requireFromFunctions('firebase-admin') as typeof FirebaseAdmin;

interface ParsedArgs {
  dryRun: boolean;
  checkDrift: boolean;
  userId: string | null;
  directoryId: string | null;
  credentialsPath: string | null;
  useEmulator: boolean;
  help: boolean;
}

function parseArgs(): ParsedArgs {
  const args = process.argv.slice(2);
  let dryRun = false;
  let checkDrift = false;
  let userId: string | null = null;
  let directoryId: string | null = null;
  let credentialsPath: string | null = process.env.GOOGLE_APPLICATION_CREDENTIALS ?? null;
  let useEmulator = false;
  let help = false;

  for (const arg of args) {
    if (arg === '--dry-run') dryRun = true;
    else if (arg === '--check-drift') checkDrift = true;
    else if (arg === '--emulator') useEmulator = true;
    else if (arg === '--help' || arg === '-h') help = true;
    else if (arg.startsWith('--user-id=')) userId = arg.slice('--user-id='.length);
    else if (arg.startsWith('--directory-id=')) directoryId = arg.slice('--directory-id='.length);
    else if (arg.startsWith('--credentials=')) {
      credentialsPath = arg.slice('--credentials='.length);
    }
  }

  return { dryRun, checkDrift, userId, directoryId, credentialsPath, useEmulator, help };
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
  console.error('  Firebase Console → Project Settings → Service Accounts → Generate New Private Key');
  console.error('  export GOOGLE_APPLICATION_CREDENTIALS="/path/to/key.json"');
  console.error('  # or pass per run:');
  console.error('  GCLOUD_PROJECT=study-forge-202604 npx tsx scripts/migrations/rebuild-directory-index.ts \\');
  console.error('    --credentials=/path/to/key.json');
  console.error('\nOption 3 — Emulator only (local data):');
  console.error('  firebase emulators:start');
  console.error('  npx tsx scripts/migrations/rebuild-directory-index.ts --emulator --dry-run');
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
    console.log(`Firebase Admin: production (service account file)`);
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

function printHelp(): void {
  console.log(`
Rebuild directory item indexes (users/{uid}/directories/{dirId}/items/*)

  npx tsx scripts/migrations/rebuild-directory-index.ts [options]

  --dry-run              Report actions without writing
  --check-drift          Compare canonical vs index counts only
  --emulator             Use Firestore emulator (no credentials)
  --credentials=PATH     Service account JSON (alternative to GOOGLE_APPLICATION_CREDENTIALS)
  --user-id=UID          Limit to one user
  --directory-id=ID      Limit to one directory (requires --user-id)
  --help                 Show this message

  Production credentials: gcloud auth application-default login
  or export GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json
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

  registerSharedTypesAlias();

  const db = initializeFirebase(args);
  await assertFirestoreReachable(db);

  const { rebuildDirectoryItemsForDirectory, detectDirectoryIndexDrift } = await import(
    '../../functions/lib/src/services/directory-item-index.js'
  );
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
