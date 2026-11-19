import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import {
  assertModelInCatalog,
  carryOverDecisionModels,
  filterModelsForModality,
  normalizeProviderModels,
  parseAvailableModels,
} from './provider-model-catalog';

// Trimmed from OpenRouter `GET /api/v1/models?output_modalities=decisions`
// merged with `/models/user` entries, as the catalog sync does.
const OPENROUTER_PAYLOAD = {
  data: [
    {
      id: 'google/gemini-decision-1',
      name: 'Google: Gemini Decision 1',
      architecture: {
        modality: 'text+image+file+audio+video->decisions',
        output_modalities: ['decisions'],
      },
    },
    {
      id: 'typesafe/jev-1.13',
      name: 'TypeSafe: Jev 1.13',
      architecture: {
        modality: 'text+image->decisions',
        output_modalities: ['decisions'],
      },
    },
    {
      id: 'openai/gpt-chat',
      name: 'Chat model',
      architecture: { modality: 'text+image->text' },
    },
  ],
};

describe('OpenRouter decision models in the catalog', () => {
  const models = normalizeProviderModels('openrouter', OPENROUTER_PAYLOAD);

  it('classifies decision models as decision only', () => {
    expect(models.find((model) => model.id === 'google/gemini-decision-1')).toEqual({
      id: 'google/gemini-decision-1',
      label: 'Google: Gemini Decision 1',
      supportedModalities: ['decision'],
    });
    expect(
      models.find((model) => model.id === 'typesafe/jev-1.13')?.supportedModalities,
    ).toEqual(['decision']);
  });

  it('keeps decision models out of the text and vision lists', () => {
    expect(filterModelsForModality(models, 'text').map((model) => model.id)).toEqual([
      'openai/gpt-chat',
    ]);
    expect(
      filterModelsForModality(models, 'decision').map((model) => model.id).sort(),
    ).toEqual(['google/gemini-decision-1', 'typesafe/jev-1.13']);
  });

  it('validates a decision route against the catalog', () => {
    expect(() =>
      assertModelInCatalog(models, 'google/gemini-decision-1', 'decision', 'Prompt diagram check', 'OpenRouter'),
    ).not.toThrow();
    expect(() =>
      assertModelInCatalog(models, 'openai/gpt-chat', 'decision', 'Prompt diagram check', 'OpenRouter'),
    ).toThrow();
  });

  it('round-trips the decision modality through the stored catalog', () => {
    expect(parseAvailableModels(models)).toEqual(models);
  });
});

describe('carryOverDecisionModels', () => {
  const previous = [
    { id: 'typesafe/jev-1.13', label: 'Jev', supportedModalities: ['decision' as const] },
    { id: 'old/chat', label: 'Old chat', supportedModalities: ['text' as const] },
  ];

  it('keeps previous decision models when the new sync has none', () => {
    const next = [{ id: 'openai/gpt-chat', label: 'Chat', supportedModalities: ['text' as const] }];

    expect(carryOverDecisionModels(next, previous).map((model) => model.id)).toEqual([
      'openai/gpt-chat',
      'typesafe/jev-1.13',
    ]);
  });

  it('does not duplicate models already present', () => {
    const next = [
      { id: 'typesafe/jev-1.13', label: 'Jev 1.13', supportedModalities: ['decision' as const] },
    ];

    expect(carryOverDecisionModels(next, previous)).toEqual(next);
  });
});
