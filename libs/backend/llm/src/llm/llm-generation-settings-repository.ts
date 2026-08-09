import * as admin from 'firebase-admin';
import type { ILlmGenerationRuntimeSettings } from '@shared-types';
import {
  DEFAULT_LLM_GENERATION_SETTINGS,
  LLM_GENERATION_SETTINGS_LIMITS,
} from '@shared-types';
import type { LlmTextConfig } from './types';

const ADMIN_SETTINGS_COLLECTION = 'adminSettings';
const LLM_GENERATION_SETTINGS_DOCUMENT = 'llmGeneration';

type NumericSettingKey = Exclude<
  keyof ILlmGenerationRuntimeSettings,
  'disableReasoning'
>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isValidNumber(
  value: unknown,
  limits: { min: number; max: number },
  options?: { integer?: boolean }
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
  options?: { integer?: boolean }
): number | undefined {
  const limits = LLM_GENERATION_SETTINGS_LIMITS[key];
  const value = data[key];

  if (!isValidNumber(value, limits, options)) {
    return fallback;
  }

  return value;
}

function parseStoredSettings(
  data: unknown
): ILlmGenerationRuntimeSettings {
  if (!isRecord(data)) {
    return { ...DEFAULT_LLM_GENERATION_SETTINGS };
  }

  const settings: ILlmGenerationRuntimeSettings = {
    requestTimeoutMs:
      readNumericSetting(
        data,
        'requestTimeoutMs',
        DEFAULT_LLM_GENERATION_SETTINGS.requestTimeoutMs,
        { integer: true }
      ) ?? DEFAULT_LLM_GENERATION_SETTINGS.requestTimeoutMs,
    maxOutputTokens:
      readNumericSetting(
        data,
        'maxOutputTokens',
        DEFAULT_LLM_GENERATION_SETTINGS.maxOutputTokens,
        { integer: true }
      ) ?? DEFAULT_LLM_GENERATION_SETTINGS.maxOutputTokens,
    temperature:
      readNumericSetting(
        data,
        'temperature',
        DEFAULT_LLM_GENERATION_SETTINGS.temperature
      ) ?? DEFAULT_LLM_GENERATION_SETTINGS.temperature,
    topK:
      readNumericSetting(
        data,
        'topK',
        DEFAULT_LLM_GENERATION_SETTINGS.topK,
        { integer: true }
      ) ?? DEFAULT_LLM_GENERATION_SETTINGS.topK,
    topP:
      readNumericSetting(data, 'topP', DEFAULT_LLM_GENERATION_SETTINGS.topP) ??
      DEFAULT_LLM_GENERATION_SETTINGS.topP,
    disableReasoning:
      typeof data.disableReasoning === 'boolean'
        ? data.disableReasoning
        : DEFAULT_LLM_GENERATION_SETTINGS.disableReasoning,
  };

  const thinkingBudget = readNumericSetting(
    data,
    'thinkingBudget',
    undefined,
    { integer: true }
  );
  if (thinkingBudget !== undefined) {
    settings.thinkingBudget = thinkingBudget;
  }

  return settings;
}

export async function readLlmGenerationRuntimeSettings(): Promise<ILlmGenerationRuntimeSettings> {
  const snapshot = await admin
    .firestore()
    .collection(ADMIN_SETTINGS_COLLECTION)
    .doc(LLM_GENERATION_SETTINGS_DOCUMENT)
    .get();

  if (!snapshot.exists) {
    return { ...DEFAULT_LLM_GENERATION_SETTINGS };
  }

  return parseStoredSettings(snapshot.data());
}

export async function applyLlmGenerationDefaults(
  config: LlmTextConfig
): Promise<LlmTextConfig> {
  const settings = await readLlmGenerationRuntimeSettings();
  const withThinkingBudget =
    config.thinkingBudget !== undefined
      ? { thinkingBudget: config.thinkingBudget }
      : settings.thinkingBudget !== undefined
        ? { thinkingBudget: settings.thinkingBudget }
        : {};

  return {
    ...config,
    requestTimeoutMs: config.requestTimeoutMs ?? settings.requestTimeoutMs,
    maxOutputTokens: config.maxOutputTokens ?? settings.maxOutputTokens,
    temperature: config.temperature ?? settings.temperature,
    topK: config.topK ?? settings.topK,
    topP: config.topP ?? settings.topP,
    disableReasoning: config.disableReasoning ?? settings.disableReasoning,
    ...withThinkingBudget,
  };
}
