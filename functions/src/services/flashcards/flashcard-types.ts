import type { FlashcardLanguageClassification, IGenerationModelUsage } from '@shared-types';

export interface IFlashcardCardDraft {
  /** Target-language lemma for language-learning sets (no presentation). */
  term?: string;
  front: string;
  back: string;
  description?: string;
  frontHtml?: string;
  backHtml?: string;
  descriptionHtml?: string;
}

export interface IFlashcardDraft {
  flashcards: IFlashcardCardDraft[];
  /** Slot-ordered terms from the planning phase (length PLANNED_FLASHCARD_COUNT when complete). */
  plannedTerms: string[];
  /** Normalized learned vocabulary excluded during generation (language-learning sets). */
  learnedTerms: string[];
  classification: FlashcardLanguageClassification;
  appliedDescriptionRuleIds: string[];
  /** Audit from the route that generated `flashcards` — do not re-resolve at persist. */
  generationModel: string;
  generationModelUsage: IGenerationModelUsage[];
}

export interface IFlashcardJobPayload {
  descriptionRuleIds?: string[];
}

/** Padded/truncated flashcard + planned-term arrays at PLANNED_FLASHCARD_COUNT. */
export interface IFlashcardSlotArrays {
  flashcards: IFlashcardCardDraft[];
  plannedTerms: string[];
}

/** Minimum confidence required to treat a set as language-learning. */
export const LANGUAGE_LEARNING_CONFIDENCE_THRESHOLD = 0.75;

/** Prompt and gate target for a complete flashcard set. */
export const PLANNED_FLASHCARD_COUNT = 12;
export const MIN_FLASHCARD_COUNT = PLANNED_FLASHCARD_COUNT;
export const TARGET_FLASHCARD_COUNT = PLANNED_FLASHCARD_COUNT;
