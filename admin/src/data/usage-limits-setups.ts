import 'server-only';

import type {
  GenerationKind,
  ICreateUsageLimitsSetupRequest,
  IUpdateUsageLimitsSetupRequest,
  IUsageFeaturePolicies,
  IUsageLimitsSetup,
  IUsageLimitsProfilePreset,
} from '@shared-types';
import {
  ALL_GENERATION_KINDS,
  createDefaultFeaturePolicies,
  DEFAULT_USAGE_CREDIT_COSTS,
  resolveLegacySetupQuotaDefaults,
  USAGE_LIMITS_PROFILE_PRESETS,
} from '@shared-types';
import * as admin from 'firebase-admin';
import { requireAdminSession } from '../auth/session';
import { getAdminFirestore } from '../firebase/admin';

const USAGE_LIMITS_SETUPS_COLLECTION = 'usageLimitsSetups';
const USER_GROUPS_COLLECTION = 'userGroups';

export interface IAdminUsageLimitsSetupSummary extends IUsageLimitsSetup {
  referencedGroupCount: number;
  enabledFeatureCount: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseFeaturePolicies(value: unknown): IUsageFeaturePolicies | null {
  if (!isRecord(value)) {
    return null;
  }

  const policies = {} as IUsageFeaturePolicies;

  for (const kind of ALL_GENERATION_KINDS) {
    const policyValue = value[kind];
    if (!isRecord(policyValue)) {
      policies[kind] = {
        enabled: true,
        creditCost: DEFAULT_USAGE_CREDIT_COSTS[kind],
      };
      continue;
    }

    const enabled = policyValue.enabled;
    const creditCost = policyValue.creditCost;
    if (
      typeof enabled !== 'boolean' ||
      typeof creditCost !== 'number' ||
      creditCost < 0
    ) {
      return null;
    }

    policies[kind] = { enabled, creditCost };
  }

  return policies;
}

export function parseUsageLimitsSetup(
  id: string,
  data: FirebaseFirestore.DocumentData,
): IUsageLimitsSetup | null {
  const name = typeof data.name === 'string' ? data.name.trim() : '';
  const monthlyCreditAllowance =
    typeof data.monthlyCreditAllowance === 'number'
      ? data.monthlyCreditAllowance
      : NaN;
  const featurePolicies = parseFeaturePolicies(data.featurePolicies);

  if (
    !name ||
    !Number.isFinite(monthlyCreditAllowance) ||
    monthlyCreditAllowance < 0 ||
    !featurePolicies
  ) {
    return null;
  }

  const legacyDefaults = resolveLegacySetupQuotaDefaults(name);
  const storageLimitBytes =
    typeof data.storageLimitBytes === 'number' &&
    Number.isFinite(data.storageLimitBytes) &&
    Number.isSafeInteger(data.storageLimitBytes) &&
    data.storageLimitBytes >= 0
      ? data.storageLimitBytes
      : legacyDefaults.storageLimitBytes;
  const dailySlideDeckLimit =
    typeof data.dailySlideDeckLimit === 'number' &&
    Number.isFinite(data.dailySlideDeckLimit) &&
    Number.isSafeInteger(data.dailySlideDeckLimit) &&
    data.dailySlideDeckLimit >= 0
      ? data.dailySlideDeckLimit
      : legacyDefaults.dailySlideDeckLimit;

  return {
    id,
    name,
    description:
      typeof data.description === 'string' ? data.description : undefined,
    monthlyCreditAllowance,
    storageLimitBytes,
    dailySlideDeckLimit,
    featurePolicies,
    updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : undefined,
    updatedBy: typeof data.updatedBy === 'string' ? data.updatedBy : undefined,
  };
}

function toFirestoreUsageLimitsSetupDocument(
  setup: IUsageLimitsSetup,
  options?: { clearDescription?: boolean },
): FirebaseFirestore.DocumentData {
  const document: FirebaseFirestore.DocumentData = {
    id: setup.id,
    name: setup.name,
    monthlyCreditAllowance: setup.monthlyCreditAllowance,
    storageLimitBytes: setup.storageLimitBytes,
    dailySlideDeckLimit: setup.dailySlideDeckLimit,
    featurePolicies: setup.featurePolicies,
    updatedAt: setup.updatedAt,
    updatedBy: setup.updatedBy,
  };

  if (options?.clearDescription) {
    document.description = admin.firestore.FieldValue.delete();
  } else if (setup.description !== undefined) {
    document.description = setup.description;
  }

  return document;
}

function countEnabledFeatures(featurePolicies: IUsageFeaturePolicies): number {
  return Object.values(featurePolicies).filter((policy) => policy.enabled)
    .length;
}

async function countGroupsForSetup(setupId: string): Promise<number> {
  const snapshot = await getAdminFirestore()
    .collection(USER_GROUPS_COLLECTION)
    .where('usageLimitsSetupId', '==', setupId)
    .get();

  return snapshot.size;
}

function normalizeFeaturePolicies(
  featurePolicies: IUsageFeaturePolicies,
): IUsageFeaturePolicies {
  const normalized = createDefaultFeaturePolicies();

  for (const kind of ALL_GENERATION_KINDS) {
    const policy = featurePolicies[kind];
    if (!policy) {
      throw new Error(`Feature policy for ${kind} is required.`);
    }

    if (policy.creditCost < 0) {
      throw new Error(`Credit cost for ${kind} must be zero or greater.`);
    }

    normalized[kind] = {
      enabled: policy.enabled,
      creditCost: policy.creditCost,
    };
  }

  return normalized;
}

export function buildPresetFeaturePolicies(
  preset: IUsageLimitsProfilePreset,
): IUsageFeaturePolicies {
  return createDefaultFeaturePolicies({ disabledKinds: preset.disabledKinds });
}

export function buildPresetFormValues(preset: IUsageLimitsProfilePreset) {
  return {
    name: preset.name,
    description: preset.description,
    monthlyCreditAllowance: preset.monthlyCreditAllowance,
    storageLimitBytes: preset.storageLimitBytes,
    dailySlideDeckLimit: preset.dailySlideDeckLimit,
    featurePolicies: buildPresetFeaturePolicies(preset),
  };
}

export async function listUsageLimitsSetups(): Promise<
  IAdminUsageLimitsSetupSummary[]
> {
  await requireAdminSession();

  const snapshot = await getAdminFirestore()
    .collection(USAGE_LIMITS_SETUPS_COLLECTION)
    .get();
  const summaries: IAdminUsageLimitsSetupSummary[] = [];

  for (const doc of snapshot.docs) {
    const setup = parseUsageLimitsSetup(doc.id, doc.data());
    if (!setup) {
      continue;
    }

    summaries.push({
      ...setup,
      referencedGroupCount: await countGroupsForSetup(doc.id),
      enabledFeatureCount: countEnabledFeatures(setup.featurePolicies),
    });
  }

  return summaries.sort((a, b) => a.name.localeCompare(b.name));
}

export async function getUsageLimitsSetupById(
  setupId: string,
): Promise<IAdminUsageLimitsSetupSummary | null> {
  await requireAdminSession();

  const doc = await getAdminFirestore()
    .collection(USAGE_LIMITS_SETUPS_COLLECTION)
    .doc(setupId)
    .get();
  if (!doc.exists) {
    return null;
  }

  const setup = parseUsageLimitsSetup(doc.id, doc.data() ?? {});
  if (!setup) {
    return null;
  }

  return {
    ...setup,
    referencedGroupCount: await countGroupsForSetup(doc.id),
    enabledFeatureCount: countEnabledFeatures(setup.featurePolicies),
  };
}

export async function createUsageLimitsSetup(
  input: ICreateUsageLimitsSetupRequest,
  adminUid: string,
): Promise<IUsageLimitsSetup> {
  await requireAdminSession();

  const name = input.name.trim();
  if (!name) {
    throw new Error('Setup name is required.');
  }

  if (input.monthlyCreditAllowance < 0) {
    throw new Error('Monthly credit allowance must be zero or greater.');
  }

  if (
    !Number.isFinite(input.storageLimitBytes) ||
    !Number.isSafeInteger(input.storageLimitBytes) ||
    input.storageLimitBytes < 0
  ) {
    throw new Error('Storage limit must be a safe integer of zero or greater.');
  }

  if (
    !Number.isFinite(input.dailySlideDeckLimit) ||
    !Number.isSafeInteger(input.dailySlideDeckLimit) ||
    input.dailySlideDeckLimit < 0
  ) {
    throw new Error(
      'Daily slide deck limit must be a safe integer of zero or greater.',
    );
  }

  const now = new Date().toISOString();
  const docRef = getAdminFirestore()
    .collection(USAGE_LIMITS_SETUPS_COLLECTION)
    .doc();
  const setup: IUsageLimitsSetup = {
    id: docRef.id,
    name,
    description: input.description?.trim() || undefined,
    monthlyCreditAllowance: input.monthlyCreditAllowance,
    storageLimitBytes: input.storageLimitBytes,
    dailySlideDeckLimit: input.dailySlideDeckLimit,
    featurePolicies: normalizeFeaturePolicies(input.featurePolicies),
    updatedAt: now,
    updatedBy: adminUid,
  };

  await docRef.set(toFirestoreUsageLimitsSetupDocument(setup));
  return setup;
}

export async function createUsageLimitsSetupFromRequest(
  body: Record<string, unknown>,
  adminUid: string,
): Promise<IUsageLimitsSetup> {
  const name = typeof body.name === 'string' ? body.name : '';
  const description =
    typeof body.description === 'string' ? body.description : undefined;
  const monthlyCreditAllowance =
    typeof body.monthlyCreditAllowance === 'number'
      ? body.monthlyCreditAllowance
      : NaN;
  const storageLimitBytes =
    typeof body.storageLimitBytes === 'number' ? body.storageLimitBytes : NaN;
  const dailySlideDeckLimit =
    typeof body.dailySlideDeckLimit === 'number'
      ? body.dailySlideDeckLimit
      : NaN;
  const featurePolicies = parseFeaturePolicies(body.featurePolicies);

  if (!featurePolicies) {
    throw new Error('featurePolicies must include every generation kind.');
  }

  if (
    !Number.isFinite(storageLimitBytes) ||
    !Number.isSafeInteger(storageLimitBytes) ||
    storageLimitBytes < 0
  ) {
    throw new Error(
      'storageLimitBytes must be a safe integer of zero or greater.',
    );
  }

  if (
    !Number.isFinite(dailySlideDeckLimit) ||
    !Number.isSafeInteger(dailySlideDeckLimit) ||
    dailySlideDeckLimit < 0
  ) {
    throw new Error(
      'dailySlideDeckLimit must be a safe integer of zero or greater.',
    );
  }

  return createUsageLimitsSetup(
    {
      name,
      description,
      monthlyCreditAllowance,
      storageLimitBytes,
      dailySlideDeckLimit,
      featurePolicies,
    },
    adminUid,
  );
}

export async function updateUsageLimitsSetup(
  setupId: string,
  input: IUpdateUsageLimitsSetupRequest,
  adminUid: string,
): Promise<IUsageLimitsSetup> {
  await requireAdminSession();

  const docRef = getAdminFirestore()
    .collection(USAGE_LIMITS_SETUPS_COLLECTION)
    .doc(setupId);
  const existing = await docRef.get();

  if (!existing.exists) {
    throw new Error('Usage limits setup not found.');
  }

  const current = parseUsageLimitsSetup(existing.id, existing.data() ?? {});
  if (!current) {
    throw new Error('Usage limits setup data is invalid.');
  }

  const descriptionChanged = input.description !== undefined;
  const trimmedDescription = input.description?.trim();
  const nextDescription = descriptionChanged
    ? trimmedDescription || undefined
    : current.description;

  const next: IUsageLimitsSetup = {
    ...current,
    name: input.name?.trim() || current.name,
    description: nextDescription,
    monthlyCreditAllowance:
      input.monthlyCreditAllowance !== undefined
        ? input.monthlyCreditAllowance
        : current.monthlyCreditAllowance,
    storageLimitBytes:
      input.storageLimitBytes !== undefined
        ? input.storageLimitBytes
        : current.storageLimitBytes,
    dailySlideDeckLimit:
      input.dailySlideDeckLimit !== undefined
        ? input.dailySlideDeckLimit
        : current.dailySlideDeckLimit,
    featurePolicies: input.featurePolicies
      ? normalizeFeaturePolicies(input.featurePolicies)
      : current.featurePolicies,
    updatedAt: new Date().toISOString(),
    updatedBy: adminUid,
  };

  if (!next.name.trim()) {
    throw new Error('Setup name is required.');
  }

  if (next.monthlyCreditAllowance < 0) {
    throw new Error('Monthly credit allowance must be zero or greater.');
  }

  if (
    !Number.isFinite(next.storageLimitBytes) ||
    !Number.isSafeInteger(next.storageLimitBytes) ||
    next.storageLimitBytes < 0
  ) {
    throw new Error('Storage limit must be a safe integer of zero or greater.');
  }

  if (
    !Number.isFinite(next.dailySlideDeckLimit) ||
    !Number.isSafeInteger(next.dailySlideDeckLimit) ||
    next.dailySlideDeckLimit < 0
  ) {
    throw new Error(
      'Daily slide deck limit must be a safe integer of zero or greater.',
    );
  }

  await docRef.set(
    toFirestoreUsageLimitsSetupDocument(next, {
      clearDescription: descriptionChanged && nextDescription === undefined,
    }),
    { merge: true },
  );

  return next;
}

export async function updateUsageLimitsSetupFromRequest(
  setupId: string,
  body: Record<string, unknown>,
  adminUid: string,
): Promise<IUsageLimitsSetup> {
  const input: IUpdateUsageLimitsSetupRequest = {};

  if (typeof body.name === 'string') {
    input.name = body.name;
  }

  if (typeof body.description === 'string') {
    input.description = body.description;
  }

  if (typeof body.monthlyCreditAllowance === 'number') {
    input.monthlyCreditAllowance = body.monthlyCreditAllowance;
  }

  if (typeof body.storageLimitBytes === 'number') {
    input.storageLimitBytes = body.storageLimitBytes;
  }

  if (typeof body.dailySlideDeckLimit === 'number') {
    input.dailySlideDeckLimit = body.dailySlideDeckLimit;
  }

  if (body.featurePolicies !== undefined) {
    const featurePolicies = parseFeaturePolicies(body.featurePolicies);
    if (!featurePolicies) {
      throw new Error('featurePolicies must include every generation kind.');
    }
    input.featurePolicies = featurePolicies;
  }

  return updateUsageLimitsSetup(setupId, input, adminUid);
}

export async function deleteUsageLimitsSetup(setupId: string): Promise<void> {
  await requireAdminSession();

  const groupsSnapshot = await getAdminFirestore()
    .collection(USER_GROUPS_COLLECTION)
    .where('usageLimitsSetupId', '==', setupId)
    .get();

  if (!groupsSnapshot.empty) {
    const groupNames = groupsSnapshot.docs
      .map((doc) =>
        typeof doc.data().name === 'string' ? doc.data().name : doc.id,
      )
      .join(', ');

    throw new Error(
      `Cannot delete setup because it is assigned to user groups: ${groupNames}. Reassign those groups first.`,
    );
  }

  await getAdminFirestore()
    .collection(USAGE_LIMITS_SETUPS_COLLECTION)
    .doc(setupId)
    .delete();
}

export async function listUsageLimitsSetupOptions(): Promise<
  Array<{ id: string; name: string }>
> {
  const setups = await listUsageLimitsSetups();
  return setups.map(({ id, name }) => ({ id, name }));
}

export async function ensureUsageLimitsSetupExists(
  setupId: string,
): Promise<void> {
  const doc = await getAdminFirestore()
    .collection(USAGE_LIMITS_SETUPS_COLLECTION)
    .doc(setupId)
    .get();
  if (!doc.exists) {
    throw new Error('Selected usage limits setup does not exist.');
  }
}

export async function seedDefaultUsageLimitsSetups(
  adminUid: string,
): Promise<IUsageLimitsSetup[]> {
  await requireAdminSession();

  const created: IUsageLimitsSetup[] = [];

  for (const preset of USAGE_LIMITS_PROFILE_PRESETS) {
    const existing = await getAdminFirestore()
      .collection(USAGE_LIMITS_SETUPS_COLLECTION)
      .where('name', '==', preset.name)
      .limit(1)
      .get();

    if (!existing.empty) {
      continue;
    }

    const setup = await createUsageLimitsSetup(
      {
        name: preset.name,
        description: preset.description,
        monthlyCreditAllowance: preset.monthlyCreditAllowance,
        storageLimitBytes: preset.storageLimitBytes,
        dailySlideDeckLimit: preset.dailySlideDeckLimit,
        featurePolicies: buildPresetFeaturePolicies(preset),
      },
      adminUid,
    );
    created.push(setup);
  }

  return created;
}

export function getDefaultCreditCost(kind: GenerationKind): number {
  return DEFAULT_USAGE_CREDIT_COSTS[kind];
}
