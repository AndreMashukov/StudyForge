#!/usr/bin/env node
/**
 * Move "Always apply" from a global rule flag to per-folder settings (ADR 015).
 *
 * Before ADR 015 a rule had `isDefault: true` and then started ticked in the
 * prompt pickers of every folder where it showed up. Now a rule lists the exact
 * folders where it always applies in `alwaysApplyDirectoryIds`, and the web app
 * no longer reads `isDefault`.
 *
 * For every `users/{uid}/rules/{ruleId}` with `isDefault == true` and no
 * `alwaysApplyDirectoryIds` yet, this sets `alwaysApplyDirectoryIds` to the
 * folders the rule is directly attached to (`directoryIds`). Subfolders that
 * only inherit the rule are not included, by design. Rules attached nowhere get
 * an empty list. `isDefault` is left in place for rollback. Rules that already
 * have `alwaysApplyDirectoryIds` are skipped, so it is safe to re-run.
 *
 * @release-phase pre-functions
 *
 * Usage:
 *   GCLOUD_PROJECT=study-forge-202604 npx tsx scripts/migrations/backfill-rule-always-apply-directories.ts
 *   GCLOUD_PROJECT=study-forge-202604 npx tsx scripts/migrations/backfill-rule-always-apply-directories.ts --write
 *   npx tsx scripts/migrations/backfill-rule-always-apply-directories.ts --emulator [--write]
 *
 * Default mode is dry-run (reads only, prints counts). Pass --write to apply.
 * Uses application default credentials.
 */
import admin from 'firebase-admin';

const PAGE_SIZE = 400;

/** users/{uid}/rules/{ruleId} */
const RULE_PATH = /^users\/[^/]+\/rules\/[^/]+$/;

function parseArgs(): { write: boolean; useEmulator: boolean } {
  const args = process.argv.slice(2);
  return {
    write: args.includes('--write'),
    useEmulator: args.includes('--emulator'),
  };
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return [
    ...new Set(
      value.filter(
        (entry): entry is string =>
          typeof entry === 'string' && entry.trim().length > 0,
      ),
    ),
  ];
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
    `Backfill per-folder always apply (${write ? 'WRITE' : 'DRY RUN'}) — project ${projectId}${useEmulator ? ' (emulator)' : ''}\n`,
  );

  let alwaysApplyRules = 0;
  let alreadyMigrated = 0;
  let toUpdate = 0;
  let attachedNowhere = 0;
  let folderSettings = 0;
  const users = new Set<string>();
  let last: admin.firestore.QueryDocumentSnapshot | null = null;

  for (;;) {
    let query = db
      .collectionGroup('rules')
      // No where(): collection-group filters need an index; isDefault is checked below.
      .orderBy(admin.firestore.FieldPath.documentId())
      .select('isDefault', 'directoryIds', 'alwaysApplyDirectoryIds')
      .limit(PAGE_SIZE);
    if (last) {
      query = query.startAfter(last);
    }
    const page = await query.get();
    const batch = db.batch();
    let batchWrites = 0;

    for (const doc of page.docs) {
      if (!RULE_PATH.test(doc.ref.path)) {
        continue;
      }
      const data = doc.data();
      if (data.isDefault !== true) {
        continue;
      }
      alwaysApplyRules += 1;
      if (Array.isArray(data.alwaysApplyDirectoryIds)) {
        alreadyMigrated += 1;
        continue;
      }
      const directoryIds = stringList(data.directoryIds);
      if (directoryIds.length === 0) {
        attachedNowhere += 1;
      }
      toUpdate += 1;
      folderSettings += directoryIds.length;
      users.add(doc.ref.path.split('/')[1]);
      if (write) {
        batch.update(doc.ref, { alwaysApplyDirectoryIds: directoryIds });
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

  console.log(`Rules with always apply on: ${alwaysApplyRules}`);
  console.log(`Already migrated (skipped): ${alreadyMigrated}`);
  console.log(`Attached to no folder (get an empty list): ${attachedNowhere}`);
  console.log(
    `${write ? 'Updated' : 'To update'}: ${toUpdate} rules across ${users.size} users (${folderSettings} folder settings)`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
