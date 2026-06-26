import type { ILlmSetupRoutes, IProviderConnectionCatalogEntry } from '@shared-types';
import { z } from 'zod';

export const llmSetupFormSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  description: z.string().optional(),
  textConnectionId: z.string().trim().min(1, 'Text provider connection is required'),
  textModel: z.string().trim().min(1, 'Model is required'),
  visionConnectionId: z.string().trim().min(1, 'Vision provider connection is required'),
  visionModel: z.string().trim().min(1, 'Model is required'),
  imageConnectionId: z.string().trim().min(1, 'Image provider connection is required'),
  imageModel: z.string().trim().min(1, 'Model is required'),
});

export type ILlmSetupFormValues = z.infer<typeof llmSetupFormSchema>;

export function toLlmSetupRoutes(values: ILlmSetupFormValues): ILlmSetupRoutes {
  return {
    text: { connectionId: values.textConnectionId.trim(), model: values.textModel.trim() },
    vision: { connectionId: values.visionConnectionId.trim(), model: values.visionModel.trim() },
    image: { connectionId: values.imageConnectionId.trim(), model: values.imageModel.trim() },
  };
}

export function routesToFormValues(
  name: string,
  description: string | undefined,
  routes: ILlmSetupRoutes
): ILlmSetupFormValues {
  return {
    name,
    description: description ?? '',
    textConnectionId: routes.text.connectionId,
    textModel: routes.text.model,
    visionConnectionId: routes.vision.connectionId,
    visionModel: routes.vision.model,
    imageConnectionId: routes.image.connectionId,
    imageModel: routes.image.model,
  };
}

export function filterConnectionsForModality(
  connections: IProviderConnectionCatalogEntry[],
  modality: 'text' | 'vision' | 'image'
): IProviderConnectionCatalogEntry[] {
  return connections.filter((connection) => connection.supportedModalities.includes(modality));
}
