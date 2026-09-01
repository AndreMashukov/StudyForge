#!/usr/bin/env node
/**
 * Create or reuse live Stripe subscription Products/Prices and sync
 * usageLimitsSetups in production Firestore to the agreed public catalog.
 *
 * Usage:
 *   STRIPE_SECRET_KEY=sk_live_... GCLOUD_PROJECT=study-forge-202604 \
 *     npx tsx scripts/migrations/sync-subscription-catalog.ts --dry-run
 *
 *   STRIPE_SECRET_KEY=sk_live_... GCLOUD_PROJECT=study-forge-202604 \
 *     npx tsx scripts/migrations/sync-subscription-catalog.ts
 */
import * as admin from 'firebase-admin';
import Stripe from 'stripe';
import {
  FREE_TIER_STORAGE_LIMIT_BYTES,
  POWER_TIER_STORAGE_LIMIT_BYTES,
  PRO_TIER_STORAGE_LIMIT_BYTES,
  STANDARD_TIER_STORAGE_LIMIT_BYTES,
} from '../../libs/shared-types/src/usage-limits';

const PROJECT_ID =
  process.env.GCLOUD_PROJECT ?? process.env.GCP_PROJECT ?? 'study-forge-202604';
const dryRun = process.argv.includes('--dry-run');
const MIGRATION_ACTOR = 'sync-subscription-catalog';

const USAGE_LIMITS_SETUPS_COLLECTION = 'usageLimitsSetups';
const USER_GROUPS_COLLECTION = 'userGroups';

const STRIPE_PRODUCT_METADATA_KEY = 'studyforge';
const STRIPE_PRODUCT_METADATA_VALUE = 'subscription';

interface ICatalogPlan {
  name: string;
  monthlyCreditAllowance: number;
  storageLimitBytes: number;
  dailySlideDeckLimit: number;
  monthlyPriceCents: number;
  isFreePlan: boolean;
  isPublicPlan: boolean;
  displayOrder: number;
  stripeLookupKey?: string;
}

const CATALOG: ICatalogPlan[] = [
  {
    name: 'Free',
    monthlyCreditAllowance: 150,
    storageLimitBytes: FREE_TIER_STORAGE_LIMIT_BYTES,
    dailySlideDeckLimit: 1,
    monthlyPriceCents: 0,
    isFreePlan: true,
    isPublicPlan: true,
    displayOrder: 0,
  },
  {
    name: 'Standard',
    monthlyCreditAllowance: 2_000,
    storageLimitBytes: STANDARD_TIER_STORAGE_LIMIT_BYTES,
    dailySlideDeckLimit: 8,
    monthlyPriceCents: 1_200,
    isFreePlan: false,
    isPublicPlan: true,
    displayOrder: 1,
    stripeLookupKey: 'studyforge_standard_monthly',
  },
  {
    name: 'Pro',
    monthlyCreditAllowance: 8_000,
    storageLimitBytes: PRO_TIER_STORAGE_LIMIT_BYTES,
    dailySlideDeckLimit: 25,
    monthlyPriceCents: 2_900,
    isFreePlan: false,
    isPublicPlan: true,
    displayOrder: 2,
    stripeLookupKey: 'studyforge_pro_monthly',
  },
  {
    name: 'Power',
    monthlyCreditAllowance: 25_000,
    storageLimitBytes: POWER_TIER_STORAGE_LIMIT_BYTES,
    dailySlideDeckLimit: 100,
    monthlyPriceCents: 7_900,
    isFreePlan: false,
    isPublicPlan: false,
    displayOrder: 3,
    stripeLookupKey: 'studyforge_power_monthly',
  },
];

function resolveStripeSecretKey(): string {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) {
    throw new Error('STRIPE_SECRET_KEY is required.');
  }
  if (key.startsWith('pk_')) {
    throw new Error(
      'STRIPE_SECRET_KEY must be a secret key (sk_...). Publishable keys cannot create Products or Prices.',
    );
  }
  if (!key.startsWith('sk_')) {
    throw new Error('STRIPE_SECRET_KEY must start with sk_.');
  }
  return key;
}

async function findSubscriptionProduct(
  stripe: Stripe,
): Promise<Stripe.Product | undefined> {
  let startingAfter: string | undefined;

  while (true) {
    const page = await stripe.products.list({
      limit: 100,
      active: true,
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    });
    const match = page.data.find(
      (product) =>
        product.metadata?.[STRIPE_PRODUCT_METADATA_KEY] === STRIPE_PRODUCT_METADATA_VALUE,
    );
    if (match) {
      return match;
    }
    if (!page.has_more) {
      return undefined;
    }
    startingAfter = page.data[page.data.length - 1]?.id;
  }
}

async function findPriceByLookupKey(
  stripe: Stripe,
  lookupKey: string,
): Promise<Stripe.Price | undefined> {
  const listed = await stripe.prices.list({
    lookup_keys: [lookupKey],
    limit: 1,
    active: true,
  });
  if (listed.data[0]) {
    return listed.data[0];
  }

  let startingAfter: string | undefined;
  while (true) {
    const page = await stripe.prices.list({
      limit: 100,
      active: true,
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    });
    const match = page.data.find((price) => price.lookup_key === lookupKey);
    if (match) {
      return match;
    }
    if (!page.has_more) {
      return undefined;
    }
    startingAfter = page.data[page.data.length - 1]?.id;
  }
}

async function findOrCreateProduct(stripe: Stripe): Promise<string> {
  const product = await findSubscriptionProduct(stripe);
  if (product) {
    console.log(`  reuse Stripe product ${product.id} (${STRIPE_PRODUCT_METADATA_VALUE})`);
    return product.id;
  }

  if (dryRun) {
    console.log(`  would create Stripe product (${STRIPE_PRODUCT_METADATA_VALUE})`);
    return 'prod_dry_run';
  }

  const created = await stripe.products.create({
    name: 'StudyForge Subscription',
    metadata: { [STRIPE_PRODUCT_METADATA_KEY]: STRIPE_PRODUCT_METADATA_VALUE },
  });
  console.log(`  created Stripe product ${created.id} (${STRIPE_PRODUCT_METADATA_VALUE})`);
  return created.id;
}

async function findOrCreatePrice(
  stripe: Stripe,
  productId: string,
  plan: ICatalogPlan,
): Promise<string> {
  const lookupKey = plan.stripeLookupKey;
  if (!lookupKey) {
    throw new Error(`Paid plan ${plan.name} is missing stripeLookupKey.`);
  }

  const existing = await findPriceByLookupKey(stripe, lookupKey);
  const price = existing;
  if (price) {
    if (price.unit_amount !== plan.monthlyPriceCents) {
      throw new Error(
        `Stripe price ${price.id} (${lookupKey}) has unit_amount ${price.unit_amount}, expected ${plan.monthlyPriceCents}. Archive it and rerun, or fix lookup_key manually.`,
      );
    }
    console.log(`  reuse Stripe price ${price.id} (${lookupKey}, $${plan.monthlyPriceCents / 100}/mo)`);
    return price.id;
  }

  if (dryRun) {
    console.log(
      `  would create Stripe price (${lookupKey}, $${plan.monthlyPriceCents / 100}/mo)`,
    );
    return `price_dry_run_${lookupKey}`;
  }

  const created = await stripe.prices.create({
    product: productId,
    currency: 'usd',
    unit_amount: plan.monthlyPriceCents,
    recurring: { interval: 'month' },
    lookup_key: lookupKey,
    metadata: {
      studyforge_plan: plan.name.toLowerCase(),
    },
  });
  console.log(`  created Stripe price ${created.id} (${lookupKey}, $${plan.monthlyPriceCents / 100}/mo)`);
  return created.id;
}

async function loadSetupByName(
  db: FirebaseFirestore.Firestore,
  name: string,
): Promise<FirebaseFirestore.QueryDocumentSnapshot> {
  const snapshot = await db
    .collection(USAGE_LIMITS_SETUPS_COLLECTION)
    .where('name', '==', name)
    .get();

  if (snapshot.empty) {
    throw new Error(`usageLimitsSetups doc named "${name}" was not found.`);
  }
  if (snapshot.size > 1) {
    throw new Error(`More than one usageLimitsSetups doc is named "${name}".`);
  }

  const doc = snapshot.docs[0];
  if (!doc) {
    throw new Error(`usageLimitsSetups doc named "${name}" was not found.`);
  }
  return doc;
}

async function resolveDefaultLlmSetupId(
  db: FirebaseFirestore.Firestore,
): Promise<string> {
  const groups = await db.collection(USER_GROUPS_COLLECTION).limit(1).get();
  const fromGroup = groups.docs[0]?.data().llmSetupId;
  if (typeof fromGroup === 'string' && fromGroup.trim()) {
    return fromGroup.trim();
  }

  const setups = await db.collection('llmSetups').limit(1).get();
  const fromSetup = setups.docs[0]?.id;
  if (fromSetup) {
    return fromSetup;
  }

  throw new Error('Could not resolve llmSetupId for new user groups.');
}

async function ensureUserGroupForSetup(
  db: FirebaseFirestore.Firestore,
  setupId: string,
  plan: ICatalogPlan,
  defaultLlmSetupId: string,
): Promise<string> {
  const snapshot = await db
    .collection(USER_GROUPS_COLLECTION)
    .where('usageLimitsSetupId', '==', setupId)
    .get();

  if (snapshot.size > 1) {
    throw new Error(
      `Setup "${plan.name}" maps to ${snapshot.size} user groups; expected at most one.`,
    );
  }

  const existing = snapshot.docs[0];
  if (existing) {
    console.log(`  reuse userGroups/${existing.id} for ${plan.name}`);
    return existing.id;
  }

  const payload = {
    name: `${plan.name} Users`,
    llmSetupId: defaultLlmSetupId,
    usageLimitsSetupId: setupId,
    isDefaultRegistrationGroup: false,
    updatedAt: new Date().toISOString(),
    updatedBy: MIGRATION_ACTOR,
  };

  if (dryRun) {
    console.log(`  would create user group for ${plan.name}`, payload);
    return `group_dry_run_${plan.name.toLowerCase()}`;
  }

  const groupRef = db.collection(USER_GROUPS_COLLECTION).doc();
  await groupRef.set(payload);
  console.log(`  created userGroups/${groupRef.id} for ${plan.name}`);
  return groupRef.id;
}

async function ensureDefaultRegistrationGroup(
  db: FirebaseFirestore.Firestore,
  freeGroupId: string,
): Promise<void> {
  const snapshot = await db.collection(USER_GROUPS_COLLECTION).get();

  for (const doc of snapshot.docs) {
    const shouldBeDefault = doc.id === freeGroupId;
    const isDefault = doc.data().isDefaultRegistrationGroup === true;
    if (shouldBeDefault === isDefault) {
      continue;
    }

    const patch = {
      isDefaultRegistrationGroup: shouldBeDefault,
      updatedAt: new Date().toISOString(),
      updatedBy: MIGRATION_ACTOR,
    };

    if (dryRun) {
      console.log(`  would patch userGroups/${doc.id} default=${shouldBeDefault}`);
      continue;
    }

    await doc.ref.set(patch, { merge: true });
    console.log(`  patched userGroups/${doc.id} default=${shouldBeDefault}`);
  }
}

async function syncFirestoreSetup(
  db: FirebaseFirestore.Firestore,
  setupDoc: FirebaseFirestore.QueryDocumentSnapshot,
  plan: ICatalogPlan,
  stripePriceId?: string,
): Promise<void> {
  const patch: Record<string, unknown> = {
    monthlyCreditAllowance: plan.monthlyCreditAllowance,
    storageLimitBytes: plan.storageLimitBytes,
    dailySlideDeckLimit: plan.dailySlideDeckLimit,
    monthlyPriceCents: plan.monthlyPriceCents,
    isFreePlan: plan.isFreePlan,
    isPublicPlan: plan.isPublicPlan,
    displayOrder: plan.displayOrder,
    updatedAt: new Date().toISOString(),
    updatedBy: MIGRATION_ACTOR,
  };

  if (plan.isFreePlan) {
    if (dryRun) {
      patch.stripePriceId = '(delete field)';
    } else {
      patch.stripePriceId = admin.firestore.FieldValue.delete();
    }
  } else if (stripePriceId) {
    patch.stripePriceId = stripePriceId;
  }

  if (dryRun) {
    console.log(`  would patch usageLimitsSetups/${setupDoc.id} (${plan.name})`, patch);
    return;
  }

  await setupDoc.ref.set(patch, { merge: true });
  console.log(`  patched usageLimitsSetups/${setupDoc.id} (${plan.name})`);
}

async function main(): Promise<void> {
  const stripeSecretKey = resolveStripeSecretKey();

  if (!admin.apps.length) {
    admin.initializeApp({ projectId: PROJECT_ID });
  }
  const db = admin.firestore();
  const stripe = new Stripe(stripeSecretKey);

  console.log(`Project: ${PROJECT_ID}`);
  console.log(dryRun ? 'Mode: dry-run' : 'Mode: apply');
  console.log('Stripe catalog:');

  const productId = await findOrCreateProduct(stripe);
  const priceIds = new Map<string, string>();

  for (const plan of CATALOG) {
    if (!plan.stripeLookupKey) {
      continue;
    }
    const priceId = await findOrCreatePrice(stripe, productId, plan);
    priceIds.set(plan.name, priceId);
  }

  console.log('Firestore usageLimitsSetups:');

  const defaultLlmSetupId = await resolveDefaultLlmSetupId(db);
  let freeGroupId: string | undefined;

  for (const plan of CATALOG) {
    const setupDoc = await loadSetupByName(db, plan.name);
    const stripePriceId = plan.isFreePlan ? undefined : priceIds.get(plan.name);
    await syncFirestoreSetup(db, setupDoc, plan, stripePriceId);
    const groupId = await ensureUserGroupForSetup(
      db,
      setupDoc.id,
      plan,
      defaultLlmSetupId,
    );
    if (plan.isFreePlan) {
      freeGroupId = groupId;
    }
  }

  if (!freeGroupId) {
    throw new Error('Free user group was not resolved.');
  }

  console.log('Firestore userGroups:');
  await ensureDefaultRegistrationGroup(db, freeGroupId);

  console.log('\nStripe price IDs:');
  for (const plan of CATALOG) {
    if (plan.isFreePlan) {
      console.log(`  ${plan.name}: (none)`);
      continue;
    }
    console.log(`  ${plan.name}: ${priceIds.get(plan.name) ?? 'pending'}`);
  }

  if (dryRun) {
    console.log('\nDry run complete. Rerun without --dry-run to apply Firestore writes and create Stripe objects.');
  } else {
    console.log('\nCatalog sync complete.');
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
