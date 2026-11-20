#!/usr/bin/env node
/**
 * Give the directory-scoped agent its own generation kind. It used to share
 * `directoryChat` with directory chat, which is removed (ADR 012). The new
 * function code routes and meters directory-scoped agent turns by
 * `directoryScopedAgent`, so every LLM setup and usage limits setup needs that
 * key before the functions deploy.
 *
 * Copies `llmSetups/{id}.generationRoutes.directoryChat` to
 * `generationRoutes.directoryScopedAgent`, and
 * `usageLimitsSetups/{id}.featurePolicies.directoryChat` to
 * `featurePolicies.directoryScopedAgent`, only where the new key is missing.
 * The old keys stay in place: the functions still running during the release
 * read them, and the new code ignores them. Safe to re-run.
 *
 * @release-phase pre-functions
 *
 * Usage:
 *   GCLOUD_PROJECT=study-forge-202604 npx tsx scripts/migrations/migrate-directory-scoped-agent-kind.ts
 *   GCLOUD_PROJECT=study-forge-202604 npx tsx scripts/migrations/migrate-directory-scoped-agent-kind.ts --write
 *   npx tsx scripts/migrations/migrate-directory-scoped-agent-kind.ts --emulator [--write]
 *
 * Default mode is dry-run (reads only, prints what it would change). Pass
 * --write to apply. Uses application default credentials.
 */
import admin from 'firebase-admin';

const LEGACY_KIND = 'directoryChat';
const NEW_KIND = 'directoryScopedAgent';
const UPDATED_BY = 'migrate-directory-scoped-agent-kind';

interface ITarget {
  collection: string;
  mapField: 'generationRoutes' | 'featurePolicies';
}

const TARGETS: ITarget[] = [
  { collection: 'llmSetups', mapField: 'generationRoutes' },
  { collection: 'usageLimitsSetups', mapField: 'featurePolicies' },
];

interface IStats {
  scanned: number;
  copied: number;
  alreadyMigrated: number;
  noLegacyKey: number;
}

function parseArgs(): { write: boolean; useEmulator: boolean } {
  const args = process.argv.slice(2);
  return {
    write: args.includes('--write'),
    useEmulator: args.includes('--emulator'),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function migrateCollection(
  db: admin.firestore.Firestore,
  target: ITarget,
  write: boolean,
): Promise<IStats> {
  const stats: IStats = { scanned: 0, copied: 0, alreadyMigrated: 0, noLegacyKey: 0 };
  const snapshot = await db.collection(target.collection).get();

  for (const doc of snapshot.docs) {
    stats.scanned += 1;
    const map = doc.get(target.mapField);
    if (!isRecord(map)) {
      stats.noLegacyKey += 1;
      continue;
    }
    if (isRecord(map[NEW_KIND])) {
      stats.alreadyMigrated += 1;
      continue;
    }
    const legacy = map[LEGACY_KIND];
    if (!isRecord(legacy)) {
      stats.noLegacyKey += 1;
      console.log(`  ! ${target.collection}/${doc.id} has no ${target.mapField}.${LEGACY_KIND} to copy`);
      continue;
    }

    stats.copied += 1;
    if (!write) {
      console.log(`  would copy ${target.collection}/${doc.id} ${target.mapField}.${LEGACY_KIND} → ${NEW_KIND}`);
      continue;
    }
    await doc.ref.update({
      [`${target.mapField}.${NEW_KIND}`]: legacy,
      updatedAt: new Date().toISOString(),
      updatedBy: UPDATED_BY,
    });
    console.log(`  copied ${target.collection}/${doc.id} ${target.mapField}.${LEGACY_KIND} → ${NEW_KIND}`);
  }

  return stats;
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
    `Directory-scoped agent kind (${write ? 'WRITE' : 'DRY RUN'}) — project ${projectId}${useEmulator ? ' (emulator)' : ''}\n`,
  );

  for (const target of TARGETS) {
    const stats = await migrateCollection(db, target, write);
    console.log(
      `${target.collection}: scanned ${stats.scanned}, ${write ? 'copied' : 'to copy'} ${stats.copied}, already migrated ${stats.alreadyMigrated}, without ${LEGACY_KIND} ${stats.noLegacyKey}\n`,
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
