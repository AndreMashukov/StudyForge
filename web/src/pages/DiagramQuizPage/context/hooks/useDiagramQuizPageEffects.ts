import { useMemo } from 'react';
import { useSelector } from 'react-redux';
import { RecordQuizAttemptAnswerInput } from '@shared-types';
import { useQuizLearningTelemetry } from '../../../../hooks/useQuizLearningTelemetry';
import { usePublishDirectoryChatQuizSeed } from '../../../../hooks/usePublishDirectoryChatQuizSeed';
import { selectDiagramQuizState } from '../../../../store/slices/diagramQuizPageSlice';
import { buildDirectoryChatQuestionSeed } from '../../../../utils/directoryChatQuizSeed';

const DIAGRAM_LABELS = ['Diagram A', 'Diagram B', 'Diagram C', 'Diagram D'];

export const useDiagramQuizPageEffects = () => {
  const quizState = useSelector(selectDiagramQuizState);
  const currentQuestion = quizState.questions[quizState.currentQuestionIndex];
  const directoryId = quizState.firestoreDiagramQuiz?.directoryId;
  const quizQuestionSeed = useMemo(() => {
    if (
      !directoryId ||
      !quizState.firestoreDiagramQuiz ||
      !currentQuestion ||
      quizState.isCompleted
    ) {
      return null;
    }

    const selectedAnswerText =
      quizState.selectedAnswer !== null
        ? DIAGRAM_LABELS[quizState.selectedAnswer] ||
          `Diagram ${quizState.selectedAnswer + 1}`
        : undefined;
    const seed = buildDirectoryChatQuestionSeed({
      artifactType: 'diagramQuiz',
      quizId: quizState.firestoreDiagramQuiz.id,
      questionIndex: quizState.currentQuestionIndex,
      question: currentQuestion.question,
      title: quizState.firestoreDiagramQuiz.title,
      options: DIAGRAM_LABELS,
      userAnswer: selectedAnswerText,
      correctAnswer:
        DIAGRAM_LABELS[currentQuestion.correct] ||
        `Diagram ${currentQuestion.correct + 1}`,
      explanation: currentQuestion.explanation,
      followupRuleIds: quizState.firestoreDiagramQuiz.followupRuleIds,
    });

    return {
      directoryId,
      ...seed,
    };
  }, [
    currentQuestion,
    directoryId,
    quizState.currentQuestionIndex,
    quizState.firestoreDiagramQuiz,
    quizState.isCompleted,
    quizState.selectedAnswer,
  ]);

  usePublishDirectoryChatQuizSeed(quizQuestionSeed);
  const telemetryAnswers = useMemo<RecordQuizAttemptAnswerInput[]>(() => {
    return quizState.answers.map((answer) => {
      const questionIndex = answer.questionId - 1;
      return {
        questionIndex,
        selectedAnswer: answer.selected,
        timeSpentMs: answer.timeSpent,
        detailedExplanationRequested: Boolean(quizState.followupGenerated[questionIndex]),
      };
    });
  }, [quizState.answers, quizState.followupGenerated]);

  useQuizLearningTelemetry({
    quiz: quizState.firestoreDiagramQuiz,
    quizType: 'diagramQuiz',
    isCompleted: quizState.isCompleted,
    startedAtMs: quizState.startTime,
    completedAtMs: quizState.endTime,
    answers: telemetryAnswers,
    followupGenerated: quizState.followupGenerated,
  });
};
