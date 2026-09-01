#!/usr/bin/env node
/**
 * Rebuild users/{uid}/usageSummary/current allowance and quota fields from live setups.
 * Run after plan catalog changes so cached allowance values stay in sync.
 *
 * Usage:
 *   GCLOUD_PROJECT=study-forge-202604 npx tsx scripts/migrations/refresh-usage-summaries.ts --dry-run
 *   GCLOUD_PROJECT=study-forge-202604 npx tsx scripts/migrations/refresh-usage-summaries.ts --confirm-live
 *   GCLOUD_PROJECT=study-forge-202604 npx tsx scripts/migrations/refresh-usage-summaries.ts --confirm-live --user-id=<uid>
 */
import * as admin from 'firebase-admin';
import {
  buildUsagePeriodKey,
  calculateRemainingCredits,
  resolveLivePeriodAllowance,
  type IUsageFeaturePolicies,
} from '../../libs/shared-types/src/usage-limits';

const PROJECT_ID =
  process.env.GCLOUD_PROJECT ?? process.env.GCP_PROJECT ?? 'study-forge-202604';
const dryRun = process.argv.includes('--dry-run');
const confirmLive = process.argv.includes('--confirm-live');
const userIdArg = process.argv.find((arg) => arg.startsWith('--user-id='));
const targetUserId = userIdArg?.slice('--user-id='.length).trim();

const USERS_COLLECTION = 'users';
const USER_GROUPS_COLLECTION = 'userGroups';
const USAGE_LIMITS_SETUPS_COLLECTION = 'usageLimitsSetups';
const USAGE_SUMMARY_DOC_ID = 'current';

if (userIdArg !== undefined && !targetUserId) {
  throw new Error('--user-id must contain a Firebase user ID');
}

if (!dryRun && !confirmLive) {
  throw new Error('Live refresh requires --confirm-live (or use --dry-run).');
}

if (dryRun && confirmLive) {
  throw new Error('Use either --dry-run or --confirm-live, not both.');
}

if (!admin.apps.length) {
  admin.initializeApp({ projectId: PROJECT_ID });
}

const db = admin.firestore();

async function listUserIds(): Promise<string[]> {
  if (targetUserId) {
    return [targetUserId];
  }

  const snapshot = await db.collection(USERS_COLLECTION).select().get();
  return snapshot.docs.map((doc) => doc.id);
}

async function resolveSetupForUser(userId: string): Promise<{
  setupId: string;
  setupName: string;
  monthlyCreditAllowance: number;
  storageLimitBytes: number;
  dailySlideDeckLimit: number;
  featurePolicies: IUsageFeaturePolicies;
} | null> {
  const userSnapshot = await db.collection(USERS_COLLECTION).doc(userId).get();
  const userGroupId =
    typeof userSnapshot.data()?.userGroupId === 'string'
      ? userSnapshot.data()?.userGroupId.trim()
      : '';

  if (!userGroupId) {
    console.warn(`  skip users/${userId}: no userGroupId`);
    return null;
  }

  const groupSnapshot = await db.collection(USER_GROUPS_COLLECTION).doc(userGroupId).get();
  if (!groupSnapshot.exists) {
    console.warn(`  skip users/${userId}: user group ${userGroupId} not found`);
    return null;
  }

  const setupId =
    typeof groupSnapshot.data()?.usageLimitsSetupId === 'string'
      ? groupSnapshot.data()?.usageLimitsSetupId.trim()
      : '';

  if (!setupId) {
    console.warn(`  skip users/${userId}: group ${userGroupId} has no usageLimitsSetupId`);
    return null;
  }

  const setupSnapshot = await db
    .collection(USAGE_LIMITS_SETUPS_COLLECTION)
    .doc(setupId)
    .get();

  if (!setupSnapshot.exists) {
    console.warn(`  skip users/${userId}: setup ${setupId} not found`);
    return null;
  }

  const setup = setupSnapshot.data() ?? {};
  const monthlyCreditAllowance =
    typeof setup.monthlyCreditAllowance === 'number' ? setup.monthlyCreditAllowance : 0;
  const storageLimitBytes =
    typeof setup.storageLimitBytes === 'number' ? setup.storageLimitBytes : 0;
  const dailySlideDeckLimit =
    typeof setup.dailySlideDeckLimit === 'number' ? setup.dailySlideDeckLimit : 0;
  const featurePolicies =
    typeof setup.featurePolicies === 'object' && setup.featurePolicies !== null
      ? (setup.featurePolicies as IUsageFeaturePolicies)
      : {};

  return {
    setupId,
    setupName: typeof setup.name === 'string' ? setup.name : setupId,
    monthlyCreditAllowance,
    storageLimitBytes,
    dailySlideDeckLimit,
    featurePolicies,
  };
}

function readNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

async function refreshUserUsageSummary(userId: string): Promise<void> {
  const setup = await resolveSetupForUser(userId);
  if (!setup) {
    return;
  }

  const periodKey = buildUsagePeriodKey();
  const summaryRef = db
    .collection(USERS_COLLECTION)
    .doc(userId)
    .collection('usageSummary')
    .doc(USAGE_SUMMARY_DOC_ID);
  const periodRef = db
    .collection(USERS_COLLECTION)
    .doc(userId)
    .collection('usagePeriods')
    .doc(periodKey);

  const [summarySnapshot, periodSnapshot] = await Promise.all([
    summaryRef.get(),
    periodRef.get(),
  ]);

  if (!summarySnapshot.exists) {
    console.warn(`  skip users/${userId}: usageSummary/current missing`);
    return;
  }

  const summary = summarySnapshot.data() ?? {};
  const periodData = periodSnapshot.data() ?? {};
  const reservedCredits = readNumber(summary.reservedCredits, readNumber(periodData.reservedCredits));
  const spentCredits = readNumber(summary.spentCredits, readNumber(periodData.spentCredits));
  const allowance = resolveLivePeriodAllowance(setup.monthlyCreditAllowance);
  const remainingCredits = calculateRemainingCredits({
    allowance,
    reservedCredits,
    spentCredits,
  });

  const storageUsedBytes = readNumber(summary.storage?.usedBytes);
  const dailyUsed = readNumber(summary.dailySlideDecks?.used);

  const featureAvailability = Object.entries(setup.featurePolicies).map(([kind, policy]) => ({
    kind,
    enabled: policy.enabled,
    creditCost: policy.creditCost,
    affordable: policy.enabled && remainingCredits >= policy.creditCost,
    ...(policy.enabled && remainingCredits < policy.creditCost ? { usesOverage: false } : {}),
  }));

  const patch: Record<string, unknown> = {
    allowance,
    remainingCredits,
    usageLimitsSetupId: setup.setupId,
    usageLimitsSetupName: setup.setupName,
    featureAvailability,
    updatedAt: new Date().toISOString(),
  };

  if (summary.storage && typeof summary.storage === 'object') {
    patch.storage = {
      ...summary.storage,
      limitBytes: setup.storageLimitBytes,
      remainingBytes: Math.max(0, setup.storageLimitBytes - storageUsedBytes),
    };
  }

  if (summary.dailySlideDecks && typeof summary.dailySlideDecks === 'object') {
    patch.dailySlideDecks = {
      ...summary.dailySlideDecks,
      limit: setup.dailySlideDeckLimit,
      remaining: Math.max(0, setup.dailySlideDeckLimit - dailyUsed),
    };
  }

  if (dryRun) {
    console.log(
      `  would patch users/${userId}/usageSummary/current allowance=${allowance} remaining=${remainingCredits} (${setup.setupName})`,
    );
    return;
  }

  await summaryRef.set(patch, { merge: true });

  const periodPatch = {
    periodKey,
    allowance,
    usageLimitsSetupId: setup.setupId,
    updatedAt: new Date().toISOString(),
  };
  await periodRef.set(periodPatch, { merge: true });

  console.log(
    `  refreshed users/${userId}: allowance=${allowance}, remaining=${remainingCredits} (${setup.setupName})`,
  );
}

async function main(): Promise<void> {
  const userIds = await listUserIds();

  console.log(`Project: ${PROJECT_ID}`);
  console.log(dryRun ? 'Mode: dry-run' : 'Mode: apply');
  console.log(`Users: ${userIds.length}`);

  for (const userId of userIds) {
    await refreshUserUsageSummary(userId);
  }

  if (dryRun) {
    console.log('\nDry run complete. Rerun with --confirm-live to apply.');
  } else {
    console.log('\nUsage summary refresh complete.');
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
