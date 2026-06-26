import type { ILlmSetupRoutes } from '@shared-types';
import { z } from 'zod';

const modalityRouteSchema = z.object({
  providerType: z.enum(['gemini', 'openrouter', 'minimax']),
  model: z.string().trim().min(1, 'Model is required'),
});

export const llmSetupFormSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  description: z.string().optional(),
  textProviderType: modalityRouteSchema.shape.providerType,
  textModel: modalityRouteSchema.shape.model,
  visionProviderType: modalityRouteSchema.shape.providerType,
  visionModel: modalityRouteSchema.shape.model,
  imageProviderType: modalityRouteSchema.shape.providerType,
  imageModel: modalityRouteSchema.shape.model,
});

export type ILlmSetupFormValues = z.infer<typeof llmSetupFormSchema>;

export function toLlmSetupRoutes(values: ILlmSetupFormValues): ILlmSetupRoutes {
  return {
    text: { providerType: values.textProviderType, model: values.textModel.trim() },
    vision: { providerType: values.visionProviderType, model: values.visionModel.trim() },
    image: { providerType: values.imageProviderType, model: values.imageModel.trim() },
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
    textProviderType: routes.text.providerType,
    textModel: routes.text.model,
    visionProviderType: routes.vision.providerType,
    visionModel: routes.vision.model,
    imageProviderType: routes.image.providerType,
    imageModel: routes.image.model,
  };
}
