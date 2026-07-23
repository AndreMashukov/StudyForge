import type { ArtifactRepairStrategy } from '../artifact-agent/artifact-agent-definition';
import { recordModelUsage } from '../artifact-agent/artifact-agent-definition';
import { LlmGenerationService } from '../llm';
import type { IFlashcardCardDraft, IFlashcardDraft } from './flashcard-types';
import {
  LANGUAGE_LEARNING_CONFIDENCE_THRESHOLD,
  MIN_FLASHCARD_COUNT,
  TARGET_FLASHCARD_COUNT,
} from './flashcard-types';
import { normalizeVocabularyTerm } from './learned-vocabulary';

function cardIdentity(card: IFlashcardCardDraft, isLanguageLearning: boolean): string {
  if (isLanguageLearning) {
    return normalizeVocabularyTerm(card.term ?? '') || card.front.trim().toLowerCase();
  }
  return card.front.trim().toLowerCase();
}

function mergeFlashcards(
  existing: IFlashcardCardDraft[],
  additions: IFlashcardCardDraft[],
  isLanguageLearning: boolean
): IFlashcardCardDraft[] {
  const merged = [...existing];
  const seen = new Set(
    merged
      .map((card) => cardIdentity(card, isLanguageLearning))
      .filter((value) => value.length > 0)
  );

  for (const card of additions) {
    if (merged.length >= TARGET_FLASHCARD_COUNT) {
      break;
    }
    const identity = cardIdentity(card, isLanguageLearning);
    if (!identity || seen.has(identity)) {
      continue;
    }
    seen.add(identity);
    merged.push(card);
  }

  return merged;
}

export const flashcardRepairStrategy: ArtifactRepairStrategy<IFlashcardDraft> = {
  async repair(draft, failures, context, diagnostics) {
    const countFailure = failures.find((failure) => failure.gateId === 'cardCount');
    if (!countFailure) {
      return draft;
    }

    const needed = Math.max(MIN_FLASHCARD_COUNT - draft.flashcards.length, 0);
    if (needed === 0) {
      return draft;
    }

    const isLanguageLearning =
      draft.classification.isLanguageLearning &&
      draft.classification.confidence >= LANGUAGE_LEARNING_CONFIDENCE_THRESHOLD;

    const existingLabels = draft.flashcards
      .map((card) => (isLanguageLearning ? card.term?.trim() || card.front : card.front))
      .filter((value): value is string => Boolean(value?.trim()));

    const descriptionRulesText =
      typeof context.extras?.descriptionRulesText === 'string'
        ? context.extras.descriptionRulesText
        : undefined;

    const startedAt = Date.now();
    const {
      flashcards: additions,
      generationModel,
      generationModelUsage,
    } = await LlmGenerationService.generateFlashcardTopUp(context.userId, {
      content: context.sourceContent.content,
      needed,
      existingLabels,
      rules: context.enhancedPrompt || undefined,
      descriptionRules: descriptionRulesText,
      options: isLanguageLearning
        ? {
            isLanguageLearning: true,
            targetLanguageName: draft.classification.targetLanguageName,
          }
        : undefined,
    });

    recordModelUsage(diagnostics, {
      role: 'repair',
      capability: 'flashcards',
      model: generationModel,
      durationMs: Date.now() - startedAt,
    });

    const merged = mergeFlashcards(draft.flashcards, additions, isLanguageLearning);

    return {
      ...draft,
      flashcards: merged,
      generationModelUsage: [...draft.generationModelUsage, ...generationModelUsage],
    };
  },
};
