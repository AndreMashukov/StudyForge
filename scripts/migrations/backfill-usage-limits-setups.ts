#!/usr/bin/env node
/**
 * Seed default usage limits setups and backfill userGroups.usageLimitsSetupId.
 *
 * Usage:
 *   npx tsx scripts/migrations/backfill-usage-limits-setups.ts [--dry-run]
 */
import * as admin from 'firebase-admin';
import {
  createDefaultFeaturePolicies,
  USAGE_LIMITS_PROFILE_PRESETS,
} from '../../libs/shared-types/src/usage-limits';

const PROJECT_ID =
  process.env.GCLOUD_PROJECT ?? process.env.GCP_PROJECT ?? 'study-forge-202604';
const dryRun = process.argv.includes('--dry-run');

const USAGE_LIMITS_SETUPS_COLLECTION = 'usageLimitsSetups';
const USER_GROUPS_COLLECTION = 'userGroups';
const DEFAULT_SETUP_NAME = 'Standard';

if (!admin.apps.length) {
  admin.initializeApp({ projectId: PROJECT_ID });
}

const db = admin.firestore();

async function ensureDefaultSetups(adminUid: string): Promise<Map<string, string>> {
  const nameToId = new Map<string, string>();

  for (const preset of USAGE_LIMITS_PROFILE_PRESETS) {
    const existing = await db
      .collection(USAGE_LIMITS_SETUPS_COLLECTION)
      .where('name', '==', preset.name)
      .limit(1)
      .get();

    if (!existing.empty) {
      const doc = existing.docs[0];
      const data = doc.data();
      const patch: Record<string, number | string> = {};

      if (typeof data.storageLimitBytes !== 'number') {
        patch.storageLimitBytes = preset.storageLimitBytes;
      }
      if (typeof data.dailySlideDeckLimit !== 'number') {
        patch.dailySlideDeckLimit = preset.dailySlideDeckLimit;
      }

      if (Object.keys(patch).length > 0) {
        patch.updatedAt = new Date().toISOString();
        patch.updatedBy = 'backfill-usage-limits-setups';

        if (dryRun) {
          console.log(`  would patch preset ${preset.name} (${doc.id})`, patch);
        } else {
          await doc.ref.set(patch, { merge: true });
          console.log(`  patched preset ${preset.name} (${doc.id})`);
        }
      } else {
        console.log(`  skip preset ${preset.name} (exists: ${doc.id})`);
      }

      nameToId.set(preset.name, doc.id);
      continue;
    }

    const docRef = db.collection(USAGE_LIMITS_SETUPS_COLLECTION).doc();
    const now = new Date().toISOString();
    const document = {
      id: docRef.id,
      name: preset.name,
      description: preset.description,
      monthlyCreditAllowance: preset.monthlyCreditAllowance,
      storageLimitBytes: preset.storageLimitBytes,
      dailySlideDeckLimit: preset.dailySlideDeckLimit,
      featurePolicies: createDefaultFeaturePolicies({ disabledKinds: preset.disabledKinds }),
      updatedAt: now,
      updatedBy: adminUid,
    };

    if (dryRun) {
      console.log(`  would create preset ${preset.name} -> ${docRef.id}`);
    } else {
      await docRef.set(document);
      console.log(`  created preset ${preset.name} -> ${docRef.id}`);
    }

    nameToId.set(preset.name, docRef.id);
  }

  return nameToId;
}

async function backfillGroups(defaultSetupId: string): Promise<void> {
  const snapshot = await db.collection(USER_GROUPS_COLLECTION).get();

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const current =
      typeof data.usageLimitsSetupId === 'string' ? data.usageLimitsSetupId.trim() : '';

    if (current) {
      console.log(`  skip group ${doc.id} (${data.name}) — already set`);
      continue;
    }

    if (dryRun) {
      console.log(`  would set group ${doc.id} (${data.name}).usageLimitsSetupId = ${defaultSetupId}`);
      continue;
    }

    await doc.ref.set(
      {
        usageLimitsSetupId: defaultSetupId,
        updatedAt: new Date().toISOString(),
        updatedBy: 'backfill-usage-limits-setups',
      },
      { merge: true }
    );
    console.log(`  updated group ${doc.id} (${data.name})`);
  }
}

async function main(): Promise<void> {
  console.log(`Backfill usage limits setups (${dryRun ? 'DRY RUN' : 'LIVE'}) — project ${PROJECT_ID}\n`);

  const setups = await ensureDefaultSetups('backfill-usage-limits-setups');
  const defaultSetupId = setups.get(DEFAULT_SETUP_NAME);

  if (!defaultSetupId) {
    throw new Error(`Default setup "${DEFAULT_SETUP_NAME}" was not created or found.`);
  }

  console.log('\nBackfilling user groups...');
  await backfillGroups(defaultSetupId);
  console.log('\nDone.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
