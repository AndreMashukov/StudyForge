import { describe, expect, it } from 'vitest';
import { PLANNED_FLASHCARD_COUNT } from './flashcard-types';
import { flashcardCardCountGate, flashcardLearnedExcludeGate } from './flashcard-gates';
import type { IFlashcardDraft } from './flashcard-types';

function draftWithCards(count: number, learnedTerms: string[] = []): IFlashcardDraft {
  return {
    flashcards: Array.from({ length: count }, (_, index) => ({
      front: `Q${index + 1}`,
      back: `A${index + 1}`,
      term: `term${index + 1}`,
    })),
    plannedTerms: Array.from({ length: count }, (_, index) => `term${index + 1}`),
    learnedTerms,
    classification: {
      isLanguageLearning: true,
      confidence: 0.9,
      targetLanguageCode: 'yue',
      targetLanguageName: 'Cantonese',
    },
    appliedDescriptionRuleIds: [],
    generationModel: 'test',
    generationModelUsage: [],
  };
}

const gateContext = {
  userId: 'u',
  directoryId: 'd',
  recordId: 'r',
  jobId: 'j',
  artifactKind: 'flashcards' as const,
  documentIds: [],
  title: 't',
  enhancedPrompt: '',
  appliedRuleIds: [],
  followupRuleIds: [],
  sourceContent: { title: 't', content: 'c', wordCount: 1 },
};

describe('flashcardCardCountGate', () => {
  it(`blocks sets below ${PLANNED_FLASHCARD_COUNT} cards`, async () => {
    const failures = await flashcardCardCountGate.run(draftWithCards(5), gateContext);
    expect(failures).toHaveLength(1);
    expect(failures[0].gateId).toBe('cardCount');
  });

  it(`passes sets with exactly ${PLANNED_FLASHCARD_COUNT} cards`, async () => {
    const failures = await flashcardCardCountGate.run(
      draftWithCards(PLANNED_FLASHCARD_COUNT),
      gateContext
    );
    expect(failures).toEqual([]);
  });
});

describe('flashcardLearnedExcludeGate', () => {
  it('blocks cards that reuse learned vocabulary', async () => {
    const draft = draftWithCards(PLANNED_FLASHCARD_COUNT, ['term1']);
    const failures = await flashcardLearnedExcludeGate.run(draft, gateContext);
    expect(failures.some((failure) => failure.gateId === 'learnedExclude')).toBe(true);
  });
});
