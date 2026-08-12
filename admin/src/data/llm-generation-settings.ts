import 'server-only';

import * as admin from 'firebase-admin';
import type {
  ILlmGenerationFlowOverrides,
  ILlmGenerationFlows,
  ILlmGenerationProfileOverrides,
  ILlmGenerationProfiles,
  ILlmGenerationRuntimeSettings,
  ILlmGenerationSettings,
  LlmGenerationFlowId,
  LlmGenerationProfileId,
} from '@shared-types';
import {
  DEFAULT_LLM_GENERATION_SETTINGS,
  LLM_GENERATION_FLOW_IDS,
  LLM_GENERATION_PROFILE_IDS,
  LLM_GENERATION_SETTINGS_LIMITS,
  resolveLlmGenerationFlowRuntimeSettings,
  resolveLlmGenerationProfileSettings,
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

function parseProfileOverrides(
  data: unknown,
): ILlmGenerationProfileOverrides | undefined {
  if (!isRecord(data)) {
    return undefined;
  }

  const overrides: ILlmGenerationProfileOverrides = {};

  const maxOutputTokens = getNumericValue(
    data,
    'maxOutputTokens',
    undefined,
    LLM_GENERATION_SETTINGS_LIMITS.maxOutputTokens,
    { integer: true },
  );
  if (maxOutputTokens !== undefined) {
    overrides.maxOutputTokens = maxOutputTokens;
  }

  const temperature = getNumericValue(
    data,
    'temperature',
    undefined,
    LLM_GENERATION_SETTINGS_LIMITS.temperature,
  );
  if (temperature !== undefined) {
    overrides.temperature = temperature;
  }

  const topK = getNumericValue(
    data,
    'topK',
    undefined,
    LLM_GENERATION_SETTINGS_LIMITS.topK,
    { integer: true },
  );
  if (topK !== undefined) {
    overrides.topK = topK;
  }

  const topP = getNumericValue(
    data,
    'topP',
    undefined,
    LLM_GENERATION_SETTINGS_LIMITS.topP,
  );
  if (topP !== undefined) {
    overrides.topP = topP;
  }

  if (typeof data.disableReasoning === 'boolean') {
    overrides.disableReasoning = data.disableReasoning;
  }

  const thinkingBudget = getNumericValue(
    data,
    'thinkingBudget',
    undefined,
    LLM_GENERATION_SETTINGS_LIMITS.thinkingBudget,
    { integer: true },
  );
  if (thinkingBudget !== undefined) {
    overrides.thinkingBudget = thinkingBudget;
  }

  return Object.keys(overrides).length > 0 ? overrides : undefined;
}

function parseStoredProfiles(data: unknown): ILlmGenerationProfiles | undefined {
  if (!isRecord(data) || !isRecord(data.profiles)) {
    return undefined;
  }

  const profiles: ILlmGenerationProfiles = {};
  for (const profileId of LLM_GENERATION_PROFILE_IDS) {
    const parsed = parseProfileOverrides(data.profiles[profileId]);
    if (parsed) {
      profiles[profileId] = parsed;
    }
  }

  return Object.keys(profiles).length > 0 ? profiles : undefined;
}

function parseStoredFlows(data: unknown): ILlmGenerationFlows | undefined {
  if (!isRecord(data) || !isRecord(data.flows)) {
    return undefined;
  }

  const flows: ILlmGenerationFlows = {};
  for (const flowId of LLM_GENERATION_FLOW_IDS) {
    const parsed = parseProfileOverrides(data.flows[flowId]);
    if (parsed) {
      flows[flowId] = parsed;
    }
  }

  return Object.keys(flows).length > 0 ? flows : undefined;
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

  const profiles = parseStoredProfiles(data);
  const flows = parseStoredFlows(data);

  return {
    ...runtimeSettings,
    ...(profiles ? { profiles } : {}),
    ...(flows ? { flows } : {}),
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

function normalizeProfileOverrides(
  input: unknown,
  profileId: LlmGenerationProfileId,
  current: ILlmGenerationSettings,
): ILlmGenerationProfileOverrides {
  if (!isRecord(input)) {
    throw new Error(`Profile "${profileId}" must be an object.`);
  }

  const currentEffective = resolveLlmGenerationProfileSettings(
    current,
    profileId,
    current.profiles,
  );

  const disableReasoning =
    input.disableReasoning === undefined
      ? currentEffective.disableReasoning
      : input.disableReasoning;
  if (typeof disableReasoning !== 'boolean') {
    throw new Error(`Profile "${profileId}" disableReasoning must be a boolean.`);
  }

  const overrides: ILlmGenerationProfileOverrides = {
    maxOutputTokens:
      normalizeNumericSetting(
        input,
        'maxOutputTokens',
        currentEffective.maxOutputTokens,
        LLM_GENERATION_SETTINGS_LIMITS.maxOutputTokens,
        { integer: true },
      ) ?? currentEffective.maxOutputTokens,
    temperature:
      normalizeNumericSetting(
        input,
        'temperature',
        currentEffective.temperature,
        LLM_GENERATION_SETTINGS_LIMITS.temperature,
      ) ?? currentEffective.temperature,
    topK:
      normalizeNumericSetting(
        input,
        'topK',
        currentEffective.topK,
        LLM_GENERATION_SETTINGS_LIMITS.topK,
        { integer: true },
      ) ?? currentEffective.topK,
    topP:
      normalizeNumericSetting(
        input,
        'topP',
        currentEffective.topP,
        LLM_GENERATION_SETTINGS_LIMITS.topP,
      ) ?? currentEffective.topP,
    disableReasoning,
  };

  const thinkingBudget =
    input.thinkingBudget === null
      ? undefined
      : normalizeNumericSetting(
          input,
          'thinkingBudget',
          currentEffective.thinkingBudget,
          LLM_GENERATION_SETTINGS_LIMITS.thinkingBudget,
          { integer: true },
        );
  if (thinkingBudget !== undefined) {
    overrides.thinkingBudget = thinkingBudget;
  }

  return overrides;
}

function normalizeProfilesInput(
  input: unknown,
  current: ILlmGenerationSettings,
): ILlmGenerationProfiles | undefined {
  if (input === undefined) {
    return current.profiles;
  }

  if (!isRecord(input)) {
    throw new Error('profiles must be an object.');
  }

  const profiles: ILlmGenerationProfiles = {};
  for (const profileId of LLM_GENERATION_PROFILE_IDS) {
    if (input[profileId] !== undefined) {
      profiles[profileId] = normalizeProfileOverrides(
        input[profileId],
        profileId,
        current,
      );
    } else if (current.profiles?.[profileId]) {
      profiles[profileId] = current.profiles[profileId];
    }
  }

  return Object.keys(profiles).length > 0 ? profiles : undefined;
}

function normalizeFlowOverrides(
  input: unknown,
  flowId: LlmGenerationFlowId,
  current: ILlmGenerationSettings,
): ILlmGenerationFlowOverrides {
  if (!isRecord(input)) {
    throw new Error(`Flow "${flowId}" must be an object.`);
  }

  const currentEffective = resolveLlmGenerationFlowRuntimeSettings(current, {
    flowId,
    storedFlows: current.flows,
  });

  const disableReasoning =
    input.disableReasoning === undefined
      ? currentEffective.disableReasoning
      : input.disableReasoning;
  if (typeof disableReasoning !== 'boolean') {
    throw new Error(`Flow "${flowId}" disableReasoning must be a boolean.`);
  }

  const overrides: ILlmGenerationFlowOverrides = {
    maxOutputTokens:
      normalizeNumericSetting(
        input,
        'maxOutputTokens',
        currentEffective.maxOutputTokens,
        LLM_GENERATION_SETTINGS_LIMITS.maxOutputTokens,
        { integer: true },
      ) ?? currentEffective.maxOutputTokens,
    temperature:
      normalizeNumericSetting(
        input,
        'temperature',
        currentEffective.temperature,
        LLM_GENERATION_SETTINGS_LIMITS.temperature,
      ) ?? currentEffective.temperature,
    disableReasoning,
  };

  const thinkingBudget =
    input.thinkingBudget === null
      ? undefined
      : normalizeNumericSetting(
          input,
          'thinkingBudget',
          currentEffective.thinkingBudget,
          LLM_GENERATION_SETTINGS_LIMITS.thinkingBudget,
          { integer: true },
        );
  if (thinkingBudget !== undefined) {
    overrides.thinkingBudget = thinkingBudget;
  }

  return overrides;
}

function normalizeFlowsInput(
  input: unknown,
  current: ILlmGenerationSettings,
): ILlmGenerationFlows | undefined {
  if (input === undefined) {
    return current.flows;
  }

  if (!isRecord(input)) {
    throw new Error('flows must be an object.');
  }

  const flows: ILlmGenerationFlows = {};
  for (const flowId of LLM_GENERATION_FLOW_IDS) {
    if (input[flowId] !== undefined) {
      flows[flowId] = normalizeFlowOverrides(input[flowId], flowId, current);
    } else if (current.flows?.[flowId]) {
      flows[flowId] = current.flows[flowId];
    }
  }

  return Object.keys(flows).length > 0 ? flows : undefined;
}

export function getEffectiveLlmGenerationProfileSettings(
  settings: ILlmGenerationSettings,
  profileId: LlmGenerationProfileId,
): ILlmGenerationRuntimeSettings {
  return resolveLlmGenerationProfileSettings(
    settings,
    profileId,
    settings.profiles,
  );
}

export function getEffectiveLlmGenerationFlowSettings(
  settings: ILlmGenerationSettings,
  flowId: LlmGenerationFlowId,
): ILlmGenerationRuntimeSettings {
  return resolveLlmGenerationFlowRuntimeSettings(settings, {
    flowId,
    storedFlows: settings.flows,
  });
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
      // Profiles are code-only in admin UI. Preserve any legacy Firestore
      // profiles when the client omits them; never clear on a flows-only save.
      const nextProfiles =
        input.profiles === undefined
          ? current.profiles
          : normalizeProfilesInput(input.profiles, current);
      const nextFlows = normalizeFlowsInput(input.flows, current);
      const document: FirebaseFirestore.DocumentData = {
        ...nextSettings,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedBy: actorUid,
      };

      if (nextSettings.thinkingBudget === undefined) {
        document.thinkingBudget = admin.firestore.FieldValue.delete();
      }

      if (nextProfiles) {
        document.profiles = nextProfiles;
      } else {
        document.profiles = admin.firestore.FieldValue.delete();
      }

      if (nextFlows) {
        document.flows = nextFlows;
      } else {
        document.flows = admin.firestore.FieldValue.delete();
      }

      transaction.set(settingsRef, document, { merge: true });
      return {
        ...nextSettings,
        ...(nextProfiles ? { profiles: nextProfiles } : {}),
        ...(nextFlows ? { flows: nextFlows } : {}),
      };
    },
  );

  return {
    ...settings,
    updatedAt: new Date().toISOString(),
    updatedBy: actorUid,
  };
}
