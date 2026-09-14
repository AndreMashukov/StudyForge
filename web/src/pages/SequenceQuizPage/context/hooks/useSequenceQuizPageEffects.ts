import { useMemo } from 'react';
import { useSelector } from 'react-redux';
import { RecordQuizAttemptAnswerInput } from '@shared-types';
import { useQuizLearningTelemetry } from '../../../../hooks/useQuizLearningTelemetry';
import { usePublishDirectoryChatQuizSeed } from '../../../../hooks/usePublishDirectoryChatQuizSeed';
import { selectSequenceQuizState } from '../../../../store/slices/sequenceQuizPageSlice';
import { buildDirectoryChatQuestionSeed } from '../../../../utils/directoryChatQuizSeed';

export const useSequenceQuizPageEffects = () => {
  const quizState = useSelector(selectSequenceQuizState);
  const currentQuestion = quizState.questions[quizState.currentQuestionIndex];
  const directoryId = quizState.firestoreSequenceQuiz?.directoryId;
  const quizQuestionSeed = useMemo(() => {
    if (
      !directoryId ||
      !quizState.firestoreSequenceQuiz ||
      !currentQuestion ||
      quizState.isCompleted
    ) {
      return null;
    }

    const seed = buildDirectoryChatQuestionSeed({
      artifactType: 'sequenceQuiz',
      quizId: quizState.firestoreSequenceQuiz.id,
      questionIndex: quizState.currentQuestionIndex,
      question: currentQuestion.question,
      title: quizState.firestoreSequenceQuiz.title,
      explanation: currentQuestion.explanation,
      sequenceItems: currentQuestion.items,
      userSequence: quizState.placedItems,
      correctSequence: currentQuestion.items,
      followupRuleIds: quizState.firestoreSequenceQuiz.followupRuleIds,
    });

    return {
      directoryId,
      ...seed,
    };
  }, [
    currentQuestion,
    directoryId,
    quizState.currentQuestionIndex,
    quizState.firestoreSequenceQuiz,
    quizState.isCompleted,
    quizState.placedItems,
  ]);

  usePublishDirectoryChatQuizSeed(quizQuestionSeed);
  const telemetryAnswers = useMemo<RecordQuizAttemptAnswerInput[]>(() => {
    return quizState.answers.map((answer) => {
      const questionIndex = answer.questionId - 1;
      return {
        questionIndex,
        selectedAnswer: answer.placedItems,
        timeSpentMs: answer.timeSpent,
        detailedExplanationRequested: Boolean(quizState.followupGenerated[questionIndex]),
      };
    });
  }, [quizState.answers, quizState.followupGenerated]);

  useQuizLearningTelemetry({
    quiz: quizState.firestoreSequenceQuiz,
    quizType: 'sequenceQuiz',
    isCompleted: quizState.isCompleted,
    startedAtMs: quizState.quizStartTime,
    completedAtMs: quizState.endTime,
    answers: telemetryAnswers,
    followupGenerated: quizState.followupGenerated,
  });
};
