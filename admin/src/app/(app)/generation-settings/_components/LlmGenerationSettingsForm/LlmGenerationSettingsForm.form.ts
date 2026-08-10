import type {
  ILlmGenerationProfileOverrides,
  ILlmGenerationSettings,
  IUpdateLlmGenerationSettingsRequest,
  LlmGenerationProfileId,
} from '@shared-types';
import {
  DEFAULT_LLM_GENERATION_SETTINGS,
  LLM_GENERATION_PROFILE_IDS,
  LLM_GENERATION_PROFILE_METADATA,
  LLM_GENERATION_SETTINGS_LIMITS,
  resolveLlmGenerationProfileSettings,
} from '@shared-types';
import { z } from 'zod';

const numericBounds = LLM_GENERATION_SETTINGS_LIMITS;

const profileRuntimeSchema = z.object({
  maxOutputTokens: z
    .number()
    .int('Max output tokens must be a whole number')
    .min(numericBounds.maxOutputTokens.min, 'Max output tokens must be at least 1')
    .max(
      numericBounds.maxOutputTokens.max,
      `Max output tokens must be at most ${numericBounds.maxOutputTokens.max}`,
    ),
  temperature: z
    .number()
    .min(numericBounds.temperature.min, 'Temperature must be 0 or greater')
    .max(numericBounds.temperature.max, 'Temperature must be 2 or lower'),
  topK: z
    .number()
    .int('Top K must be a whole number')
    .min(numericBounds.topK.min, 'Top K must be at least 1')
    .max(numericBounds.topK.max, `Top K must be at most ${numericBounds.topK.max}`),
  topP: z
    .number()
    .min(numericBounds.topP.min, 'Top P must be 0 or greater')
    .max(numericBounds.topP.max, 'Top P must be 1 or lower'),
  disableReasoning: z.boolean(),
  thinkingBudget: z
    .number()
    .int('Thinking budget must be a whole number')
    .min(numericBounds.thinkingBudget.min, 'Thinking budget must be 0 or greater')
    .max(
      numericBounds.thinkingBudget.max,
      `Thinking budget must be at most ${numericBounds.thinkingBudget.max}`,
    )
    .optional(),
});

export const llmGenerationSettingsFormSchema = z.object({
  requestTimeoutMs: z
    .number()
    .int('Request timeout must be a whole number of milliseconds')
    .min(
      numericBounds.requestTimeoutMs.min,
      `Request timeout must be at least ${numericBounds.requestTimeoutMs.min}ms`,
    )
    .max(
      numericBounds.requestTimeoutMs.max,
      `Request timeout must be at most ${numericBounds.requestTimeoutMs.max}ms`,
    ),
  maxOutputTokens: z
    .number()
    .int('Max output tokens must be a whole number')
    .min(
      numericBounds.maxOutputTokens.min,
      'Max output tokens must be at least 1',
    )
    .max(
      numericBounds.maxOutputTokens.max,
      `Max output tokens must be at most ${numericBounds.maxOutputTokens.max}`,
    ),
  temperature: z
    .number()
    .min(numericBounds.temperature.min, 'Temperature must be 0 or greater')
    .max(numericBounds.temperature.max, 'Temperature must be 2 or lower'),
  topK: z
    .number()
    .int('Top K must be a whole number')
    .min(numericBounds.topK.min, 'Top K must be at least 1')
    .max(
      numericBounds.topK.max,
      `Top K must be at most ${numericBounds.topK.max}`,
    ),
  topP: z
    .number()
    .min(numericBounds.topP.min, 'Top P must be 0 or greater')
    .max(numericBounds.topP.max, 'Top P must be 1 or lower'),
  disableReasoning: z.boolean(),
  thinkingBudget: z
    .number()
    .int('Thinking budget must be a whole number')
    .min(
      numericBounds.thinkingBudget.min,
      'Thinking budget must be 0 or greater',
    )
    .max(
      numericBounds.thinkingBudget.max,
      `Thinking budget must be at most ${numericBounds.thinkingBudget.max}`,
    )
    .optional(),
  profiles: z.object(
    Object.fromEntries(
      LLM_GENERATION_PROFILE_IDS.map((profileId) => [
        profileId,
        profileRuntimeSchema,
      ]),
    ) as Record<LlmGenerationProfileId, typeof profileRuntimeSchema>,
  ),
});

export type ILlmGenerationSettingsFormValues = z.infer<
  typeof llmGenerationSettingsFormSchema
>;

export type IProfileRuntimeFormValues =
  ILlmGenerationSettingsFormValues['profiles'][LlmGenerationProfileId];

function getProfileDefaultValues(
  settings: ILlmGenerationSettings,
  profileId: LlmGenerationProfileId,
): IProfileRuntimeFormValues {
  const effective = resolveLlmGenerationProfileSettings(
    settings,
    profileId,
    settings.profiles,
  );
  return {
    maxOutputTokens:
      effective.maxOutputTokens ??
      DEFAULT_LLM_GENERATION_SETTINGS.maxOutputTokens,
    temperature:
      effective.temperature ?? DEFAULT_LLM_GENERATION_SETTINGS.temperature,
    topK: effective.topK ?? DEFAULT_LLM_GENERATION_SETTINGS.topK,
    topP: effective.topP ?? DEFAULT_LLM_GENERATION_SETTINGS.topP,
    disableReasoning:
      effective.disableReasoning ??
      DEFAULT_LLM_GENERATION_SETTINGS.disableReasoning,
    thinkingBudget: effective.thinkingBudget,
  };
}

export function getLlmGenerationSettingsDefaultValues(
  settings: ILlmGenerationSettings,
): ILlmGenerationSettingsFormValues {
  return {
    requestTimeoutMs:
      settings.requestTimeoutMs ??
      DEFAULT_LLM_GENERATION_SETTINGS.requestTimeoutMs,
    maxOutputTokens:
      settings.maxOutputTokens ??
      DEFAULT_LLM_GENERATION_SETTINGS.maxOutputTokens,
    temperature:
      settings.temperature ?? DEFAULT_LLM_GENERATION_SETTINGS.temperature,
    topK: settings.topK ?? DEFAULT_LLM_GENERATION_SETTINGS.topK,
    topP: settings.topP ?? DEFAULT_LLM_GENERATION_SETTINGS.topP,
    disableReasoning:
      settings.disableReasoning ??
      DEFAULT_LLM_GENERATION_SETTINGS.disableReasoning,
    thinkingBudget: settings.thinkingBudget,
    profiles: Object.fromEntries(
      LLM_GENERATION_PROFILE_IDS.map((profileId) => [
        profileId,
        getProfileDefaultValues(settings, profileId),
      ]),
    ) as ILlmGenerationSettingsFormValues['profiles'],
  };
}

export function normalizeLlmGenerationSettingsSubmitPayload(
  values: ILlmGenerationSettingsFormValues,
): IUpdateLlmGenerationSettingsRequest {
  const profiles = Object.fromEntries(
    LLM_GENERATION_PROFILE_IDS.map((profileId) => {
      const profileValues = values.profiles[profileId];
      const profilePayload: ILlmGenerationProfileOverrides = {
        maxOutputTokens: profileValues.maxOutputTokens,
        temperature: profileValues.temperature,
        topK: profileValues.topK,
        topP: profileValues.topP,
        disableReasoning: profileValues.disableReasoning,
      };

      if (profileValues.thinkingBudget !== undefined) {
        profilePayload.thinkingBudget = profileValues.thinkingBudget;
      }

      return [profileId, profilePayload];
    }),
  ) as ILlmGenerationSettings['profiles'];

  return {
    requestTimeoutMs: values.requestTimeoutMs,
    maxOutputTokens: values.maxOutputTokens,
    temperature: values.temperature,
    topK: values.topK,
    topP: values.topP,
    disableReasoning: values.disableReasoning,
    thinkingBudget: values.thinkingBudget ?? null,
    profiles,
  };
}

export { LLM_GENERATION_PROFILE_METADATA };
