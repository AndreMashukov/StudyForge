#!/usr/bin/env node
/**
 * Backfill `homeDirectoryId` on existing agent threads for the folder Chats
 * tabs (web and mobile directory pages list threads by home folder, newest
 * message first).
 *
 * New threads get `homeDirectoryId` from their first message's directory
 * context when they are created. Older threads never had it; the only folder
 * link they carry is `directoryId` on directory-scoped threads, which is what
 * the mobile Chats tab used to filter on. This copies `directoryId` into
 * `homeDirectoryId` for every `users/{uid}/agentThreads/{threadId}` with
 * `scope == 'directory'` and no `homeDirectoryId`. Workspace threads and
 * threads that already have a home folder are untouched. Safe to re-run.
 *
 * @release-phase post-functions
 *
 * Usage:
 *   GCLOUD_PROJECT=study-forge-202604 npx tsx scripts/migrations/backfill-agent-thread-home-directory.ts
 *   GCLOUD_PROJECT=study-forge-202604 npx tsx scripts/migrations/backfill-agent-thread-home-directory.ts --write
 *   npx tsx scripts/migrations/backfill-agent-thread-home-directory.ts --emulator [--write]
 *
 * Default mode is dry-run (reads only, prints counts). Pass --write to apply.
 * Uses application default credentials.
 */
import admin from 'firebase-admin';

const PAGE_SIZE = 400;

/** users/{uid}/agentThreads/{threadId} */
const THREAD_PATH = /^users\/[^/]+\/agentThreads\/[^/]+$/;

function parseArgs(): { write: boolean; useEmulator: boolean } {
  const args = process.argv.slice(2);
  return {
    write: args.includes('--write'),
    useEmulator: args.includes('--emulator'),
  };
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : null;
}

async function main(): Promise<void> {
  const { write, useEmulator } = parseArgs();
  if (useEmulator && !process.env.FIRESTORE_EMULATOR_HOST) {
    process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
  }
  const projectId =
    process.env.GCLOUD_PROJECT ?? process.env.GCP_PROJECT ?? 'study-forge-202604';
  if (!admin.apps.length) {
    admin.initializeApp({ projectId });
  }
  const db = admin.firestore();

  console.log(
    `Backfill agent thread home folders (${write ? 'WRITE' : 'DRY RUN'}) — project ${projectId}${useEmulator ? ' (emulator)' : ''}\n`,
  );

  let scanned = 0;
  let toUpdate = 0;
  let alreadySet = 0;
  let missingDirectory = 0;
  const users = new Set<string>();
  let last: admin.firestore.QueryDocumentSnapshot | null = null;

  for (;;) {
    let query = db
      .collectionGroup('agentThreads')
      // No where(): collection-group filters need an index; scope is checked below.
      .orderBy(admin.firestore.FieldPath.documentId())
      .select('scope', 'directoryId', 'homeDirectoryId')
      .limit(PAGE_SIZE);
    if (last) {
      query = query.startAfter(last);
    }
    const page = await query.get();
    const batch = db.batch();
    let batchWrites = 0;

    for (const doc of page.docs) {
      if (!THREAD_PATH.test(doc.ref.path)) {
        continue;
      }
      const data = doc.data();
      if (data.scope !== 'directory') {
        continue;
      }
      scanned += 1;
      if (nonEmptyString(data.homeDirectoryId)) {
        alreadySet += 1;
        continue;
      }
      const directoryId = nonEmptyString(data.directoryId);
      if (!directoryId) {
        missingDirectory += 1;
        continue;
      }
      toUpdate += 1;
      users.add(doc.ref.path.split('/')[1]);
      if (write) {
        batch.update(doc.ref, { homeDirectoryId: directoryId });
        batchWrites += 1;
      }
    }

    if (write && batchWrites > 0) {
      await batch.commit();
    }
    if (page.size < PAGE_SIZE) {
      break;
    }
    last = page.docs[page.docs.length - 1];
  }

  console.log(`Directory-scoped threads scanned: ${scanned}`);
  console.log(`Already had a home folder: ${alreadySet}`);
  console.log(`Without a directoryId (skipped): ${missingDirectory}`);
  console.log(
    `${write ? 'Updated' : 'To update'}: ${toUpdate} across ${users.size} users`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
