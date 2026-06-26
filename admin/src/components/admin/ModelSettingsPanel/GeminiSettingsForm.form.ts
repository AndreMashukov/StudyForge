import type { IUpdateGeminiSettingsRequest } from '@shared-types';
import { z } from 'zod';
import type { IGeminiProviderConnection } from '@shared-types';

const optionalModelField = z
  .string()
  .trim()
  .optional()
  .or(z.literal(''));

export const geminiSettingsFormSchema = z.object({
  defaultModel: z.string().trim().min(1, 'Default text model is required'),
  defaultVisionModel: optionalModelField,
  defaultImageModel: optionalModelField,
  apiKey: z.string().optional(),
});

export type IGeminiSettingsFormValues = z.infer<typeof geminiSettingsFormSchema>;

export function getGeminiSettingsDefaultValues(
  connection: IGeminiProviderConnection
): IGeminiSettingsFormValues {
  return {
    defaultModel: connection.defaultModel,
    defaultVisionModel: connection.defaultVisionModel ?? '',
    defaultImageModel: connection.defaultImageModel ?? '',
    apiKey: '',
  };
}

export function normalizeGeminiSettingsSubmitPayload(
  values: IGeminiSettingsFormValues
): IUpdateGeminiSettingsRequest {
  const trimmedVisionModel = values.defaultVisionModel?.trim();
  const trimmedImageModel = values.defaultImageModel?.trim();

  return {
    defaultModel: values.defaultModel.trim(),
    defaultVisionModel: trimmedVisionModel || undefined,
    defaultImageModel: trimmedImageModel || undefined,
    apiKey: values.apiKey?.trim() ? values.apiKey : undefined,
  };
}
