import { describe, expect, it } from 'vitest';
import { MIN_FLASHCARD_COUNT } from './flashcard-types';
import { flashcardCardCountGate } from './flashcard-gates';
import type { IFlashcardDraft } from './flashcard-types';

function draftWithCards(count: number): IFlashcardDraft {
  return {
    flashcards: Array.from({ length: count }, (_, index) => ({
      front: `Q${index + 1}`,
      back: `A${index + 1}`,
    })),
    classification: { isLanguageLearning: false, confidence: 0.9 },
    appliedDescriptionRuleIds: [],
    generationModel: 'test',
    generationModelUsage: [],
  };
}

describe('flashcardCardCountGate', () => {
  it(`blocks sets below ${MIN_FLASHCARD_COUNT} cards`, async () => {
    const failures = await flashcardCardCountGate.run(draftWithCards(5), {
      userId: 'u',
      directoryId: 'd',
      recordId: 'r',
      jobId: 'j',
      artifactKind: 'flashcards',
      documentIds: [],
      title: 't',
      enhancedPrompt: '',
      appliedRuleIds: [],
      followupRuleIds: [],
      sourceContent: { title: 't', content: 'c', wordCount: 1 },
    });
    expect(failures).toHaveLength(1);
    expect(failures[0].gateId).toBe('cardCount');
  });

  it(`passes sets with at least ${MIN_FLASHCARD_COUNT} cards`, async () => {
    const failures = await flashcardCardCountGate.run(
      draftWithCards(MIN_FLASHCARD_COUNT),
      {
        userId: 'u',
        directoryId: 'd',
        recordId: 'r',
        jobId: 'j',
        artifactKind: 'flashcards',
        documentIds: [],
        title: 't',
        enhancedPrompt: '',
        appliedRuleIds: [],
        followupRuleIds: [],
        sourceContent: { title: 't', content: 'c', wordCount: 1 },
      }
    );
    expect(failures).toEqual([]);
  });
});
