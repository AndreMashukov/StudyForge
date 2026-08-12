import type {
  ILlmGenerationFlowOverrides,
  ILlmGenerationSettings,
  IUpdateLlmGenerationSettingsRequest,
  LlmGenerationFlowId,
} from '@shared-types';
import {
  DEFAULT_LLM_GENERATION_SETTINGS,
  LLM_GENERATION_FLOW_IDS,
  LLM_GENERATION_FLOW_METADATA,
  LLM_GENERATION_SETTINGS_LIMITS,
  resolveLlmGenerationFlowRuntimeSettings,
} from '@shared-types';
import { z } from 'zod';

const numericBounds = LLM_GENERATION_SETTINGS_LIMITS;

const stepRuntimeSchema = z.object({
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
  flows: z.object(
    Object.fromEntries(
      LLM_GENERATION_FLOW_IDS.map((flowId) => [flowId, stepRuntimeSchema]),
    ) as Record<LlmGenerationFlowId, typeof stepRuntimeSchema>,
  ),
});

export type ILlmGenerationSettingsFormValues = z.infer<
  typeof llmGenerationSettingsFormSchema
>;

export type IFlowRuntimeFormValues =
  ILlmGenerationSettingsFormValues['flows'][LlmGenerationFlowId];

function getFlowDefaultValues(
  settings: ILlmGenerationSettings,
  flowId: LlmGenerationFlowId,
): IFlowRuntimeFormValues {
  const effective = resolveLlmGenerationFlowRuntimeSettings(settings, {
    flowId,
    storedFlows: settings.flows,
  });
  return {
    maxOutputTokens:
      effective.maxOutputTokens ??
      DEFAULT_LLM_GENERATION_SETTINGS.maxOutputTokens,
    temperature:
      effective.temperature ?? DEFAULT_LLM_GENERATION_SETTINGS.temperature,
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
    flows: Object.fromEntries(
      LLM_GENERATION_FLOW_IDS.map((flowId) => [
        flowId,
        getFlowDefaultValues(settings, flowId),
      ]),
    ) as ILlmGenerationSettingsFormValues['flows'],
  };
}

export function normalizeLlmGenerationSettingsSubmitPayload(
  values: ILlmGenerationSettingsFormValues,
): IUpdateLlmGenerationSettingsRequest {
  const flows = Object.fromEntries(
    LLM_GENERATION_FLOW_IDS.map((flowId) => {
      const flowValues = values.flows[flowId];
      const flowPayload: ILlmGenerationFlowOverrides = {
        maxOutputTokens: flowValues.maxOutputTokens,
        temperature: flowValues.temperature,
        disableReasoning: flowValues.disableReasoning,
      };

      if (flowValues.thinkingBudget !== undefined) {
        flowPayload.thinkingBudget = flowValues.thinkingBudget;
      }

      return [flowId, flowPayload];
    }),
  ) as ILlmGenerationSettings['flows'];

  return {
    requestTimeoutMs: values.requestTimeoutMs,
    maxOutputTokens: values.maxOutputTokens,
    temperature: values.temperature,
    topK: values.topK,
    topP: values.topP,
    disableReasoning: values.disableReasoning,
    thinkingBudget: values.thinkingBudget ?? null,
    flows,
  };
}

export { LLM_GENERATION_FLOW_METADATA };
