import { useMemo } from 'react';
import { useSelector } from 'react-redux';
import { RecordQuizAttemptAnswerInput } from '@shared-types';
import { useQuizLearningTelemetry } from '../../../../hooks/useQuizLearningTelemetry';
import { usePublishDirectoryChatQuizSeed } from '../../../../hooks/usePublishDirectoryChatQuizSeed';
import { selectMatchQuizState } from '../../../../store/slices/matchQuizPageSlice';
import { buildDirectoryChatQuestionSeed } from '../../../../utils/directoryChatQuizSeed';

export const useMatchQuizPageEffects = () => {
  const quizState = useSelector(selectMatchQuizState);
  const currentQuestion = quizState.questions[quizState.currentQuestionIndex];
  const directoryId = quizState.firestoreMatchQuiz?.directoryId;
  const quizQuestionSeed = useMemo(() => {
    if (
      !directoryId ||
      !quizState.firestoreMatchQuiz ||
      !currentQuestion ||
      quizState.isCompleted
    ) {
      return null;
    }

    const userMatchLabels = currentQuestion.prompts.map((prompt) => {
      const option = currentQuestion.options.find(
        (candidate) => candidate.id === quizState.placements[prompt.id],
      );
      return `${prompt.text} ${option ? option.text : ''}`.trim();
    });
    const correctMatchLabels = currentQuestion.prompts.map((prompt) => {
      const option = currentQuestion.options.find(
        (candidate) => candidate.correctPromptId === prompt.id,
      );
      return `${prompt.text} ${option ? option.text : ''}`.trim();
    });

    const seed = buildDirectoryChatQuestionSeed({
      artifactType: 'matchQuiz',
      quizId: quizState.firestoreMatchQuiz.id,
      questionIndex: quizState.currentQuestionIndex,
      question: currentQuestion.question,
      title: quizState.firestoreMatchQuiz.title,
      explanation: currentQuestion.explanation,
      matchPrompts: currentQuestion.prompts.map((prompt) => prompt.text),
      userMatches: userMatchLabels,
      correctMatches: correctMatchLabels,
      followupRuleIds: quizState.firestoreMatchQuiz.followupRuleIds,
    });

    return {
      directoryId,
      ...seed,
    };
  }, [
    currentQuestion,
    directoryId,
    quizState.currentQuestionIndex,
    quizState.firestoreMatchQuiz,
    quizState.isCompleted,
    quizState.placements,
  ]);

  usePublishDirectoryChatQuizSeed(quizQuestionSeed);
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