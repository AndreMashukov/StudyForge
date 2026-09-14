import { useEffect, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { RecordQuizAttemptAnswerInput } from '@shared-types';
import { useQuizLearningTelemetry } from '../../../../hooks/useQuizLearningTelemetry';
import { usePublishDirectoryChatQuizSeed } from '../../../../hooks/usePublishDirectoryChatQuizSeed';
import { selectQuizState } from '../../../../store/slices/quizPageSlice';
import { buildDirectoryChatQuestionSeed } from '../../../../utils/directoryChatQuizSeed';

export const useQuizPageEffects = () => {
  const quizState = useSelector(selectQuizState);
  const currentQuestion = quizState.questions[quizState.currentQuestionIndex];
  const directoryId = quizState.firestoreQuiz?.directoryId;
  const quizQuestionSeed = useMemo(() => {
    if (
      !directoryId ||
      !quizState.firestoreQuiz ||
      !currentQuestion ||
      quizState.isCompleted
    ) {
      return null;
    }

    const selectedAnswerText =
      quizState.selectedAnswer !== null
        ? currentQuestion.options[quizState.selectedAnswer]
        : undefined;
    const seed = buildDirectoryChatQuestionSeed({
      artifactType: 'quiz',
      quizId: quizState.firestoreQuiz.id,
      questionIndex: quizState.currentQuestionIndex,
      question: currentQuestion.question,
      title: quizState.firestoreQuiz.title,
      options: currentQuestion.options,
      userAnswer: selectedAnswerText,
      correctAnswer: currentQuestion.options[currentQuestion.correct],
      explanation: currentQuestion.explanation,
      followupRuleIds: quizState.firestoreQuiz.followupRuleIds,
    });

    return {
      directoryId,
      ...seed,
    };
  }, [
    currentQuestion,
    directoryId,
    quizState.currentQuestionIndex,
    quizState.firestoreQuiz,
    quizState.isCompleted,
    quizState.selectedAnswer,
  ]);

  usePublishDirectoryChatQuizSeed(quizQuestionSeed);
  const telemetryAnswers = useMemo<RecordQuizAttemptAnswerInput[]>(() => {
    return quizState.answers.map((answer) => {
      const questionIndex = answer.questionId - 1;
      return {
        questionIndex,
        selectedAnswer: answer.selected >= 0 ? answer.selected : null,
        timeSpentMs: answer.timeSpent,
        detailedExplanationRequested: Boolean(quizState.followupGenerated[questionIndex]),
      };
    });
  }, [quizState.answers, quizState.followupGenerated]);

  useQuizLearningTelemetry({
    quiz: quizState.firestoreQuiz,
    quizType: 'quiz',
    isCompleted: quizState.isCompleted,
    startedAtMs: quizState.startTime,
    completedAtMs: quizState.endTime,
    answers: telemetryAnswers,
    followupGenerated: quizState.followupGenerated,
  });

  // Keyboard navigation effect (manages its own dependencies)
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      // Allow keyboard navigation
      if (event.key >= '1' && event.key <= '9') {
        const answerIndex = parseInt(event.key) - 1;
        // This would need to be connected to handlers via custom events or Redux
        console.log(`Keyboard shortcut for answer ${answerIndex}`);
      }
      
      if (event.key === 'Enter') {
        // Submit answer or go to next question
        console.log('Enter pressed - could dispatch Redux action');
      }
      
      if (event.key === 'Escape') {
        // Maybe exit quiz or show menu
        console.log('Escape pressed - could navigate away');
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    
    return () => {
      document.removeEventListener('keydown', handleKeyPress);
    };
  }, []);

  // Page visibility effect (pause/resume quiz when tab changes)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        console.log('Quiz paused - tab not visible');
      } else {
        console.log('Quiz resumed - tab visible');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Browser beforeunload warning
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue =
        'Are you sure you want to leave? Answered questions will be saved to Statistics.';
      return 'Are you sure you want to leave? Answered questions will be saved to Statistics.';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);
};