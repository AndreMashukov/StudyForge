import { describe, expect, it, vi } from 'vitest';

import { createEmptyDiagnostics } from '../../artifact-definition';
import { ARTIFACT_PIPELINE_STATE_KEYS } from '../../artifact-pipeline-state-keys';
import type { IFlashcardDraft } from '../../flashcards/flashcard-types';
import { finalizeNode } from './nodes/finalize.node';
import type { FlashcardsDefinition } from './flashcards-state';
import { FlashcardsStateValue } from './flashcards-state';

const baseDraft: IFlashcardDraft = {
  flashcards: [{ front: 'a', back: 'b' }],
  plannedTerms: ['a'],
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
    [ARTIFACT_PIPELINE_STATE_KEYS.draft]: baseDraft,
    [ARTIFACT_PIPELINE_STATE_KEYS.diagnostics]: diagnostics,
    [ARTIFACT_PIPELINE_STATE_KEYS.gateFailures]: [],
    [ARTIFACT_PIPELINE_STATE_KEYS.generationModel]: 'test-model',
    [ARTIFACT_PIPELINE_STATE_KEYS.agentModel]: 'test-model',
    ...overrides,
  } as typeof FlashcardsStateValue.State;
}

describe('flashcards finalizeNode', () => {
  it('calls persistCompleted when gates pass', async () => {
    const persistCompleted = vi.fn().mockResolvedValue(undefined);
    const markFailed = vi.fn().mockResolvedValue(undefined);
    const definition = {
      artifactKind: 'flashcards',
      persistCompleted,
      markFailed,
    } as unknown as FlashcardsDefinition;

    const result = await finalizeNode(buildState(definition));
    expect(persistCompleted).toHaveBeenCalledOnce();
    expect(markFailed).not.toHaveBeenCalled();
    expect(result[ARTIFACT_PIPELINE_STATE_KEYS.outcome]).toBe('completed');
  });

  it('calls markFailed when outcome is failed', async () => {
    const persistCompleted = vi.fn().mockResolvedValue(undefined);
    const markFailed = vi.fn().mockResolvedValue(undefined);
    const definition = {
      artifactKind: 'flashcards',
      persistCompleted,
      markFailed,
    } as unknown as FlashcardsDefinition;

    const result = await finalizeNode(
      buildState(definition, {
        [ARTIFACT_PIPELINE_STATE_KEYS.outcome]: 'failed',
        [ARTIFACT_PIPELINE_STATE_KEYS.failureMessage]: 'Generation failed',
      })
    );
    expect(markFailed).toHaveBeenCalledOnce();
    expect(persistCompleted).not.toHaveBeenCalled();
    expect(result[ARTIFACT_PIPELINE_STATE_KEYS.outcome]).toBe('failed');
  });

  it('calls markFailed when blockers remain', async () => {
    const persistCompleted = vi.fn().mockResolvedValue(undefined);
    const markFailed = vi.fn().mockResolvedValue(undefined);
    const definition = {
      artifactKind: 'flashcards',
      persistCompleted,
      markFailed,
    } as unknown as FlashcardsDefinition;

    const result = await finalizeNode(
      buildState(definition, {
        [ARTIFACT_PIPELINE_STATE_KEYS.gateFailures]: [
          { gateId: 'count', severity: 'blocker', message: 'too few' },
        ],
      })
    );
    expect(markFailed).toHaveBeenCalledOnce();
    expect(persistCompleted).not.toHaveBeenCalled();
    expect(result[ARTIFACT_PIPELINE_STATE_KEYS.outcome]).toBe('failed');
  });
});
