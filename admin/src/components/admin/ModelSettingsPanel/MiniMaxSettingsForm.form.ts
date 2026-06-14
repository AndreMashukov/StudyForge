import type {
  IMiniMaxProviderConnection,
  IUpdateMiniMaxSettingsRequest,
} from '@shared-types';
import { z } from 'zod';

const optionalModelField = z
  .string()
  .trim()
  .optional()
  .or(z.literal(''));

export const miniMaxSettingsFormSchema = z.object({
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
  imageGenerationUrl: z
    .string()
    .trim()
    .min(1, 'Image generation URL is required')
    .url('Enter a valid URL'),
  apiKey: z.string().optional(),
});

export type IMiniMaxSettingsFormValues = z.infer<
  typeof miniMaxSettingsFormSchema
>;

export function getMiniMaxSettingsDefaultValues(
  connection: IMiniMaxProviderConnection
): IMiniMaxSettingsFormValues {
  return {
    baseUrl: connection.baseUrl,
    defaultModel: connection.defaultModel,
    defaultVisionModel: connection.defaultVisionModel ?? '',
    defaultImageModel: connection.defaultImageModel ?? '',
    imageGenerationUrl: connection.imageGenerationUrl,
    apiKey: '',
  };
}

export function normalizeMiniMaxSettingsSubmitPayload(
  values: IMiniMaxSettingsFormValues
): IUpdateMiniMaxSettingsRequest {
  const trimmedVisionModel = values.defaultVisionModel?.trim();
  const trimmedImageModel = values.defaultImageModel?.trim();

  return {
    baseUrl: values.baseUrl.trim(),
    defaultModel: values.defaultModel.trim(),
    defaultVisionModel: trimmedVisionModel || undefined,
    defaultImageModel: trimmedImageModel || undefined,
    imageGenerationUrl: values.imageGenerationUrl.trim(),
    apiKey: values.apiKey?.trim() ? values.apiKey : undefined,
  };
}
