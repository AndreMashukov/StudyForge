import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { FlashcardSet } from '@shared-types';
import {
  FlashcardCardOutcome,
  IFlashcardSetPageHandlers,
} from '../../types/IFlashcardSetPageContext';
import { useFullscreen } from '../../../../hooks/useFullscreen';
import { useRecordLearnedVocabularyMutation } from '../../../../store/api/Flashcards/FlashcardsApi';
import {
  advanceCurrentIndex,
  goToNextCard,
  goToPrevCard,
  initializeStudySession,
  markCardOutcome,
  restartStudySession,
  selectFlashcardSetActiveQueue,
  selectFlashcardSetCurrentIndex,
  selectFlashcardSetOutcomes,
  selectFlashcardSetQueueInitializedForSetId,
  startRetake,
} from '../../../../store/slices/flashcardSetPageSlice';

function buildInitialQueue(flashcardSet: FlashcardSet | null | undefined): string[] {
  return (flashcardSet?.flashcards ?? []).map((card) => card.id);
}

function hasRecordedOutcome(
  outcome: FlashcardCardOutcome | undefined
): outcome is FlashcardCardOutcome {
  return outcome === 'learned' || outcome === 'failed';
}

export const useFlashcardSetPageHandlers = (
  flashcardSet: FlashcardSet | null | undefined
): IFlashcardSetPageHandlers => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [isFlipped, setIsFlipped] = useState(false);
  const currentIndex = useSelector(selectFlashcardSetCurrentIndex);
  const activeQueue = useSelector(selectFlashcardSetActiveQueue);
  const outcomes = useSelector(selectFlashcardSetOutcomes);
  const queueInitializedForSetId = useSelector(selectFlashcardSetQueueInitializedForSetId);
  const { isFullscreen, handleToggleFullscreen } = useFullscreen();
  const [recordLearnedVocabulary] = useRecordLearnedVocabularyMutation();
  const isMarkingRef = useRef(false);

  const resolvedDirectoryId = useMemo(() => {
    const fromData = flashcardSet?.directoryId?.trim();
    const fromQuery = searchParams.get('directoryId')?.trim();
    return fromData || fromQuery || null;
  }, [flashcardSet?.directoryId, searchParams]);

  useEffect(() => {
    const setId = flashcardSet?.id;
    if (!setId || setId === queueInitializedForSetId) {
      return;
    }
    dispatch(
      initializeStudySession({
        setId,
        cardIds: buildInitialQueue(flashcardSet),
      })
    );
    setIsFlipped(false);
  }, [dispatch, flashcardSet, queueInitializedForSetId]);

  const learnedCount = useMemo(
    () => Object.values(outcomes).filter((outcome) => outcome === 'learned').length,
    [outcomes]
  );

  const failedCount = useMemo(
    () => Object.values(outcomes).filter((outcome) => outcome === 'failed').length,
    [outcomes]
  );

  const isSessionComplete = useMemo(
    () =>
      activeQueue.length > 0
      && activeQueue.every((cardId) => hasRecordedOutcome(outcomes[cardId])),
    [activeQueue, outcomes]
  );

  const canStartRetake = useMemo(
    () =>
      isSessionComplete
      && activeQueue.some((cardId) => outcomes[cardId] !== 'learned'),
    [activeQueue, isSessionComplete, outcomes]
  );

  const canAdvanceNext = useMemo(() => {
    if (isSessionComplete || currentIndex >= activeQueue.length - 1) {
      return false;
    }
    const cardId = activeQueue[currentIndex];
    return Boolean(cardId && hasRecordedOutcome(outcomes[cardId]));
  }, [activeQueue, currentIndex, isSessionComplete, outcomes]);

  const handleGoBack = useCallback(() => {
    if (resolvedDirectoryId) {
      navigate(`/directory/${resolvedDirectoryId}?tab=cards`);
    } else {
      navigate('/');
    }
  }, [navigate, resolvedDirectoryId]);

  const advanceAfterMark = useCallback(() => {
    setIsFlipped(false);
    dispatch(advanceCurrentIndex());
  }, [dispatch]);

  const handleNext = useCallback(() => {
    if (isMarkingRef.current || isSessionComplete) {
      return;
    }

    const cardId = activeQueue[currentIndex];
    if (!cardId || !hasRecordedOutcome(outcomes[cardId])) {
      return;
    }

    setIsFlipped(false);
    dispatch(goToNextCard());
  }, [activeQueue, currentIndex, dispatch, isSessionComplete, outcomes]);

  const handlePrev = useCallback(() => {
    if (isMarkingRef.current) {
      return;
    }
    setIsFlipped(false);
    dispatch(goToPrevCard());
  }, [dispatch]);

  const handleFlip = useCallback(() => setIsFlipped((prev) => !prev), []);

  const handleMarkLearned = useCallback(async () => {
    const cardId = activeQueue[currentIndex];
    if (!cardId || !flashcardSet || isMarkingRef.current) {
      return;
    }

    if (outcomes[cardId] === 'learned') {
      advanceAfterMark();
      return;
    }

    if (flashcardSet.isLanguageLearning) {
      isMarkingRef.current = true;
      try {
        await recordLearnedVocabulary({
          flashcardSetId: flashcardSet.id,
          flashcardId: cardId,
        }).unwrap();
      } catch {
        // Keep the learner on this card; do not mark learned or advance.
        return;
      } finally {
        isMarkingRef.current = false;
      }
    }

    dispatch(markCardOutcome({ cardId, outcome: 'learned' }));
    advanceAfterMark();
  }, [
    activeQueue,
    advanceAfterMark,
    currentIndex,
    dispatch,
    flashcardSet,
    outcomes,
    recordLearnedVocabulary,
  ]);

  const handleMarkFailed = useCallback(() => {
    const cardId = activeQueue[currentIndex];
    if (!cardId || isMarkingRef.current) {
      return;
    }

    // Persistence API only upserts learned vocabulary — there is no unlearn/delete.
    // After a successful learned mark on a language set, do not allow a later failed re-mark.
    if (outcomes[cardId] === 'learned' && flashcardSet?.isLanguageLearning) {
      return;
    }

    dispatch(markCardOutcome({ cardId, outcome: 'failed' }));
    advanceAfterMark();
  }, [
    activeQueue,
    advanceAfterMark,
    currentIndex,
    dispatch,
    flashcardSet?.isLanguageLearning,
    outcomes,
  ]);

  const handleStartRetake = useCallback(() => {
    // Failed cards, plus any still-ungraded IDs if present, stay available for retake.
    const retakeIds = activeQueue.filter((cardId) => outcomes[cardId] !== 'learned');
    if (retakeIds.length === 0) {
      return;
    }

    dispatch(startRetake());
    setIsFlipped(false);
  }, [activeQueue, dispatch, outcomes]);

  const handleRestart = useCallback(() => {
    dispatch(restartStudySession({ cardIds: buildInitialQueue(flashcardSet) }));
    setIsFlipped(false);
  }, [dispatch, flashcardSet]);

  return {
    currentIndex,
    isFlipped,
    isFullscreen,
    activeQueue,
    learnedCount,
    failedCount,
    isSessionComplete,
    canStartRetake,
    canAdvanceNext,
    handleGoBack,
    handleNext,
    handlePrev,
    handleFlip,
    handleMarkLearned,
    handleMarkFailed,
    handleStartRetake,
    handleRestart,
    handleToggleFullscreen,
  };
};
