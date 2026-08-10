import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import type {
  ILlmGenerationProfileOverrides,
  ILlmGenerationProfiles,
  ILlmGenerationRuntimeSettings,
  ILlmGenerationSettings,
  LlmGenerationProfileId,
} from '@shared-types';
import {
  DEFAULT_LLM_GENERATION_SETTINGS,
  LLM_GENERATION_PROFILE_IDS,
  LLM_GENERATION_SETTINGS_LIMITS,
  resolveLlmGenerationProfileSettings,
} from '@shared-types';
import type { LlmTextConfig } from './types';

const ADMIN_SETTINGS_COLLECTION = 'adminSettings';
const LLM_GENERATION_SETTINGS_DOCUMENT = 'llmGeneration';

type NumericSettingKey = Exclude<
  keyof ILlmGenerationRuntimeSettings,
  'disableReasoning'
>;

interface INumericValidationOptions {
  integer?: boolean;
}

export interface IApplyLlmGenerationDefaultsOptions {
  profile?: LlmGenerationProfileId;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isValidNumber(
  value: unknown,
  limits: { min: number; max: number },
  options?: INumericValidationOptions,
): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= limits.min &&
    value <= limits.max &&
    (!options?.integer || Number.isInteger(value))
  );
}

function readNumericSetting(
  data: Record<string, unknown>,
  key: NumericSettingKey,
  fallback: number | undefined,
  options?: INumericValidationOptions,
): number | undefined {
  const limits = LLM_GENERATION_SETTINGS_LIMITS[key];
  const value = data[key];

  if (!isValidNumber(value, limits, options)) {
    return fallback;
  }

  return value;
}

function parseRuntimeSettings(data: unknown): ILlmGenerationRuntimeSettings {
  if (!isRecord(data)) {
    return { ...DEFAULT_LLM_GENERATION_SETTINGS };
  }

  const settings: ILlmGenerationRuntimeSettings = {
    requestTimeoutMs:
      readNumericSetting(
        data,
        'requestTimeoutMs',
        DEFAULT_LLM_GENERATION_SETTINGS.requestTimeoutMs,
        { integer: true },
      ) ?? DEFAULT_LLM_GENERATION_SETTINGS.requestTimeoutMs,
    maxOutputTokens:
      readNumericSetting(
        data,
        'maxOutputTokens',
        DEFAULT_LLM_GENERATION_SETTINGS.maxOutputTokens,
        { integer: true },
      ) ?? DEFAULT_LLM_GENERATION_SETTINGS.maxOutputTokens,
    temperature:
      readNumericSetting(
        data,
        'temperature',
        DEFAULT_LLM_GENERATION_SETTINGS.temperature,
      ) ?? DEFAULT_LLM_GENERATION_SETTINGS.temperature,
    topK:
      readNumericSetting(data, 'topK', DEFAULT_LLM_GENERATION_SETTINGS.topK, {
        integer: true,
      }) ?? DEFAULT_LLM_GENERATION_SETTINGS.topK,
    topP:
      readNumericSetting(data, 'topP', DEFAULT_LLM_GENERATION_SETTINGS.topP) ??
      DEFAULT_LLM_GENERATION_SETTINGS.topP,
    disableReasoning:
      typeof data.disableReasoning === 'boolean'
        ? data.disableReasoning
        : DEFAULT_LLM_GENERATION_SETTINGS.disableReasoning,
  };

  const thinkingBudget = readNumericSetting(data, 'thinkingBudget', undefined, {
    integer: true,
  });
  if (thinkingBudget !== undefined) {
    settings.thinkingBudget = thinkingBudget;
  }

  return settings;
}

function parseProfileOverrides(
  data: unknown,
): ILlmGenerationProfileOverrides | undefined {
  if (!isRecord(data)) {
    return undefined;
  }

  const overrides: ILlmGenerationProfileOverrides = {};

  const maxOutputTokens = readNumericSetting(
    data,
    'maxOutputTokens',
    undefined,
    { integer: true },
  );
  if (maxOutputTokens !== undefined) {
    overrides.maxOutputTokens = maxOutputTokens;
  }

  const temperature = readNumericSetting(data, 'temperature', undefined);
  if (temperature !== undefined) {
    overrides.temperature = temperature;
  }

  const topK = readNumericSetting(data, 'topK', undefined, { integer: true });
  if (topK !== undefined) {
    overrides.topK = topK;
  }

  const topP = readNumericSetting(data, 'topP', undefined);
  if (topP !== undefined) {
    overrides.topP = topP;
  }

  if (typeof data.disableReasoning === 'boolean') {
    overrides.disableReasoning = data.disableReasoning;
  }

  const thinkingBudget = readNumericSetting(data, 'thinkingBudget', undefined, {
    integer: true,
  });
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

function parseStoredSettings(data: unknown): ILlmGenerationSettings {
  const runtimeSettings = parseRuntimeSettings(data);
  const profiles = parseStoredProfiles(data);

  return profiles ? { ...runtimeSettings, profiles } : runtimeSettings;
}

async function readStoredSettingsDocument(): Promise<ILlmGenerationSettings> {
  let snapshot: admin.firestore.DocumentSnapshot;

  try {
    snapshot = await admin
      .firestore()
      .collection(ADMIN_SETTINGS_COLLECTION)
      .doc(LLM_GENERATION_SETTINGS_DOCUMENT)
      .get();
  } catch (error) {
    functions.logger.warn(
      'Failed to read LLM generation settings; using defaults',
      {
        error: error instanceof Error ? error.message : String(error),
      },
    );
    return { ...DEFAULT_LLM_GENERATION_SETTINGS };
  }

  if (!snapshot.exists) {
    return { ...DEFAULT_LLM_GENERATION_SETTINGS };
  }

  return parseStoredSettings(snapshot.data());
}

export async function readLlmGenerationSettings(): Promise<ILlmGenerationSettings> {
  return readStoredSettingsDocument();
}

export async function readLlmGenerationRuntimeSettings(): Promise<ILlmGenerationRuntimeSettings> {
  const settings = await readStoredSettingsDocument();
  const { profiles: _profiles, updatedAt: _updatedAt, updatedBy: _updatedBy, ...runtime } =
    settings;
  return runtime;
}

function mergeRuntimeWithOverrides(
  base: ILlmGenerationRuntimeSettings,
  overrides?: Partial<ILlmGenerationRuntimeSettings>,
): ILlmGenerationRuntimeSettings {
  if (!overrides) {
    return { ...base };
  }

  const merged: ILlmGenerationRuntimeSettings = {
    requestTimeoutMs: base.requestTimeoutMs,
    maxOutputTokens: overrides.maxOutputTokens ?? base.maxOutputTokens,
    temperature: overrides.temperature ?? base.temperature,
    topK: overrides.topK ?? base.topK,
    topP: overrides.topP ?? base.topP,
    disableReasoning: overrides.disableReasoning ?? base.disableReasoning,
  };

  const thinkingBudget =
    overrides.thinkingBudget !== undefined
      ? overrides.thinkingBudget
      : base.thinkingBudget;
  if (thinkingBudget !== undefined) {
    merged.thinkingBudget = thinkingBudget;
  }

  return merged;
}

export function resolveProfileRuntimeSettings(
  settings: ILlmGenerationSettings,
  profileId: LlmGenerationProfileId,
): ILlmGenerationRuntimeSettings {
  const { profiles, updatedAt: _updatedAt, updatedBy: _updatedBy, ...global } =
    settings;
  return resolveLlmGenerationProfileSettings(global, profileId, profiles);
}

export async function applyLlmGenerationDefaults(
  config: LlmTextConfig,
  options?: IApplyLlmGenerationDefaultsOptions,
): Promise<LlmTextConfig> {
  const settings = await readStoredSettingsDocument();
  const { profiles, updatedAt: _updatedAt, updatedBy: _updatedBy, ...global } =
    settings;

  const profileSettings = options?.profile
    ? resolveLlmGenerationProfileSettings(global, options.profile, profiles)
    : global;

  const resolved = mergeRuntimeWithOverrides(profileSettings, {
    requestTimeoutMs: config.requestTimeoutMs,
    maxOutputTokens: config.maxOutputTokens,
    temperature: config.temperature,
    topK: config.topK,
    topP: config.topP,
    disableReasoning: config.disableReasoning,
    thinkingBudget: config.thinkingBudget,
  });

  return {
    ...config,
    requestTimeoutMs: resolved.requestTimeoutMs,
    maxOutputTokens: resolved.maxOutputTokens,
    temperature: resolved.temperature,
    topK: resolved.topK,
    topP: resolved.topP,
    disableReasoning: resolved.disableReasoning,
    ...(resolved.thinkingBudget !== undefined
      ? { thinkingBudget: resolved.thinkingBudget }
      : {}),
  };
}
