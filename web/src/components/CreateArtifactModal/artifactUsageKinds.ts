import type { GenerationKind } from '@shared-types';
import type { CreateArtifactModalType } from '../CreateArtifactModal/ICreateArtifactModal';

export const ARTIFACT_MODAL_USAGE_KINDS: Record<CreateArtifactModalType, GenerationKind> = {
  quizzes: 'quiz',
  cards: 'flashcards',
  slides: 'slideDeckText',
  diagramQuizzes: 'diagramQuiz',
  sequenceQuizzes: 'sequenceQuiz',
};
