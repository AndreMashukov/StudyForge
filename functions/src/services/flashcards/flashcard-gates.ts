import type {
  ArtifactGate,
  ArtifactGateFailure,
} from '../artifact-agent/artifact-agent-definition';
import type { IFlashcardDraft } from './flashcard-types';
import { LANGUAGE_LEARNING_CONFIDENCE_THRESHOLD } from './flashcard-types';
import { normalizeVocabularyTerm } from './learned-vocabulary';

function schemaGateFailures(draft: IFlashcardDraft): ArtifactGateFailure[] {
  const failures: ArtifactGateFailure[] = [];

  if (!Array.isArray(draft.flashcards) || draft.flashcards.length === 0) {
    failures.push({
      gateId: 'schema',
      severity: 'blocker',
      message: 'Flashcard set must contain at least one card',
      path: 'flashcards',
    });
    return failures;
  }

  if (draft.flashcards.length > 40) {
    failures.push({
      gateId: 'schema',
      severity: 'warning',
      message: `Flashcard set has ${draft.flashcards.length} cards; prefer 10–20`,
      path: 'flashcards',
    });
  }

  draft.flashcards.forEach((card, index) => {
    if (!card.front?.trim() || !card.back?.trim()) {
      failures.push({
        gateId: 'schema',
        severity: 'blocker',
        message: `Card ${index + 1}: front and back are required`,
        path: `flashcards[${index}]`,
      });
    }
  });

  if (!draft.classification || typeof draft.classification.isLanguageLearning !== 'boolean') {
    failures.push({
      gateId: 'schema',
      severity: 'blocker',
      message: 'Missing language-learning classification',
      path: 'classification',
    });
  }

  return failures;
}

function languageShapeGateFailures(draft: IFlashcardDraft): ArtifactGateFailure[] {
  const failures: ArtifactGateFailure[] = [];
  const { classification } = draft;
  if (!classification?.isLanguageLearning) {
    return failures;
  }

  if (classification.confidence < LANGUAGE_LEARNING_CONFIDENCE_THRESHOLD) {
    return failures;
  }

  if (!classification.targetLanguageCode?.trim() || !classification.targetLanguageName?.trim()) {
    failures.push({
      gateId: 'languageShape',
      severity: 'blocker',
      message: 'Language-learning sets require targetLanguageCode and targetLanguageName',
      path: 'classification',
    });
  }

  const seen = new Set<string>();
  draft.flashcards.forEach((card, index) => {
    const term = card.term?.trim() ?? '';
    if (!term) {
      failures.push({
        gateId: 'languageShape',
        severity: 'blocker',
        message: `Card ${index + 1}: term is required for language-learning sets`,
        path: `flashcards[${index}].term`,
      });
      return;
    }

    const normalized = normalizeVocabularyTerm(term);
    if (!normalized) {
      failures.push({
        gateId: 'languageShape',
        severity: 'blocker',
        message: `Card ${index + 1}: term must be a target-language word or phrase`,
        path: `flashcards[${index}].term`,
      });
      return;
    }
    if (seen.has(normalized)) {
      failures.push({
        gateId: 'languageShape',
        severity: 'warning',
        message: `Duplicate vocabulary term: ${term}`,
        path: `flashcards[${index}].term`,
      });
    }
    seen.add(normalized);
  });

  return failures;
}

export const flashcardSchemaGate: ArtifactGate<IFlashcardDraft> = {
  id: 'schema',
  async run(draft: IFlashcardDraft) {
    return schemaGateFailures(draft);
  },
};

export const flashcardLanguageShapeGate: ArtifactGate<IFlashcardDraft> = {
  id: 'languageShape',
  async run(draft: IFlashcardDraft) {
    return languageShapeGateFailures(draft);
  },
};

export const flashcardGates: ArtifactGate<IFlashcardDraft>[] = [
  flashcardSchemaGate,
  flashcardLanguageShapeGate,
];
