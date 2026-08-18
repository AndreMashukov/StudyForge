#!/usr/bin/env node
/**
 * Set global and per-user pay-as-you-go credit price to $0.025 (2.5 cents).
 * Does not rewrite usage periods, events, or reservations.
 *
 * Usage:
 *   npx tsx scripts/migrations/update-credit-price-to-2-5-cents.ts [--dry-run]
 */
import * as admin from 'firebase-admin';
import { DEFAULT_PRICE_PER_CREDIT_CENTS } from '../../libs/shared-types/src/billing';

const PROJECT_ID =
  process.env.GCLOUD_PROJECT ?? process.env.GCP_PROJECT ?? 'study-forge-202604';
const dryRun = process.argv.includes('--dry-run');

const BILLING_CONFIG_COLLECTION = 'billingConfig';
const BILLING_CONFIG_DOC_ID = 'global';
const USERS_COLLECTION = 'users';
const BILLING_STATE_DOC_ID = 'current';

const NEW_PRICE_PER_CREDIT_CENTS = DEFAULT_PRICE_PER_CREDIT_CENTS;

if (!admin.apps.length) {
  admin.initializeApp({ projectId: PROJECT_ID });
}

const db = admin.firestore();

async function updateGlobalBillingConfig(): Promise<void> {
  const ref = db.collection(BILLING_CONFIG_COLLECTION).doc(BILLING_CONFIG_DOC_ID);
  const snapshot = await ref.get();
  const current =
    typeof snapshot.data()?.pricePerCreditCents === 'number'
      ? snapshot.data()?.pricePerCreditCents
      : undefined;

  if (current === NEW_PRICE_PER_CREDIT_CENTS) {
    console.log(`  skip billingConfig/global (already ${NEW_PRICE_PER_CREDIT_CENTS})`);
    return;
  }

  const patch = {
    pricePerCreditCents: NEW_PRICE_PER_CREDIT_CENTS,
    updatedAt: new Date().toISOString(),
  };

  if (dryRun) {
    console.log(`  would set billingConfig/global`, { from: current, to: patch });
    return;
  }

  await ref.set(patch, { merge: true });
  console.log(`  updated billingConfig/global to ${NEW_PRICE_PER_CREDIT_CENTS} cents`);
}

async function updateUserBillingStates(): Promise<{
  scanned: number;
  updated: number;
  skipped: number;
}> {
  let scanned = 0;
  let updated = 0;
  let skipped = 0;
  const PAGE_SIZE = 100;
  let lastUserDoc: FirebaseFirestore.QueryDocumentSnapshot | undefined;

  while (true) {
    let usersQuery = db.collection(USERS_COLLECTION).select().limit(PAGE_SIZE);
    if (lastUserDoc) {
      usersQuery = usersQuery.startAfter(lastUserDoc);
    }

    const usersSnapshot = await usersQuery.get();
    if (usersSnapshot.empty) {
      break;
    }

    for (const userDoc of usersSnapshot.docs) {
      const billingRef = userDoc.ref.collection('billing').doc(BILLING_STATE_DOC_ID);
      const billingSnapshot = await billingRef.get();
      if (!billingSnapshot.exists) {
        continue;
      }

      scanned += 1;
      const current = billingSnapshot.data()?.pricePerCreditCents;
      if (current === NEW_PRICE_PER_CREDIT_CENTS) {
        skipped += 1;
        continue;
      }

      const patch = {
        pricePerCreditCents: NEW_PRICE_PER_CREDIT_CENTS,
        updatedAt: new Date().toISOString(),
      };

      if (dryRun) {
        console.log(`  would update users/${userDoc.id}/billing/current`, {
          from: current,
          to: NEW_PRICE_PER_CREDIT_CENTS,
        });
      } else {
        await billingRef.set(patch, { merge: true });
        console.log(`  updated users/${userDoc.id}/billing/current`);
      }

      updated += 1;
    }

    if (usersSnapshot.docs.length < PAGE_SIZE) {
      break;
    }
    lastUserDoc = usersSnapshot.docs[usersSnapshot.docs.length - 1];
  }

  return { scanned, updated, skipped };
}

async function main(): Promise<void> {
  console.log(
    `[credit-price] project=${PROJECT_ID} dryRun=${dryRun} target=${NEW_PRICE_PER_CREDIT_CENTS} cents`,
  );

  console.log('\n[billingConfig]');
  await updateGlobalBillingConfig();

  console.log('\n[user billing states]');
  const summary = await updateUserBillingStates();

  console.log('\n[summary]');
  console.log(`  billing states scanned: ${summary.scanned}`);
  console.log(`  billing states updated: ${summary.updated}`);
  console.log(`  billing states already at target: ${summary.skipped}`);
  console.log(dryRun ? '\nDry run complete. Re-run without --dry-run to apply.' : '\nDone.');
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
