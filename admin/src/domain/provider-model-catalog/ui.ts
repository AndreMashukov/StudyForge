import type { IProviderAvailableModel, LlmModality } from '@shared-types';

export function filterModelsForModality(
  models: IProviderAvailableModel[],
  modality: LlmModality
): IProviderAvailableModel[] {
  return models.filter((model) => model.supportedModalities.includes(modality));
}

export function isModelInCatalogForModality(
  models: IProviderAvailableModel[],
  modelId: string,
  modality: LlmModality
): boolean {
  const normalized = modelId.trim();
  if (!normalized) {
    return false;
  }

  return filterModelsForModality(models, modality).some(
    (model) => model.id === normalized
  );
}

export function formatModelsSyncedAt(value?: string): string {
  if (!value) {
    return 'Never synced';
  }

  return new Date(value).toLocaleString();
}
