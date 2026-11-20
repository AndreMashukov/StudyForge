import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import {
  DiagramQuiz,
  isAnsweredQuizInput,
  MatchQuiz,
  Quiz,
  QuizTelemetryType,
  RecordQuizAttemptAnswerInput,
  SequenceQuiz,
} from '@shared-types';
import { useRecordQuizAttemptMutation } from '../store/api/LearningTelemetry/learningTelemetryApi';

type TrackableQuiz = Quiz | DiagramQuiz | SequenceQuiz | MatchQuiz | null;

interface IUseQuizLearningTelemetryOptions {
  quiz: TrackableQuiz;
  quizType: QuizTelemetryType;
  isCompleted: boolean;
  startedAtMs: number | null;
  completedAtMs: number | null;
  answers: RecordQuizAttemptAnswerInput[];
}

interface ILatestTelemetryState {
  quiz: TrackableQuiz;
  quizType: QuizTelemetryType;
  isCompleted: boolean;
  startedAtMs: number | null;
  completedAtMs: number | null;
  answers: RecordQuizAttemptAnswerInput[];
}

export const useQuizLearningTelemetry = ({
  quiz,
  quizType,
  isCompleted,
  startedAtMs,
  completedAtMs,
  answers,
}: IUseQuizLearningTelemetryOptions) => {
  const [recordQuizAttempt] = useRecordQuizAttemptMutation();
  const recordedAttemptKeysRef = useRef(new Set<string>());
  const visitKeyRef = useRef<string | null>(null);
  const hasRecordedAttemptRef = useRef(false);

  const latestRef = useRef<ILatestTelemetryState>({
    quiz,
    quizType,
    isCompleted,
    startedAtMs,
    completedAtMs,
    answers,
  });
  useLayoutEffect(() => {
    latestRef.current = {
      quiz,
      quizType,
      isCompleted,
      startedAtMs,
      completedAtMs,
      answers,
    };
  }, [quiz, quizType, isCompleted, startedAtMs, completedAtMs, answers]);

  useEffect(() => {
    if (!quiz?.id) {
      visitKeyRef.current = null;
      hasRecordedAttemptRef.current = false;
      return;
    }
    visitKeyRef.current = `${quizType}:${quiz.id}:${startedAtMs ?? 'pending'}`;
    hasRecordedAttemptRef.current = false;
  }, [quiz?.id, quizType, startedAtMs]);

  const recordAttempt = useCallback(async (completedAt: number) => {
    const state = latestRef.current;
    if (!state.quiz?.id || hasRecordedAttemptRef.current) return;

    const answeredInputs = state.answers.filter((input) =>
      isAnsweredQuizInput(input.selectedAnswer),
    );
    if (answeredInputs.length === 0) return;

    const visitKey =
      visitKeyRef.current
      ?? `${state.quizType}:${state.quiz.id}:${state.startedAtMs ?? completedAt}`;
    if (recordedAttemptKeysRef.current.has(visitKey)) return;

    hasRecordedAttemptRef.current = true;
    recordedAttemptKeysRef.current.add(visitKey);

    const fallbackStartedAtMs = state.startedAtMs ?? completedAt;
    try {
      await recordQuizAttempt({
        quizId: state.quiz.id,
        quizType: state.quizType,
        startedAt: new Date(fallbackStartedAtMs).toISOString(),
        completedAt: new Date(completedAt).toISOString(),
        durationMs: Math.max(0, completedAt - fallbackStartedAtMs),
        answers: answeredInputs,
      }).unwrap();
    } catch {
      hasRecordedAttemptRef.current = false;
      recordedAttemptKeysRef.current.delete(visitKey);
    }
  }, [recordQuizAttempt]);

  useEffect(() => {
    if (!quiz?.id || !isCompleted || !completedAtMs) return;
    void recordAttempt(completedAtMs);
  }, [answers, completedAtMs, isCompleted, quiz?.id, recordAttempt]);

  useEffect(() => {
    const handlePageHide = () => {
      const state = latestRef.current;
      if (!state.quiz?.id || state.isCompleted) return;
      void recordAttempt(Date.now());
    };

    window.addEventListener('pagehide', handlePageHide);
    return () => {
      window.removeEventListener('pagehide', handlePageHide);
      const state = latestRef.current;
      if (!state.quiz?.id || state.isCompleted) return;
      void recordAttempt(Date.now());
    };
  }, [recordAttempt]);
};
