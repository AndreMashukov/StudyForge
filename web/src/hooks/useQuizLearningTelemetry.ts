import { useEffect, useRef } from 'react';
import {
  DiagramQuiz,
  Quiz,
  QuizTelemetryType,
  RecordQuizAttemptAnswerInput,
  SequenceQuiz,
} from '@shared-types';
import {
  useRecordQuizAttemptMutation,
  useRecordQuizExplanationRequestMutation,
} from '../store/api/LearningTelemetry/learningTelemetryApi';

type TrackableQuiz = Quiz | DiagramQuiz | SequenceQuiz | null;

interface IUseQuizLearningTelemetryOptions {
  quiz: TrackableQuiz;
  quizType: QuizTelemetryType;
  isCompleted: boolean;
  startedAtMs: number | null;
  completedAtMs: number | null;
  answers: RecordQuizAttemptAnswerInput[];
  followupGenerated: Record<number, boolean>;
}

export const useQuizLearningTelemetry = ({
  quiz,
  quizType,
  isCompleted,
  startedAtMs,
  completedAtMs,
  answers,
  followupGenerated,
}: IUseQuizLearningTelemetryOptions) => {
  const [recordQuizAttempt] = useRecordQuizAttemptMutation();
  const [recordQuizExplanationRequest] = useRecordQuizExplanationRequestMutation();
  const recordedAttemptKeysRef = useRef(new Set<string>());
  const recordedExplanationKeysRef = useRef(new Set<string>());

  useEffect(() => {
    if (!quiz?.id) return;

    Object.entries(followupGenerated).forEach(([questionIndex, isGenerated]) => {
      if (!isGenerated) return;

      const parsedQuestionIndex = Number(questionIndex);
      const eventKey = `${quizType}:${quiz.id}:${parsedQuestionIndex}`;
      if (recordedExplanationKeysRef.current.has(eventKey)) return;

      recordedExplanationKeysRef.current.add(eventKey);
      void recordQuizExplanationRequest({
        quizId: quiz.id,
        quizType,
        questionIndex: parsedQuestionIndex,
        requestedAt: new Date().toISOString(),
      }).unwrap().catch(() => {
        recordedExplanationKeysRef.current.delete(eventKey);
      });
    });
  }, [followupGenerated, quiz?.id, quizType, recordQuizExplanationRequest]);

  useEffect(() => {
    if (!quiz?.id || !isCompleted || !completedAtMs) return;

    const fallbackStartedAtMs = startedAtMs ?? completedAtMs;
    const attemptKey = `${quizType}:${quiz.id}:${completedAtMs}`;
    if (recordedAttemptKeysRef.current.has(attemptKey)) return;

    recordedAttemptKeysRef.current.add(attemptKey);
    void recordQuizAttempt({
      quizId: quiz.id,
      quizType,
      startedAt: new Date(fallbackStartedAtMs).toISOString(),
      completedAt: new Date(completedAtMs).toISOString(),
      durationMs: Math.max(0, completedAtMs - fallbackStartedAtMs),
      answers,
    }).unwrap().catch(() => {
      recordedAttemptKeysRef.current.delete(attemptKey);
    });
  }, [answers, completedAtMs, isCompleted, quiz?.id, quizType, recordQuizAttempt, startedAtMs]);
};