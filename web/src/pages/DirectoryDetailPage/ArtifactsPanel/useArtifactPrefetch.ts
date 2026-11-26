import { useCallback } from 'react';
import type { ArtifactSummaryType } from '@shared-types';
import { useAppDispatch } from '../../../hooks/redux';
import { quizApi } from '../../../store/api/Quiz/QuizApi';
import { flashcardsApi } from '../../../store/api/Flashcards/FlashcardsApi';
import { slideDecksApi } from '../../../store/api/SlideDecks/SlideDecksApi';
import { diagramQuizApi } from '../../../store/api/DiagramQuiz/DiagramQuizApi';
import { sequenceQuizApi } from '../../../store/api/SequenceQuiz/SequenceQuizApi';
import { matchQuizApi } from '../../../store/api/MatchQuiz/MatchQuizApi';

/** Warms the viewer's query for an artifact row the pointer is over. */
export function useArtifactPrefetch(): (
  type: ArtifactSummaryType,
  artifactId: string,
) => void {
  const dispatch = useAppDispatch();
  return useCallback(
    (type, artifactId) => {
      const options = { force: false };
      switch (type) {
        case 'quiz':
          dispatch(quizApi.util.prefetch('getQuiz', { quizId: artifactId }, options));
          return;
        case 'flashcard':
          dispatch(
            flashcardsApi.util.prefetch(
              'getFlashcardSet',
              { flashcardSetId: artifactId },
              options,
            ),
          );
          return;
        case 'slideDeck':
          dispatch(
            slideDecksApi.util.prefetch('getSlideDeck', { slideDeckId: artifactId }, options),
          );
          return;
        case 'diagramQuiz':
          dispatch(
            diagramQuizApi.util.prefetch(
              'getDiagramQuiz',
              { diagramQuizId: artifactId },
              options,
            ),
          );
          return;
        case 'sequenceQuiz':
          dispatch(
            sequenceQuizApi.util.prefetch(
              'getSequenceQuiz',
              { sequenceQuizId: artifactId },
              options,
            ),
          );
          return;
        case 'matchQuiz':
          dispatch(
            matchQuizApi.util.prefetch('getMatchQuiz', { matchQuizId: artifactId }, options),
          );
          return;
      }
    },
    [dispatch],
  );
}
