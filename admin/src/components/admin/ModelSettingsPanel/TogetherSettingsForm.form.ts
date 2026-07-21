import type {
  ITogetherProviderConnection,
  IUpdateTogetherSettingsRequest,
} from '@shared-types';
import { z } from 'zod';

const optionalModelField = z
  .string()
  .trim()
  .optional()
  .or(z.literal(''));

export const togetherSettingsFormSchema = z.object({
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
  defaultImageModel: optionalModelField,
  apiKey: z.string().optional(),
});

export type ITogetherSettingsFormValues = z.infer<
  typeof togetherSettingsFormSchema
>;

export function getTogetherSettingsDefaultValues(
  connection: ITogetherProviderConnection
): ITogetherSettingsFormValues {
  return {
    baseUrl: connection.baseUrl,
    defaultModel: connection.defaultModel,
    defaultVisionModel: connection.defaultVisionModel ?? '',
    defaultImageModel: connection.defaultImageModel ?? '',
    apiKey: '',
  };
}

export function normalizeTogetherSettingsSubmitPayload(
  values: ITogetherSettingsFormValues
): IUpdateTogetherSettingsRequest {
  const trimmedVisionModel = values.defaultVisionModel?.trim();
  const trimmedImageModel = values.defaultImageModel?.trim();

  return {
    baseUrl: values.baseUrl.trim(),
    defaultModel: values.defaultModel.trim(),
    defaultVisionModel: trimmedVisionModel || undefined,
    defaultImageModel: trimmedImageModel || undefined,
    apiKey: values.apiKey?.trim() ? values.apiKey : undefined,
  };
}
