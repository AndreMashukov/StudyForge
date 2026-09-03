import { useMemo } from 'react';
import { useSelector } from 'react-redux';
import { RecordQuizAttemptAnswerInput } from '@shared-types';
import { useQuizLearningTelemetry } from '../../../../hooks/useQuizLearningTelemetry';
import { selectMatchQuizState } from '../../../../store/slices/matchQuizPageSlice';

export const useMatchQuizPageEffects = () => {
  const quizState = useSelector(selectMatchQuizState);
  const telemetryAnswers = useMemo<RecordQuizAttemptAnswerInput[]>(() => {
    return quizState.answers.map((answer) => {
      const questionIndex = answer.questionId - 1;
      return {
        questionIndex,
        selectedAnswer: answer.placedOptionIds,
        timeSpentMs: answer.timeSpent,
        detailedExplanationRequested: Boolean(quizState.followupGenerated[questionIndex]),
      };
    });
  }, [quizState.answers, quizState.followupGenerated]);

  useQuizLearningTelemetry({
    quiz: quizState.firestoreMatchQuiz,
    quizType: 'matchQuiz',
    isCompleted: quizState.isCompleted,
    startedAtMs: quizState.quizStartTime,
    completedAtMs: quizState.endTime,
    answers: telemetryAnswers,
    followupGenerated: quizState.followupGenerated,
  });
};