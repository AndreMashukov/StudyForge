import { useCallback, useEffect, useRef } from 'react';
import type { FlashcardSet } from '@shared-types';
import type { FlashcardCardOutcome } from '../pages/FlashcardSetPage/types/IFlashcardSetPageContext';
import { useRecordFlashcardStudySessionMutation } from '../store/api/LearningTelemetry/learningTelemetryApi';

interface IUseFlashcardStudyTelemetryOptions {
  flashcardSet: FlashcardSet | null | undefined;
  outcomes: Record<string, FlashcardCardOutcome>;
  sessionStartedAtMs: number | null;
  isSessionComplete: boolean;
}

export const useFlashcardStudyTelemetry = ({
  flashcardSet,
  outcomes,
  sessionStartedAtMs,
  isSessionComplete,
}: IUseFlashcardStudyTelemetryOptions) => {
  const [recordSession] = useRecordFlashcardStudySessionMutation();
  const hasRecordedRef = useRef(false);
  const visitKeyRef = useRef<string | null>(null);
  const recordedKeysRef = useRef(new Set<string>());

  const latestRef = useRef({
    flashcardSet,
    outcomes,
    sessionStartedAtMs,
    isSessionComplete,
  });
  latestRef.current = {
    flashcardSet,
    outcomes,
    sessionStartedAtMs,
    isSessionComplete,
  };

  useEffect(() => {
    if (!flashcardSet?.id || !sessionStartedAtMs) {
      visitKeyRef.current = null;
      hasRecordedRef.current = false;
      return;
    }
    visitKeyRef.current = `${flashcardSet.id}:${sessionStartedAtMs}`;
    hasRecordedRef.current = false;
  }, [flashcardSet?.id, sessionStartedAtMs]);

  const recordSessionIfNeeded = useCallback(async (completedAt: number) => {
    const state = latestRef.current;
    if (!state.flashcardSet?.id || !state.sessionStartedAtMs || hasRecordedRef.current) {
      return;
    }

    const cards = Object.entries(state.outcomes).map(([cardId, outcome]) => ({
      cardId,
      outcome,
    }));
    if (cards.length === 0) return;

    const visitKey =
      visitKeyRef.current
      ?? `${state.flashcardSet.id}:${state.sessionStartedAtMs}`;
    if (recordedKeysRef.current.has(visitKey)) return;

    hasRecordedRef.current = true;
    recordedKeysRef.current.add(visitKey);

    try {
      await recordSession({
        flashcardSetId: state.flashcardSet.id,
        startedAt: new Date(state.sessionStartedAtMs).toISOString(),
        completedAt: new Date(completedAt).toISOString(),
        cards,
      }).unwrap();
    } catch {
      hasRecordedRef.current = false;
      recordedKeysRef.current.delete(visitKey);
    }
  }, [recordSession]);

  useEffect(() => {
    if (!flashcardSet?.id || !isSessionComplete) return;
    void recordSessionIfNeeded(Date.now());
  }, [flashcardSet?.id, isSessionComplete, outcomes, recordSessionIfNeeded]);

  useEffect(() => {
    const handlePageHide = () => {
      const state = latestRef.current;
      if (!state.flashcardSet?.id || state.isSessionComplete) return;
      void recordSessionIfNeeded(Date.now());
    };

    window.addEventListener('pagehide', handlePageHide);
    return () => {
      window.removeEventListener('pagehide', handlePageHide);
      const state = latestRef.current;
      if (!state.flashcardSet?.id || state.isSessionComplete) return;
      void recordSessionIfNeeded(Date.now());
    };
  }, [recordSessionIfNeeded]);
};
