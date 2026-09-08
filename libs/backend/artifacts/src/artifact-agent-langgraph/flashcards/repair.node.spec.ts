import { describe, expect, it, vi } from 'vitest';

import { createEmptyDiagnostics } from '../../artifact-definition';
import { ARTIFACT_PIPELINE_STATE_KEYS } from '../../artifact-pipeline-state-keys';
import type { IFlashcardDraft } from '../../flashcards/flashcard-types';
import { repairNode } from './nodes/repair.node';
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
  repairLoopCount = 0
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
    [ARTIFACT_PIPELINE_STATE_KEYS.gateFailures]: [
      { gateId: 'count', severity: 'blocker', message: 'too few cards' },
    ],
    repair_loop_count: repairLoopCount,
  } as typeof FlashcardsStateValue.State;
}

describe('flashcards repairNode', () => {
  it('increments repair_loop_count on success', async () => {
    const repairedDraft = { ...baseDraft, flashcards: [{ front: 'a', back: 'b' }] };
    const definition = {
      artifactKind: 'flashcards',
      repair: {
        repair: vi.fn().mockResolvedValue(repairedDraft),
      },
    } as unknown as FlashcardsDefinition;

    const result = await repairNode(buildState(definition, 0));
    expect(result.repair_loop_count).toBe(1);
    expect(result[ARTIFACT_PIPELINE_STATE_KEYS.draft]).toEqual(repairedDraft);
  });

  it('increments from 1 to 2', async () => {
    const definition = {
      artifactKind: 'flashcards',
      repair: {
        repair: vi.fn().mockResolvedValue(baseDraft),
      },
    } as unknown as FlashcardsDefinition;

    const result = await repairNode(buildState(definition, 1));
    expect(result.repair_loop_count).toBe(2);
  });

  it('sets failed outcome on repair error without throwing', async () => {
    const definition = {
      artifactKind: 'flashcards',
      repair: {
        repair: vi.fn().mockRejectedValue(new Error('repair failed')),
      },
    } as unknown as FlashcardsDefinition;

    const result = await repairNode(buildState(definition, 0));
    expect(result[ARTIFACT_PIPELINE_STATE_KEYS.outcome]).toBe('failed');
    expect(result.repair_loop_count).toBe(1);
  });
});
