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

export const openRouterSettingsFormSchema = z.object({
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

export type IOpenRouterSettingsFormValues = z.infer<
  typeof openRouterSettingsFormSchema
>;

export function getOpenRouterSettingsDefaultValues(
  connection: IOpenRouterProviderConnection
): IOpenRouterSettingsFormValues {
  return {
    baseUrl: connection.baseUrl,
    defaultModel: connection.defaultModel,
    defaultVisionModel: connection.defaultVisionModel ?? '',
    defaultImageModel: connection.defaultImageModel ?? '',
    apiKey: '',
  };
}

export function normalizeOpenRouterSettingsSubmitPayload(
  values: IOpenRouterSettingsFormValues
): IUpdateOpenRouterSettingsRequest {
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

/** @deprecated Use openRouterSettingsFormSchema */
export const modelSettingsPanelSchema = openRouterSettingsFormSchema;

/** @deprecated Use IOpenRouterSettingsFormValues */
export type IModelSettingsFormValues = IOpenRouterSettingsFormValues;

/** @deprecated Use getOpenRouterSettingsDefaultValues */
export const getModelSettingsDefaultValues = getOpenRouterSettingsDefaultValues;

/** @deprecated Use normalizeOpenRouterSettingsSubmitPayload */
export const normalizeModelSettingsSubmitPayload =
  normalizeOpenRouterSettingsSubmitPayload;
