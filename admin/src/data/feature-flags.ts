import 'server-only';

import * as admin from 'firebase-admin';
import type { IFeatureFlags, IUpdateFeatureFlagsRequest } from '@shared-types';
import { defaultFeatureFlags, parseFeatureFlags } from '@shared-types';
import { getAdminFirestore, isAdminUsingFirebaseEmulator } from '../firebase/admin';
import { toIsoString } from './firestore-iso';

const ADMIN_SETTINGS_COLLECTION = 'adminSettings';
const FEATURE_FLAGS_DOCUMENT = 'featureFlags';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function getFlagsRef(): admin.firestore.DocumentReference {
  return getAdminFirestore()
    .collection(ADMIN_SETTINGS_COLLECTION)
    .doc(FEATURE_FLAGS_DOCUMENT);
}

function environmentDefaults(): IFeatureFlags {
  return defaultFeatureFlags(isFeatureFlagEmulator());
}

function isFeatureFlagEmulator(): boolean {
  return (
    isAdminUsingFirebaseEmulator() ||
    process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === 'true' ||
    Boolean(process.env.NEXT_FIRESTORE_EMULATOR_HOST) ||
    Boolean(process.env.NEXT_AUTH_EMULATOR_HOST)
  );
}

function parseStoredFlags(
  data: FirebaseFirestore.DocumentData,
): IFeatureFlags {
  const flags = parseFeatureFlags(data, environmentDefaults());
  return {
    ...flags,
    updatedAt: toIsoString(data.updatedAt),
    updatedBy: typeof data.updatedBy === 'string' ? data.updatedBy : undefined,
  };
}

export async function readFeatureFlags(): Promise<IFeatureFlags> {
  const snapshot = await getFlagsRef().get();
  if (!snapshot.exists) {
    return environmentDefaults();
  }
  return parseStoredFlags(snapshot.data() ?? {});
}

export async function updateFeatureFlags(
  input: unknown,
  actorUid: string,
): Promise<IFeatureFlags> {
  if (!isRecord(input)) {
    throw new Error('Feature flags payload must be an object.');
  }

  if (typeof input.supportEnabled !== 'boolean') {
    throw new Error('supportEnabled must be a boolean.');
  }

  const payload: IUpdateFeatureFlagsRequest = {
    supportEnabled: input.supportEnabled,
  };

  const flagsRef = getFlagsRef();
  await flagsRef.set(
    {
      supportEnabled: payload.supportEnabled,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: actorUid,
    },
    { merge: true },
  );

  return {
    supportEnabled: payload.supportEnabled,
    updatedAt: new Date().toISOString(),
    updatedBy: actorUid,
  };
}
