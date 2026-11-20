import { useMemo } from 'react';
import { useSelector } from 'react-redux';
import { RecordQuizAttemptAnswerInput } from '@shared-types';
import { useQuizLearningTelemetry } from '../../../../hooks/useQuizLearningTelemetry';
import { selectDiagramQuizState } from '../../../../store/slices/diagramQuizPageSlice';

export const useDiagramQuizPageEffects = () => {
  const quizState = useSelector(selectDiagramQuizState);
  const telemetryAnswers = useMemo<RecordQuizAttemptAnswerInput[]>(() => {
    return quizState.answers.map((answer) => {
      const questionIndex = answer.questionId - 1;
      return {
        questionIndex,
        selectedAnswer: answer.selected,
        timeSpentMs: answer.timeSpent,
      };
    });
  }, [quizState.answers]);

  useQuizLearningTelemetry({
    quiz: quizState.firestoreDiagramQuiz,
    quizType: 'diagramQuiz',
    isCompleted: quizState.isCompleted,
    startedAtMs: quizState.startTime,
    completedAtMs: quizState.endTime,
    answers: telemetryAnswers,
  });
};
