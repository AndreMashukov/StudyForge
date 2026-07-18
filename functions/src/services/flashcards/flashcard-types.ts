import type { FlashcardLanguageClassification, IGenerationModelUsage } from '@shared-types';

export interface IFlashcardCardDraft {
  front: string;
  back: string;
  description?: string;
  frontHtml?: string;
  backHtml?: string;
  descriptionHtml?: string;
}

export interface IFlashcardDraft {
  flashcards: IFlashcardCardDraft[];
  classification: FlashcardLanguageClassification;
  appliedDescriptionRuleIds: string[];
  /** Audit from the route that generated `flashcards` — do not re-resolve at persist. */
  generationModel: string;
  generationModelUsage: IGenerationModelUsage[];
}

export interface IFlashcardJobPayload {
  descriptionRuleIds?: string[];
}

/** Minimum confidence required to treat a set as language-learning. */
export const LANGUAGE_LEARNING_CONFIDENCE_THRESHOLD = 0.75;
