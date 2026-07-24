import type {
  ArtifactGate,
  ArtifactGateFailure,
} from '../artifact-agent/artifact-agent-definition';
import type { IFlashcardDraft } from './flashcard-types';
import {
  LANGUAGE_LEARNING_CONFIDENCE_THRESHOLD,
  PLANNED_FLASHCARD_COUNT,
  TARGET_FLASHCARD_COUNT,
} from './flashcard-types';
import {
  buildLearnedTermSet,
  cardMatchesLearnedTerm,
  normalizePlanTermIdentity,
} from './flashcard-chunked-types';
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

  if (draft.flashcards.length > TARGET_FLASHCARD_COUNT) {
    failures.push({
      gateId: 'schema',
      severity: 'warning',
      message: `Flashcard set has ${draft.flashcards.length} cards; expected ${PLANNED_FLASHCARD_COUNT}`,
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

function learnedExcludeGateFailures(draft: IFlashcardDraft): ArtifactGateFailure[] {
  const learnedSet = buildLearnedTermSet(draft.learnedTerms);
  if (learnedSet.size === 0) {
    return [];
  }

  const isLanguageLearning =
    draft.classification.isLanguageLearning
    && draft.classification.confidence >= LANGUAGE_LEARNING_CONFIDENCE_THRESHOLD;

  const failures: ArtifactGateFailure[] = [];
  draft.flashcards.forEach((card, index) => {
    if (cardMatchesLearnedTerm(card, learnedSet, isLanguageLearning)) {
      const label = isLanguageLearning ? card.term?.trim() || card.front : card.front;
      failures.push({
        gateId: 'learnedExclude',
        severity: 'blocker',
        message: `Card ${index + 1} reuses learned vocabulary: ${label}`,
        path: `flashcards[${index}]`,
      });
    }
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

export const flashcardCardCountGate: ArtifactGate<IFlashcardDraft> = {
  id: 'cardCount',
  async run(draft: IFlashcardDraft) {
    if (!Array.isArray(draft.flashcards) || draft.flashcards.length === 0) {
      return [];
    }
    if (draft.flashcards.length === PLANNED_FLASHCARD_COUNT) {
      return [];
    }
    return [
      {
        gateId: 'cardCount',
        severity: 'blocker',
        message: `Flashcard set has ${draft.flashcards.length} cards; need exactly ${PLANNED_FLASHCARD_COUNT}`,
        path: 'flashcards',
      },
    ];
  },
};

export const flashcardLearnedExcludeGate: ArtifactGate<IFlashcardDraft> = {
  id: 'learnedExclude',
  async run(draft: IFlashcardDraft) {
    return learnedExcludeGateFailures(draft);
  },
};

export const flashcardGates: ArtifactGate<IFlashcardDraft>[] = [
  flashcardSchemaGate,
  flashcardCardCountGate,
  flashcardLanguageShapeGate,
  flashcardLearnedExcludeGate,
];

export function findFlashcardRepairSlotIndexes(draft: IFlashcardDraft): number[] {
  const isLanguageLearning =
    draft.classification.isLanguageLearning
    && draft.classification.confidence >= LANGUAGE_LEARNING_CONFIDENCE_THRESHOLD;
  const learnedSet = buildLearnedTermSet(draft.learnedTerms);
  const badIndexes: number[] = [];

  for (let index = 0; index < PLANNED_FLASHCARD_COUNT; index += 1) {
    const card = draft.flashcards[index];
    const missing = !card?.front?.trim() || !card?.back?.trim();
    const learned = card ? cardMatchesLearnedTerm(card, learnedSet, isLanguageLearning) : false;
    if (missing || learned) {
      badIndexes.push(index);
    }
  }

  return badIndexes;
}

export function buildFlashcardExcludedTerms(draft: IFlashcardDraft): string[] {
  const isLanguageLearning =
    draft.classification.isLanguageLearning
    && draft.classification.confidence >= LANGUAGE_LEARNING_CONFIDENCE_THRESHOLD;

  const excluded = new Set<string>();
  for (const term of draft.plannedTerms) {
    const identity = normalizePlanTermIdentity(term, isLanguageLearning);
    if (identity) {
      excluded.add(term.trim());
    }
  }
  for (const term of draft.learnedTerms) {
    if (term.trim()) {
      excluded.add(term.trim());
    }
  }

  return [...excluded];
}
