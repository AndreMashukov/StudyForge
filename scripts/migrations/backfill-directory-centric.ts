#!/usr/bin/env node
/**
 * Production migration: directory-centric backfill (Firestore user subcollections).
 *
 * Implements Phase 1 backfill from docs/DIRECTORY_CENTRIC_SPEC.md §16:
 * - Ensures each user has a system "Library" directory (lazy mirror of ensureLibraryDirectory).
 * - Ensures a root "Imported" directory for artifacts whose source documents are missing
 *   or have no resolvable directoryId.
 * - Sets directoryId on documents that are missing, empty, or point at a deleted directory.
 * - Sets directoryId on quizzes, flashcardSets, slideDecks by resolving via the primary
 *   document (documentId, else first documentIds[]), or assigns "Imported".
 * - Recomputes denormalized: documentCount, childCount, quizCount, flashcardSetCount, slideDeckCount.
 *
 * Idempotent: safe to re-run; recount overwrites cached counts to match actual data.
 *
 * Usage (default: every user — do not pass --user-id):
 *   # All users — iterates users/{userId} top-level documents in Firestore
 *   GCLOUD_PROJECT=your-project npx tsx scripts/migrations/backfill-directory-centric.ts
 *   GCLOUD_PROJECT=your-project npx tsx scripts/migrations/backfill-directory-centric.ts --dry-run
 *
 *   # Optional: one user only (smoke test or hotfix)
 *   ... backfill-directory-centric.ts --user-id=UID
 *   ... backfill-directory-centric.ts --dry-run --user-id=UID
 *
 * Credentials (production):
 *   - export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
 *   - or: gcloud auth application-default login
 *
 * Emulator (optional):
 *   FIRESTORE_EMULATOR_HOST=localhost:8080 GCLOUD_PROJECT=code-insights-quiz-ai \
 *     npx tsx scripts/migrations/backfill-directory-centric.ts --dry-run
 *
 * Load .env.local from repo root (same pattern as other scripts):
 */
import * as admin from 'firebase-admin';
import type {
  CollectionReference,
  DocumentData,
  DocumentReference,
  Firestore,
} from 'firebase-admin/firestore';
import * as path from 'path';
import { config } from 'dotenv';

config({ path: path.join(process.cwd(), '.env.local') });

const LIBRARY_NAME = 'Library';
const IMPORTED_NAME = 'Imported';

interface MigrateUserStats {
  userId: string;
  libraryDirectoryId: string | null;
  importedDirectoryId: string | null;
  documentsUpdated: number;
  quizzesUpdated: number;
  flashcardSetsUpdated: number;
  slideDecksUpdated: number;
  directoriesRecounted: number;
}

function printHelp(): void {
  console.log(`
Directory-centric backfill — Firestore users/* subcollections

  Default: processes EVERY user (all documents in the top-level users/ collection).
  Omit --user-id unless you need a single-user run.

  yarn migrate:directory-centric [--dry-run] [--user-id=<firebaseAuthUid>]

  Examples:
    yarn migrate:directory-centric --dry-run
    yarn migrate:directory-centric
    yarn migrate:directory-centric --user-id=abc123

  Env: GCLOUD_PROJECT or GCP_PROJECT (required)
       FIRESTORE_EMULATOR_HOST (optional, for local emulator)
`);
}

function parseArgs(): { dryRun: boolean; userId: string | null; help: boolean } {
  const argv = process.argv.slice(2);
  let dryRun = false;
  let userId: string | null = null;
  let help = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') help = true;
    else if (a === '--dry-run' || a === '-n') dryRun = true;
    else if (a.startsWith('--user-id=')) userId = a.slice('--user-id='.length).trim() || null;
    else if (a === '--user-id') userId = argv[i + 1]?.trim() || null;
  }
  return { dryRun, userId, help };
}

function initializeFirebase(): Firestore {
  if (admin.apps.length > 0) {
    return admin.firestore();
  }

  const emulator =
    process.env.FIRESTORE_EMULATOR_HOST || process.env.FIREBASE_AUTH_EMULATOR_HOST;
  const projectId = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT;

  if (!projectId) {
    console.error('Set GCLOUD_PROJECT or GCP_PROJECT to your Firebase project ID.');
    process.exit(1);
  }

  if (emulator) {
    if (!process.env.FIRESTORE_EMULATOR_HOST) {
      process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
    }
    admin.initializeApp({ projectId });
    console.log('Firebase Admin: emulator mode');
  } else {
    admin.initializeApp({ projectId });
    console.log('Firebase Admin: production / ADC');
  }

  return admin.firestore();
}

function directoriesCol(db: Firestore, userId: string) {
  return db.collection('users').doc(userId).collection('directories');
}
function documentsCol(db: Firestore, userId: string) {
  return db.collection('users').doc(userId).collection('documents');
}
function quizzesCol(db: Firestore, userId: string) {
  return db.collection('users').doc(userId).collection('quizzes');
}
function flashcardSetsCol(db: Firestore, userId: string) {
  return db.collection('users').doc(userId).collection('flashcardSets');
}
function slideDecksCol(db: Firestore, userId: string) {
  return db.collection('users').doc(userId).collection('slideDecks');
}

async function findLibraryDirectoryId(
  db: Firestore,
  userId: string
): Promise<string | null> {
  const snap = await directoriesCol(db, userId)
    .where('isSystem', '==', true)
    .where('name', '==', LIBRARY_NAME)
    .limit(1)
    .get();
  if (snap.empty) return null;
  return snap.docs[0].id;
}

async function createLibraryDirectory(
  db: Firestore,
  userId: string
): Promise<string> {
  const now = admin.firestore.Timestamp.now();
  const directoryData = {
    userId,
    name: LIBRARY_NAME,
    parentId: null,
    path: '/Library',
    level: 0,
    isSystem: true,
    icon: 'library',
    documentCount: 0,
    childCount: 0,
    quizCount: 0,
    flashcardSetCount: 0,
    slideDeckCount: 0,
    ruleIds: [],
    createdAt: now,
    updatedAt: now,
  };
  const ref = await directoriesCol(db, userId).add(directoryData);
  return ref.id;
}

async function findImportedDirectoryId(
  db: Firestore,
  userId: string
): Promise<string | null> {
  const snap = await directoriesCol(db, userId).get();
  for (const doc of snap.docs) {
    const d = doc.data();
    if (d.name === IMPORTED_NAME && d.parentId == null && !d.isSystem) {
      return doc.id;
    }
  }
  return null;
}

async function createImportedDirectory(
  db: Firestore,
  userId: string
): Promise<string> {
  const now = admin.firestore.Timestamp.now();
  const directoryData = {
    userId,
    name: IMPORTED_NAME,
    parentId: null,
    path: '/Imported',
    level: 0,
    isSystem: false,
    documentCount: 0,
    childCount: 0,
    quizCount: 0,
    flashcardSetCount: 0,
    slideDeckCount: 0,
    ruleIds: [],
    createdAt: now,
    updatedAt: now,
  };
  const ref = await directoriesCol(db, userId).add(directoryData);
  return ref.id;
}

async function commitBatches(
  db: Firestore,
  ops: Array<{ ref: DocumentReference; data: Record<string, unknown> }>,
  dryRun: boolean
): Promise<number> {
  const BATCH = 400;
  let applied = 0;
  for (let i = 0; i < ops.length; i += BATCH) {
    const chunk = ops.slice(i, i + BATCH);
    if (dryRun) {
      applied += chunk.length;
      continue;
    }
    const batch = db.batch();
    for (const { ref, data } of chunk) {
      batch.update(ref, data);
    }
    await batch.commit();
    applied += chunk.length;
  }
  return applied;
}

async function migrateUser(
  db: Firestore,
  userId: string,
  dryRun: boolean
): Promise<MigrateUserStats> {
  const stats: MigrateUserStats = {
    userId,
    libraryDirectoryId: null,
    importedDirectoryId: null,
    documentsUpdated: 0,
    quizzesUpdated: 0,
    flashcardSetsUpdated: 0,
    slideDecksUpdated: 0,
    directoriesRecounted: 0,
  };

  let libraryId = await findLibraryDirectoryId(db, userId);
  if (!libraryId) {
    if (dryRun) {
      console.log(`   [dry-run] Would create system ${LIBRARY_NAME} directory`);
      libraryId = '__dry_run_library__';
    } else {
      libraryId = await createLibraryDirectory(db, userId);
      console.log(`   Created ${LIBRARY_NAME}: ${libraryId}`);
    }
  } else {
    console.log(`   ${LIBRARY_NAME} exists: ${libraryId}`);
  }
  stats.libraryDirectoryId = libraryId;

  let importedId = await findImportedDirectoryId(db, userId);
  if (!importedId) {
    if (dryRun) {
      console.log(`   [dry-run] Would create ${IMPORTED_NAME} directory`);
      importedId = '__dry_run_imported__';
    } else {
      importedId = await createImportedDirectory(db, userId);
      console.log(`   Created ${IMPORTED_NAME}: ${importedId}`);
    }
  } else {
    console.log(`   ${IMPORTED_NAME} exists: ${importedId}`);
  }
  stats.importedDirectoryId = importedId;

  const dirSnap = await directoriesCol(db, userId).get();
  const validDirectoryIds = new Set<string>();
  for (const d of dirSnap.docs) {
    validDirectoryIds.add(d.id);
  }
  if (dryRun) {
    validDirectoryIds.add(libraryId);
    validDirectoryIds.add(importedId);
  }

  function isValidDirId(id: unknown): id is string {
    return typeof id === 'string' && id.length > 0 && validDirectoryIds.has(id);
  }

  const docUpdates: Array<{ ref: DocumentReference; data: Record<string, unknown> }> =
    [];
  const documentsSnap = await documentsCol(db, userId).get();
  const docDirectoryById = new Map<string, string>();

  for (const doc of documentsSnap.docs) {
    const data = doc.data();
    const current = data.directoryId;
    let nextDir: string | null = null;
    if (isValidDirId(current)) {
      nextDir = current;
    } else if (libraryId && !dryRun) {
      nextDir = libraryId;
    } else if (dryRun && (!current || !isValidDirId(current))) {
      nextDir = libraryId;
    }
    if (nextDir && nextDir !== current && dryRun) {
      stats.documentsUpdated++;
    } else if (nextDir && nextDir !== current && !dryRun) {
      docUpdates.push({
        ref: doc.ref,
        data: {
          directoryId: nextDir,
          updatedAt: admin.firestore.Timestamp.now(),
        },
      });
      stats.documentsUpdated++;
    }
    if (nextDir) docDirectoryById.set(doc.id, nextDir);
  }

  if (!dryRun) {
    await commitBatches(db, docUpdates, false);
  }

  if (dryRun) {
    for (const doc of documentsSnap.docs) {
      const data = doc.data();
      const current = data.directoryId;
      if (!isValidDirId(current)) {
        docDirectoryById.set(doc.id, libraryId!);
      } else {
        docDirectoryById.set(doc.id, current);
      }
    }
  } else {
    const refreshed = await documentsCol(db, userId).get();
    docDirectoryById.clear();
    for (const doc of refreshed.docs) {
      const data = doc.data();
      const did = data.directoryId;
      if (typeof did === 'string' && did.length > 0) {
        docDirectoryById.set(doc.id, did);
      }
    }
  }

  function resolveArtifactDirectoryId(artifact: DocumentData): string | null {
    const primaryDocId =
      (typeof artifact.documentId === 'string' && artifact.documentId) ||
      (Array.isArray(artifact.documentIds) && artifact.documentIds[0]) ||
      null;
    if (primaryDocId) {
      const fromDoc = docDirectoryById.get(primaryDocId);
      if (fromDoc && validDirectoryIds.has(fromDoc)) return fromDoc;
    }
    return importedId || null;
  }

  const artifactCollections: {
    name: string;
    col: CollectionReference;
    key: keyof Pick<
      MigrateUserStats,
      'quizzesUpdated' | 'flashcardSetsUpdated' | 'slideDecksUpdated'
    >;
  }[] = [
    { name: 'quizzes', col: quizzesCol(db, userId), key: 'quizzesUpdated' },
    { name: 'flashcardSets', col: flashcardSetsCol(db, userId), key: 'flashcardSetsUpdated' },
    { name: 'slideDecks', col: slideDecksCol(db, userId), key: 'slideDecksUpdated' },
  ];

  for (const { col, key } of artifactCollections) {
    const snap = await col.get();
    const updates: Array<{ ref: DocumentReference; data: Record<string, unknown> }> =
      [];
    for (const doc of snap.docs) {
      const data = doc.data();
      const current = data.directoryId;
      if (isValidDirId(current)) continue;
      const resolved = resolveArtifactDirectoryId(data);
      if (!resolved) continue;
      if (resolved === current) continue;
      if (dryRun) {
        stats[key]++;
        continue;
      }
      updates.push({
        ref: doc.ref,
        data: {
          directoryId: resolved,
          updatedAt: admin.firestore.Timestamp.now(),
        },
      });
      stats[key]++;
    }
    if (!dryRun && updates.length > 0) {
      await commitBatches(db, updates, false);
    }
  }

  const finalDirSnap = await directoriesCol(db, userId).get();
  const allDirIds = finalDirSnap.docs.map((d) => d.id);

  const dirsMetaFinal: { id: string; parentId: string | null }[] = [];
  for (const d of finalDirSnap.docs) {
    const data = d.data();
    dirsMetaFinal.push({
      id: d.id,
      parentId: data.parentId ?? null,
    });
  }

  async function countDocumentsInDir(dirId: string): Promise<number> {
    const s = await documentsCol(db, userId).where('directoryId', '==', dirId).get();
    return s.size;
  }

  async function countQuizzes(dirId: string) {
    const s = await quizzesCol(db, userId).where('directoryId', '==', dirId).get();
    return s.size;
  }
  async function countFlash(dirId: string) {
    const s = await flashcardSetsCol(db, userId).where('directoryId', '==', dirId).get();
    return s.size;
  }
  async function countSlides(dirId: string) {
    const s = await slideDecksCol(db, userId).where('directoryId', '==', dirId).get();
    return s.size;
  }

  const recountOps: Array<{ ref: DocumentReference; data: Record<string, unknown> }> = [];

  if (dryRun) {
    console.log('   [dry-run] Skipping directory count recomputation (no writes)');
  } else {
    for (const dirId of allDirIds) {
      const childCount = dirsMetaFinal.filter((m) => m.parentId === dirId).length;
      const [documentCount, quizCount, flashcardSetCount, slideDeckCount] = await Promise.all([
        countDocumentsInDir(dirId),
        countQuizzes(dirId),
        countFlash(dirId),
        countSlides(dirId),
      ]);
      recountOps.push({
        ref: directoriesCol(db, userId).doc(dirId),
        data: {
          documentCount,
          childCount,
          quizCount,
          flashcardSetCount,
          slideDeckCount,
          updatedAt: admin.firestore.Timestamp.now(),
        },
      });
      stats.directoriesRecounted++;
    }
    await commitBatches(db, recountOps, false);
  }

  return stats;
}

async function listUserIds(db: Firestore, singleUserId: string | null): Promise<string[]> {
  if (singleUserId) return [singleUserId];
  const snap = await db.collection('users').get();
  return snap.docs.map((d) => d.id);
}

async function main(): Promise<void> {
  const { dryRun, userId: singleUser, help } = parseArgs();
  if (help) {
    printHelp();
    return;
  }
  console.log('Directory-centric backfill migration');
  console.log(`Mode: ${dryRun ? 'DRY RUN (no writes)' : 'LIVE'}`);
  if (singleUser) {
    console.log(`Scope: single user (--user-id) ${singleUser}`);
  } else {
    console.log('Scope: all users (default — every document in top-level users/)');
  }

  const db = initializeFirebase();
  const userIds = await listUserIds(db, singleUser);

  if (userIds.length === 0) {
    console.log('No users to process.');
    return;
  }

  const totals = {
    users: 0,
    documentsUpdated: 0,
    quizzesUpdated: 0,
    flashcardSetsUpdated: 0,
    slideDecksUpdated: 0,
  };

  for (const userId of userIds) {
    console.log(`\n--- User ${userId} ---`);
    try {
      const stats = await migrateUser(db, userId, dryRun);
      totals.users++;
      totals.documentsUpdated += stats.documentsUpdated;
      totals.quizzesUpdated += stats.quizzesUpdated;
      totals.flashcardSetsUpdated += stats.flashcardSetsUpdated;
      totals.slideDecksUpdated += stats.slideDecksUpdated;
      console.log('   Stats:', stats);
    } catch (e) {
      console.error(`   FAILED for ${userId}:`, e);
      process.exitCode = 1;
    }
  }

  console.log('\n=== Summary ===');
  console.log(JSON.stringify({ ...totals, dryRun }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
