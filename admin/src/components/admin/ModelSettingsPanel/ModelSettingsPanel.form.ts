import type {
  IOpenRouterProviderConnection,
  IUpdateOpenRouterSettingsRequest,
} from '@shared-types';
import { z } from 'zod';

const optionalModelField = z
  .string()
  .trim()
  .optional()
  .or(z.literal(''));

export const modelSettingsPanelSchema = z.object({
  enabled: z.boolean(),
  baseUrl: z
    .string()
    .trim()
    .min(1, 'Base URL is required')
    .url('Enter a valid URL'),
  defaultModel: z
    .string()
    .trim()
    .min(1, 'Default text model is required'),
  defaultVisionModel: optionalModelField,
  defaultImageModel: z
    .string()
    .trim()
    .min(1, 'Default image model is required'),
  apiKey: z.string().optional(),
});

export type IModelSettingsFormValues = z.infer<typeof modelSettingsPanelSchema>;

export function getModelSettingsDefaultValues(
  connection: IOpenRouterProviderConnection
): IModelSettingsFormValues {
  return {
    enabled: connection.enabled,
    baseUrl: connection.baseUrl,
    defaultModel: connection.defaultModel,
    defaultVisionModel: connection.defaultVisionModel ?? '',
    defaultImageModel: connection.defaultImageModel ?? '',
    apiKey: '',
  };
}

export function normalizeModelSettingsSubmitPayload(
  values: IModelSettingsFormValues
): IUpdateOpenRouterSettingsRequest {
  const trimmedVisionModel = values.defaultVisionModel?.trim();

  return {
    enabled: values.enabled,
    baseUrl: values.baseUrl.trim(),
    defaultModel: values.defaultModel.trim(),
    defaultVisionModel: trimmedVisionModel || undefined,
    defaultImageModel: values.defaultImageModel.trim(),
    apiKey: values.apiKey?.trim() ? values.apiKey : undefined,
  };
}
