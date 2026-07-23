import type { ArtifactRepairStrategy } from '../artifact-agent/artifact-agent-definition';
import { recordModelUsage } from '../artifact-agent/artifact-agent-definition';
import type {
  IFlashcardCardDraft,
  IFlashcardDraft,
  IFlashcardSlotArrays,
} from './flashcard-types';
import { LANGUAGE_LEARNING_CONFIDENCE_THRESHOLD, PLANNED_FLASHCARD_COUNT } from './flashcard-types';
import {
  buildFlashcardExcludedTerms,
  findFlashcardRepairSlotIndexes,
} from './flashcard-gates';
import {
  expandFlashcardSlotsForRepair,
  replanFlashcardReplacementTerms,
} from './flashcard-chunked-generator';

function ensureFlashcardArrayLength(
  flashcards: IFlashcardCardDraft[],
  plannedTerms: string[]
): IFlashcardSlotArrays {
  const nextCards = [...flashcards];
  const nextTerms = [...plannedTerms];

  while (nextCards.length < PLANNED_FLASHCARD_COUNT) {
    nextCards.push({ front: '', back: '' });
  }
  while (nextTerms.length < PLANNED_FLASHCARD_COUNT) {
    nextTerms.push('');
  }

  return {
    flashcards: nextCards.slice(0, PLANNED_FLASHCARD_COUNT),
    plannedTerms: nextTerms.slice(0, PLANNED_FLASHCARD_COUNT),
  };
}

export const flashcardRepairStrategy: ArtifactRepairStrategy<IFlashcardDraft> = {
  async repair(draft, failures, context, diagnostics) {
    const repairable = failures.some(
      (failure) =>
        failure.gateId === 'cardCount'
        || failure.gateId === 'learnedExclude'
        || failure.gateId === 'schema'
    );
    if (!repairable) {
      return draft;
    }

    const badIndexes = findFlashcardRepairSlotIndexes(draft);
    if (badIndexes.length === 0) {
      // Oversized drafts can pass every per-slot check while still failing cardCount.
      if (draft.flashcards.length > PLANNED_FLASHCARD_COUNT) {
        const normalized = ensureFlashcardArrayLength(draft.flashcards, draft.plannedTerms);
        return {
          ...draft,
          flashcards: normalized.flashcards,
          plannedTerms: normalized.plannedTerms,
        };
      }
      return draft;
    }

    const isLanguageLearning =
      draft.classification.isLanguageLearning
      && draft.classification.confidence >= LANGUAGE_LEARNING_CONFIDENCE_THRESHOLD;

    const descriptionRulesText =
      typeof context.extras?.descriptionRulesText === 'string'
        ? context.extras.descriptionRulesText
        : undefined;

    const excludedTerms = buildFlashcardExcludedTerms(draft);
    const startedAt = Date.now();

    const replacementTerms = await replanFlashcardReplacementTerms(context.userId, {
      content: context.sourceContent.content,
      rules: context.enhancedPrompt || undefined,
      descriptionRules: descriptionRulesText,
      options: isLanguageLearning
        ? {
            isLanguageLearning: true,
            targetLanguageName: draft.classification.targetLanguageName,
            learnedTerms: draft.learnedTerms,
          }
        : undefined,
      needed: badIndexes.length,
      excludedTerms,
    });

    const slots = badIndexes.map((index, slotOrder) => ({
      index,
      term: replacementTerms[slotOrder] ?? draft.plannedTerms[index] ?? '',
    }));

    const repairedCards = await expandFlashcardSlotsForRepair(context.userId, {
      content: context.sourceContent.content,
      rules: context.enhancedPrompt || undefined,
      descriptionRules: descriptionRulesText,
      options: isLanguageLearning
        ? {
            isLanguageLearning: true,
            targetLanguageName: draft.classification.targetLanguageName,
            learnedTerms: draft.learnedTerms,
          }
        : undefined,
      slots,
    });

    recordModelUsage(diagnostics, {
      role: 'repair',
      capability: 'flashcards',
      model: draft.generationModel,
      durationMs: Date.now() - startedAt,
    });

    const padded = ensureFlashcardArrayLength(draft.flashcards, draft.plannedTerms);
    const nextFlashcards = [...padded.flashcards];
    const nextPlannedTerms = [...padded.plannedTerms];

    for (const slot of slots) {
      const repaired = repairedCards.get(slot.index);
      if (!repaired) {
        continue;
      }
      nextFlashcards[slot.index] = repaired;
      nextPlannedTerms[slot.index] = slot.term;
    }

    return {
      ...draft,
      flashcards: nextFlashcards,
      plannedTerms: nextPlannedTerms,
    };
  },
};
