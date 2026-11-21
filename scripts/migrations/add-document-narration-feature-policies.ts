#!/usr/bin/env node
/**
 * Give every usage limits setup a `documentNarration` feature policy (ADR 013).
 * A setup without one is read as enabled, so without this migration the Free
 * plan would get narration the moment the functions deploy.
 *
 * Writes `featurePolicies.documentNarration` only where it is missing:
 * - disabled on the Free setup (named "Free", or used by the default
 *   registration group),
 * - enabled on every other setup,
 * both at the default cost per 1,000 spoken characters. The narratable check
 * (`documentNarratableDecision`) is unmetered and needs no policy. Safe to re-run.
 *
 * @release-phase pre-functions
 *
 * Usage:
 *   GCLOUD_PROJECT=study-forge-202604 npx tsx scripts/migrations/add-document-narration-feature-policies.ts
 *   GCLOUD_PROJECT=study-forge-202604 npx tsx scripts/migrations/add-document-narration-feature-policies.ts --write
 *   npx tsx scripts/migrations/add-document-narration-feature-policies.ts --emulator [--write]
 *
 * Default mode is dry-run (reads only, prints what it would change). Pass
 * --write to apply. Uses application default credentials.
 */
import admin from 'firebase-admin';
import { DEFAULT_USAGE_CREDIT_COSTS } from '../../libs/shared-types/src/usage-limits';

const KIND = 'documentNarration';
const UPDATED_BY = 'add-document-narration-feature-policies';

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

async function freeSetupIds(
  db: admin.firestore.Firestore,
): Promise<Set<string>> {
  const ids = new Set<string>();
  const groups = await db
    .collection('userGroups')
    .where('isDefaultRegistrationGroup', '==', true)
    .get();
  for (const group of groups.docs) {
    const setupId = group.get('usageLimitsSetupId');
    if (typeof setupId === 'string' && setupId.trim()) ids.add(setupId.trim());
  }
  return ids;
}

async function main(): Promise<void> {
  const { write, useEmulator } = parseArgs();
  if (useEmulator && !process.env.FIRESTORE_EMULATOR_HOST) {
    process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
  }
  const projectId =
    process.env.GCLOUD_PROJECT ??
    process.env.GCP_PROJECT ??
    'study-forge-202604';
  if (!admin.apps.length) admin.initializeApp({ projectId });
  const db = admin.firestore();

  console.log(
    `Document narration feature policies (${write ? 'WRITE' : 'DRY RUN'}) — project ${projectId}${useEmulator ? ' (emulator)' : ''}\n`,
  );

  const freeIds = await freeSetupIds(db);
  const snapshot = await db.collection('usageLimitsSetups').get();
  let added = 0;
  let present = 0;

  for (const doc of snapshot.docs) {
    const policies = doc.get('featurePolicies');
    if (isRecord(policies) && isRecord(policies[KIND])) {
      present += 1;
      continue;
    }
    const name = doc.get('name');
    const isFree =
      freeIds.has(doc.id) ||
      (typeof name === 'string' && name.trim().toLowerCase() === 'free');
    const policy = {
      enabled: !isFree,
      creditCost: DEFAULT_USAGE_CREDIT_COSTS[KIND],
    };
    added += 1;
    const label = `usageLimitsSetups/${doc.id} (${typeof name === 'string' ? name : 'unnamed'})`;
    if (!write) {
      console.log(
        `  would set ${label} ${KIND} → ${policy.enabled ? 'enabled' : 'disabled'}`,
      );
      continue;
    }
    await doc.ref.update({
      [`featurePolicies.${KIND}`]: policy,
      updatedAt: new Date().toISOString(),
      updatedBy: UPDATED_BY,
    });
    console.log(
      `  set ${label} ${KIND} → ${policy.enabled ? 'enabled' : 'disabled'}`,
    );
  }

  console.log(
    `\nusageLimitsSetups: scanned ${snapshot.size}, ${write ? 'added' : 'to add'} ${added}, already set ${present}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
