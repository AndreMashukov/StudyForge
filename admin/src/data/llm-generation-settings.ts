import 'server-only';

import * as admin from 'firebase-admin';
import type {
  ILlmGenerationRuntimeSettings,
  ILlmGenerationSettings,
} from '@shared-types';
import {
  DEFAULT_LLM_GENERATION_SETTINGS,
  LLM_GENERATION_SETTINGS_LIMITS,
} from '@shared-types';
import { getAdminFirestore } from '../firebase/admin';
import { toIsoString } from './firestore-iso';

const ADMIN_SETTINGS_COLLECTION = 'adminSettings';
const LLM_GENERATION_SETTINGS_DOCUMENT = 'llmGeneration';

type NumericSettingKey = Exclude<
  keyof ILlmGenerationRuntimeSettings,
  'disableReasoning'
>;

interface INumericSettingLimits {
  min: number;
  max: number;
}

interface INumericValidationOptions {
  integer?: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function getSettingsRef(): admin.firestore.DocumentReference {
  return getAdminFirestore()
    .collection(ADMIN_SETTINGS_COLLECTION)
    .doc(LLM_GENERATION_SETTINGS_DOCUMENT);
}

function getNumericValue(
  data: FirebaseFirestore.DocumentData,
  key: NumericSettingKey,
  fallback: number | undefined,
  limits: INumericSettingLimits,
  options?: INumericValidationOptions,
): number | undefined {
  const value = data[key];
  if (!isFiniteNumber(value)) {
    return fallback;
  }

  if (options?.integer && !Number.isInteger(value)) {
    return fallback;
  }

  if (value < limits.min || value > limits.max) {
    return fallback;
  }

  return value;
}

function parseStoredSettings(
  data: FirebaseFirestore.DocumentData,
): ILlmGenerationSettings {
  const runtimeSettings: ILlmGenerationRuntimeSettings = {
    ...DEFAULT_LLM_GENERATION_SETTINGS,
    requestTimeoutMs:
      getNumericValue(
        data,
        'requestTimeoutMs',
        DEFAULT_LLM_GENERATION_SETTINGS.requestTimeoutMs,
        LLM_GENERATION_SETTINGS_LIMITS.requestTimeoutMs,
        { integer: true },
      ) ?? DEFAULT_LLM_GENERATION_SETTINGS.requestTimeoutMs,
    maxOutputTokens:
      getNumericValue(
        data,
        'maxOutputTokens',
        DEFAULT_LLM_GENERATION_SETTINGS.maxOutputTokens,
        LLM_GENERATION_SETTINGS_LIMITS.maxOutputTokens,
        { integer: true },
      ) ?? DEFAULT_LLM_GENERATION_SETTINGS.maxOutputTokens,
    temperature:
      getNumericValue(
        data,
        'temperature',
        DEFAULT_LLM_GENERATION_SETTINGS.temperature,
        LLM_GENERATION_SETTINGS_LIMITS.temperature,
      ) ?? DEFAULT_LLM_GENERATION_SETTINGS.temperature,
    topK:
      getNumericValue(
        data,
        'topK',
        DEFAULT_LLM_GENERATION_SETTINGS.topK,
        LLM_GENERATION_SETTINGS_LIMITS.topK,
        { integer: true },
      ) ?? DEFAULT_LLM_GENERATION_SETTINGS.topK,
    topP:
      getNumericValue(
        data,
        'topP',
        DEFAULT_LLM_GENERATION_SETTINGS.topP,
        LLM_GENERATION_SETTINGS_LIMITS.topP,
      ) ?? DEFAULT_LLM_GENERATION_SETTINGS.topP,
    disableReasoning:
      typeof data.disableReasoning === 'boolean'
        ? data.disableReasoning
        : DEFAULT_LLM_GENERATION_SETTINGS.disableReasoning,
  };

  const thinkingBudget = getNumericValue(
    data,
    'thinkingBudget',
    undefined,
    LLM_GENERATION_SETTINGS_LIMITS.thinkingBudget,
    { integer: true },
  );
  if (thinkingBudget !== undefined) {
    runtimeSettings.thinkingBudget = thinkingBudget;
  }

  return {
    ...runtimeSettings,
    updatedAt: toIsoString(data.updatedAt),
    updatedBy: typeof data.updatedBy === 'string' ? data.updatedBy : undefined,
  };
}

function assertInRange(
  key: NumericSettingKey,
  value: number,
  limits: INumericSettingLimits,
  options?: INumericValidationOptions,
): void {
  if (options?.integer && !Number.isInteger(value)) {
    throw new Error(`${key} must be an integer.`);
  }

  if (value < limits.min || value > limits.max) {
    throw new Error(`${key} must be between ${limits.min} and ${limits.max}.`);
  }
}

function normalizeNumericSetting(
  input: Record<string, unknown>,
  key: NumericSettingKey,
  fallback: number | undefined,
  limits: INumericSettingLimits,
  options?: INumericValidationOptions,
): number | undefined {
  const rawValue = input[key];
  const value = rawValue === undefined ? fallback : rawValue;

  if (value === undefined) {
    return undefined;
  }

  if (!isFiniteNumber(value)) {
    throw new Error(`${key} must be a finite number.`);
  }

  assertInRange(key, value, limits, options);
  return value;
}

function normalizeRuntimeSettings(
  input: Record<string, unknown>,
  current: ILlmGenerationSettings,
): ILlmGenerationRuntimeSettings {
  const disableReasoning =
    input.disableReasoning === undefined
      ? current.disableReasoning
      : input.disableReasoning;

  if (typeof disableReasoning !== 'boolean') {
    throw new Error('disableReasoning must be a boolean.');
  }

  const settings: ILlmGenerationRuntimeSettings = {
    requestTimeoutMs:
      normalizeNumericSetting(
        input,
        'requestTimeoutMs',
        current.requestTimeoutMs,
        LLM_GENERATION_SETTINGS_LIMITS.requestTimeoutMs,
        { integer: true },
      ) ?? DEFAULT_LLM_GENERATION_SETTINGS.requestTimeoutMs,
    maxOutputTokens:
      normalizeNumericSetting(
        input,
        'maxOutputTokens',
        current.maxOutputTokens,
        LLM_GENERATION_SETTINGS_LIMITS.maxOutputTokens,
        { integer: true },
      ) ?? DEFAULT_LLM_GENERATION_SETTINGS.maxOutputTokens,
    temperature:
      normalizeNumericSetting(
        input,
        'temperature',
        current.temperature,
        LLM_GENERATION_SETTINGS_LIMITS.temperature,
      ) ?? DEFAULT_LLM_GENERATION_SETTINGS.temperature,
    topK:
      normalizeNumericSetting(
        input,
        'topK',
        current.topK,
        LLM_GENERATION_SETTINGS_LIMITS.topK,
        { integer: true },
      ) ?? DEFAULT_LLM_GENERATION_SETTINGS.topK,
    topP:
      normalizeNumericSetting(
        input,
        'topP',
        current.topP,
        LLM_GENERATION_SETTINGS_LIMITS.topP,
      ) ?? DEFAULT_LLM_GENERATION_SETTINGS.topP,
    disableReasoning,
  };

  const thinkingBudget =
    input.thinkingBudget === null
      ? undefined
      : normalizeNumericSetting(
          input,
          'thinkingBudget',
          current.thinkingBudget,
          LLM_GENERATION_SETTINGS_LIMITS.thinkingBudget,
          { integer: true },
        );
  if (thinkingBudget !== undefined) {
    settings.thinkingBudget = thinkingBudget;
  }

  return settings;
}

export async function readLlmGenerationSettings(): Promise<ILlmGenerationSettings> {
  const snapshot = await getSettingsRef().get();

  if (!snapshot.exists) {
    return { ...DEFAULT_LLM_GENERATION_SETTINGS };
  }

  return parseStoredSettings(snapshot.data() ?? {});
}

export async function updateLlmGenerationSettings(
  input: unknown,
  actorUid: string,
): Promise<ILlmGenerationSettings> {
  if (!isRecord(input)) {
    throw new Error('Settings payload must be an object.');
  }

  const settingsRef = getSettingsRef();
  const settings = await getAdminFirestore().runTransaction(
    async (transaction) => {
      const snapshot = await transaction.get(settingsRef);
      const current = snapshot.exists
        ? parseStoredSettings(snapshot.data() ?? {})
        : { ...DEFAULT_LLM_GENERATION_SETTINGS };
      const nextSettings = normalizeRuntimeSettings(input, current);
      const document: FirebaseFirestore.DocumentData = {
        ...nextSettings,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedBy: actorUid,
      };

      if (nextSettings.thinkingBudget === undefined) {
        document.thinkingBudget = admin.firestore.FieldValue.delete();
      }

      transaction.set(settingsRef, document, { merge: true });
      return nextSettings;
    },
  );

  return {
    ...settings,
    updatedAt: new Date().toISOString(),
    updatedBy: actorUid,
  };
}
