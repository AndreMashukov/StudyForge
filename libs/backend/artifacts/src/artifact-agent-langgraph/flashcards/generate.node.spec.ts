import { describe, expect, it, vi } from 'vitest';

import { createEmptyDiagnostics } from '../../artifact-definition';
import { ARTIFACT_PIPELINE_STATE_KEYS } from '../../artifact-pipeline-state-keys';
import type { IFlashcardDraft } from '../../flashcards/flashcard-types';
import { generateNode } from './nodes/generate.node';
import type { FlashcardsDefinition } from './flashcards-state';
import { FlashcardsStateValue } from './flashcards-state';

const baseDraft: IFlashcardDraft = {
  flashcards: [],
  plannedTerms: [],
  learnedTerms: [],
  classification: { isLanguageLearning: false, confidence: 0 },
  appliedDescriptionRuleIds: [],
  generationModel: 'test-model',
  generationModelUsage: [],
};

function buildState(
  definition: FlashcardsDefinition,
  overrides: Record<string, unknown> = {}
) {
  const diagnostics = createEmptyDiagnostics(definition);
  diagnostics.modelUsage.push({
    role: 'generator',
    capability: 'flashcards',
    model: 'test-model',
  });
  return {
    [ARTIFACT_PIPELINE_STATE_KEYS.definition]: definition,
    [ARTIFACT_PIPELINE_STATE_KEYS.context]: {
      userId: 'user-1',
      directoryId: 'dir-1',
      recordId: 'rec-1',
      jobId: 'job-1',
      artifactKind: 'flashcards',
      documentIds: ['doc-1'],
      title: 'Test flashcards',
      enhancedPrompt: '',
      appliedRuleIds: [],
      followupRuleIds: [],
      sourceContent: { title: 'Doc', content: 'content', wordCount: 1 },
    },
    [ARTIFACT_PIPELINE_STATE_KEYS.diagnostics]: diagnostics,
    ...overrides,
  } as typeof FlashcardsStateValue.State;
}

describe('flashcards generateNode', () => {
  it('writes draft and model labels on success without changing outcome', () => {
    const definition = {
      artifactKind: 'flashcards',
      generate: vi.fn().mockResolvedValue(baseDraft),
    } as unknown as FlashcardsDefinition;

    return generateNode(buildState(definition)).then((result) => {
      expect(result[ARTIFACT_PIPELINE_STATE_KEYS.draft]).toEqual(baseDraft);
      expect(result[ARTIFACT_PIPELINE_STATE_KEYS.generationModel]).toBeDefined();
      expect(result[ARTIFACT_PIPELINE_STATE_KEYS.agentModel]).toBeDefined();
      expect(result[ARTIFACT_PIPELINE_STATE_KEYS.outcome]).toBeUndefined();
    });
  });

  it('sets failed outcome on LLM error without throwing', async () => {
    const definition = {
      artifactKind: 'flashcards',
      generate: vi.fn().mockRejectedValue(new Error('LLM unavailable')),
    } as unknown as FlashcardsDefinition;

    const result = await generateNode(buildState(definition));
    expect(result[ARTIFACT_PIPELINE_STATE_KEYS.outcome]).toBe('failed');
    expect(result[ARTIFACT_PIPELINE_STATE_KEYS.failureMessage]).toBe(
      'LLM unavailable'
    );
  });
});
