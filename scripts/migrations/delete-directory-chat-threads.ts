#!/usr/bin/env node
/**
 * Delete every directory chat transcript. Directory chat is removed (ADR 012):
 * no function writes `users/{uid}/directories/{dirId}/chat/thread` any more,
 * Firestore rules deny clients, and nothing can show these conversations, so
 * they are deleted rather than left to their 90-day TTL.
 *
 * Deletes each thread document under `users/{uid}/directories/{dirId}/chat/`
 * together with its `messages` subcollection, then any `messages` left under a
 * directory chat path whose thread document is already gone. Agent threads and
 * every other `messages` collection are untouched: only documents whose path
 * matches the directory chat shape are deleted. Safe to re-run.
 *
 * @release-phase post-functions
 *
 * Usage:
 *   GCLOUD_PROJECT=study-forge-202604 npx tsx scripts/migrations/delete-directory-chat-threads.ts
 *   GCLOUD_PROJECT=study-forge-202604 npx tsx scripts/migrations/delete-directory-chat-threads.ts --write
 *   npx tsx scripts/migrations/delete-directory-chat-threads.ts --emulator [--write]
 *
 * Default mode is dry-run (reads only, prints counts). Pass --write to apply.
 * Uses application default credentials.
 */
import admin from 'firebase-admin';

const PAGE_SIZE = 500;

/** users/{uid}/directories/{dirId}/chat/{threadId} */
const THREAD_PATH = /^users\/[^/]+\/directories\/[^/]+\/chat\/[^/]+$/;
/** users/{uid}/directories/{dirId}/chat/{threadId}/messages/{messageId} */
const MESSAGE_PATH = /^users\/[^/]+\/directories\/[^/]+\/chat\/[^/]+\/messages\/[^/]+$/;

function parseArgs(): { write: boolean; useEmulator: boolean } {
  const args = process.argv.slice(2);
  return {
    write: args.includes('--write'),
    useEmulator: args.includes('--emulator'),
  };
}

async function forEachInCollectionGroup(
  db: admin.firestore.Firestore,
  collectionId: string,
  visit: (doc: admin.firestore.QueryDocumentSnapshot) => Promise<void>,
): Promise<void> {
  let last: admin.firestore.QueryDocumentSnapshot | null = null;
  for (;;) {
    let query = db
      .collectionGroup(collectionId)
      .orderBy(admin.firestore.FieldPath.documentId())
      .select()
      .limit(PAGE_SIZE);
    if (last) {
      query = query.startAfter(last);
    }
    const page = await query.get();
    for (const doc of page.docs) {
      await visit(doc);
    }
    if (page.size < PAGE_SIZE) {
      return;
    }
    last = page.docs[page.docs.length - 1];
  }
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
    `Delete directory chat threads (${write ? 'WRITE' : 'DRY RUN'}) — project ${projectId}${useEmulator ? ' (emulator)' : ''}\n`,
  );

  const users = new Set<string>();
  let threads = 0;
  await forEachInCollectionGroup(db, 'chat', async (doc) => {
    if (!THREAD_PATH.test(doc.ref.path)) {
      return;
    }
    threads += 1;
    users.add(doc.ref.path.split('/')[1]);
    if (write) {
      await db.recursiveDelete(doc.ref);
    }
  });
  console.log(`Threads ${write ? 'deleted' : 'to delete'} (with their messages): ${threads} across ${users.size} users`);

  // Messages whose thread document no longer exists are not reached by recursiveDelete.
  // In dry-run this also counts messages of the threads above, so it is an upper bound.
  let orphanMessages = 0;
  await forEachInCollectionGroup(db, 'messages', async (doc) => {
    if (!MESSAGE_PATH.test(doc.ref.path)) {
      return;
    }
    orphanMessages += 1;
    if (write) {
      await doc.ref.delete();
    }
  });
  console.log(
    write
      ? `Messages deleted without a thread document: ${orphanMessages}`
      : `Directory chat messages found (incl. those under the threads above): ${orphanMessages}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
