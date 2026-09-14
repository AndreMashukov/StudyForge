import { useSelector } from 'react-redux';
import { useFlashcardStudyTelemetry } from '../../../../hooks/useFlashcardStudyTelemetry';
import {
  selectFlashcardSetActiveQueue,
  selectFlashcardSetCurrentIndex,
  selectFlashcardSetOutcomes,
  selectFlashcardSetSessionStartedAtMs,
} from '../../../../store/slices/flashcardSetPageSlice';
import type { FlashcardSet } from '@shared-types';

export const useFlashcardSetPageEffects = (
  flashcardSet: FlashcardSet | null | undefined,
) => {
  const currentIndex = useSelector(selectFlashcardSetCurrentIndex);
  const activeQueue = useSelector(selectFlashcardSetActiveQueue);
  const outcomes = useSelector(selectFlashcardSetOutcomes);
  const sessionStartedAtMs = useSelector(selectFlashcardSetSessionStartedAtMs);

  const isSessionComplete =
    activeQueue.length > 0 && currentIndex >= activeQueue.length;

  useFlashcardStudyTelemetry({
    flashcardSet,
    outcomes,
    sessionStartedAtMs,
    isSessionComplete,
  });
};
