import 'server-only';

import type {
  IProviderAvailableModel,
  LlmModality,
  LlmProviderKind,
  ProviderModelSyncSource,
} from '@shared-types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function uniqueModalities(modalities: LlmModality[]): LlmModality[] {
  return (['text', 'vision', 'image'] as const).filter((modality) =>
    modalities.includes(modality)
  );
}

function buildModel(
  id: string,
  label: string,
  modalities: LlmModality[]
): IProviderAvailableModel | null {
  const normalizedId = id.trim();
  if (!normalizedId) {
    return null;
  }

  const supportedModalities = uniqueModalities(modalities);
  if (supportedModalities.length === 0) {
    return null;
  }

  const normalizedLabel = label.trim() || normalizedId;
  return {
    id: normalizedId,
    label: normalizedLabel,
    supportedModalities,
  };
}

function dedupeModels(models: IProviderAvailableModel[]): IProviderAvailableModel[] {
  const byId = new Map<string, IProviderAvailableModel>();

  for (const model of models) {
    const existing = byId.get(model.id);
    if (!existing) {
      byId.set(model.id, model);
      continue;
    }

    byId.set(model.id, {
      id: model.id,
      label: existing.label || model.label,
      supportedModalities: uniqueModalities([
        ...existing.supportedModalities,
        ...model.supportedModalities,
      ]),
    });
  }

  return Array.from(byId.values()).sort((a, b) => a.label.localeCompare(b.label));
}

function includesAny(haystack: string, needles: string[]): boolean {
  const lower = haystack.toLowerCase();
  return needles.some((needle) => lower.includes(needle));
}

function normalizeGeminiModels(payload: unknown): IProviderAvailableModel[] {
  if (!isRecord(payload) || !Array.isArray(payload.models)) {
    return [];
  }

  const models: IProviderAvailableModel[] = [];

  for (const entry of payload.models) {
    if (!isRecord(entry) || typeof entry.name !== 'string') {
      continue;
    }

    const rawName = entry.name.trim();
    const id = rawName.startsWith('models/') ? rawName.slice('models/'.length) : rawName;
    const label =
      typeof entry.displayName === 'string' && entry.displayName.trim()
        ? entry.displayName.trim()
        : id;

    const methods = Array.isArray(entry.supportedGenerationMethods)
      ? entry.supportedGenerationMethods.filter(
          (method): method is string => typeof method === 'string'
        )
      : [];

    const lowerId = id.toLowerCase();
    if (
      includesAny(lowerId, ['embedding', 'aqa', 'gecko', 'embed']) ||
      methods.includes('embedContent')
    ) {
      continue;
    }

    const modalities: LlmModality[] = [];
    const isImageModel =
      includesAny(lowerId, ['imagen', 'image']) || methods.includes('predict');

    if (isImageModel) {
      modalities.push('image');
    }

    if (methods.includes('generateContent') || methods.length === 0) {
      // Gemini generateContent models are typically multimodal text+vision.
      modalities.push('text', 'vision');
    }

    const model = buildModel(id, label, modalities);
    if (model) {
      models.push(model);
    }
  }

  return dedupeModels(models);
}

function parseOpenRouterModalities(architecture: unknown): LlmModality[] {
  if (!isRecord(architecture) || typeof architecture.modality !== 'string') {
    return [];
  }

  const modality = architecture.modality.toLowerCase();
  const [inputPart = '', outputPart = ''] = modality.split('->');
  const input = inputPart;
  const output = outputPart;
  const result: LlmModality[] = [];

  if (output.includes('image') || modality.includes('text->image')) {
    result.push('image');
  }

  if (output.includes('text') || (!output && input.includes('text'))) {
    result.push('text');
    if (input.includes('image')) {
      result.push('vision');
    }
  }

  return uniqueModalities(result);
}

function normalizeOpenRouterModels(payload: unknown): IProviderAvailableModel[] {
  if (!isRecord(payload) || !Array.isArray(payload.data)) {
    return [];
  }

  const models: IProviderAvailableModel[] = [];

  for (const entry of payload.data) {
    if (!isRecord(entry) || typeof entry.id !== 'string') {
      continue;
    }

    const id = entry.id.trim();
    const label =
      typeof entry.name === 'string' && entry.name.trim() ? entry.name.trim() : id;
    let modalities = parseOpenRouterModalities(entry.architecture);

    if (modalities.length === 0) {
      // Conservative fallback: treat unknown OpenRouter chat models as text-only.
      modalities = ['text'];
    }

    const model = buildModel(id, label, modalities);
    if (model) {
      models.push(model);
    }
  }

  return dedupeModels(models);
}

function extractModelEntries(payload: unknown): unknown[] {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (isRecord(payload) && Array.isArray(payload.data)) {
    return payload.data;
  }

  return [];
}

function normalizeOpenAiStyleModels(
  payload: unknown,
  providerKind: 'minimax' | 'together'
): IProviderAvailableModel[] {
  const entries = extractModelEntries(payload);
  if (entries.length === 0) {
    return [];
  }

  const models: IProviderAvailableModel[] = [];

  for (const entry of entries) {
    if (!isRecord(entry)) {
      continue;
    }

    const id =
      typeof entry.id === 'string'
        ? entry.id.trim()
        : typeof entry.name === 'string'
          ? entry.name.trim()
          : '';
    if (!id) {
      continue;
    }

    const displayName =
      typeof entry.display_name === 'string' ? entry.display_name.trim() : '';
    const name = typeof entry.name === 'string' ? entry.name.trim() : '';
    const label =
      (displayName && displayName !== id ? displayName : '') ||
      (name && name !== id ? name : '') ||
      id;

    const type =
      typeof entry.type === 'string'
        ? entry.type.toLowerCase()
        : typeof entry.object === 'string'
          ? entry.object.toLowerCase()
          : '';
    const lowerId = id.toLowerCase();

    if (
      type === 'embedding' ||
      type === 'moderation' ||
      type === 'rerank' ||
      includesAny(lowerId, ['embed', 'embedding', 'rerank']) ||
      type.includes('embed')
    ) {
      continue;
    }

    const modalities: LlmModality[] = [];
    const isImage =
      type === 'image' ||
      type.includes('image') ||
      includesAny(lowerId, ['flux', 'image', 'sdxl', 'stable-diffusion', 'imagen']);

    if (isImage) {
      modalities.push('image');
    }

    const isChatOrLanguage =
      type === 'chat' ||
      type === 'language' ||
      type === 'code' ||
      type.includes('chat') ||
      type.includes('language') ||
      type.includes('text') ||
      type === '' ||
      (!isImage && providerKind === 'minimax');

    if (isChatOrLanguage && !isImage) {
      modalities.push('text');
      // MiniMax/Together chat endpoints are used for screenshot vision in-product;
      // mark chat models as vision-capable unless clearly non-chat.
      if (
        providerKind === 'minimax' ||
        providerKind === 'together' ||
        includesAny(lowerId, ['vision', 'vl', 'multimodal']) ||
        type.includes('vision')
      ) {
        modalities.push('vision');
      }
    }

    if (modalities.length === 0 && !isImage) {
      modalities.push('text');
    }

    const model = buildModel(id, label, modalities);
    if (model) {
      models.push(model);
    }
  }

  return dedupeModels(models);
}

export function normalizeProviderModels(
  providerKind: LlmProviderKind,
  payload: unknown
): IProviderAvailableModel[] {
  switch (providerKind) {
    case 'gemini':
      return normalizeGeminiModels(payload);
    case 'openrouter':
      return normalizeOpenRouterModels(payload);
    case 'minimax':
      return normalizeOpenAiStyleModels(payload, 'minimax');
    case 'together':
      return normalizeOpenAiStyleModels(payload, 'together');
    default: {
      const _exhaustive: never = providerKind;
      return _exhaustive;
    }
  }
}

export function parseAvailableModels(value: unknown): IProviderAvailableModel[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const models: IProviderAvailableModel[] = [];

  for (const entry of value) {
    if (!isRecord(entry) || typeof entry.id !== 'string') {
      continue;
    }

    const modalities = Array.isArray(entry.supportedModalities)
      ? entry.supportedModalities.filter(
          (modality): modality is LlmModality =>
            modality === 'text' || modality === 'vision' || modality === 'image'
        )
      : [];

    const model = buildModel(
      entry.id,
      typeof entry.label === 'string' ? entry.label : entry.id,
      modalities
    );
    if (model) {
      models.push(model);
    }
  }

  return dedupeModels(models);
}

export function parseModelsSyncSource(
  value: unknown
): ProviderModelSyncSource | undefined {
  if (value === 'provider-test' || value === 'provider-save') {
    return value;
  }
  return undefined;
}

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

export function assertModelInCatalog(
  models: IProviderAvailableModel[],
  modelId: string,
  modality: LlmModality,
  label: string,
  connectionLabel: string
): void {
  if (models.length === 0) {
    throw new Error(
      `${label}: ${connectionLabel} has no uploaded model catalog. Test or save the provider connection to sync models.`
    );
  }

  if (!isModelInCatalogForModality(models, modelId, modality)) {
    throw new Error(
      `${label}: model "${modelId}" is not in the ${connectionLabel} catalog for ${modality}.`
    );
  }
}
