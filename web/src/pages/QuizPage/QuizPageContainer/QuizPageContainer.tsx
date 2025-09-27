import React from 'react';
import { useSelector } from 'react-redux';
import { useQuizPageContext } from '../context';
import { 
  ProgressBar, 
  QuestionCard, 
  ScoreCard 
} from '../components';
import {
  selectQuizState,
  selectCurrentQuestion,
  selectFormState,
  selectProgress,
  selectQuizStats,
  selectIsLoading,
  selectError,
} from '../../../store/slices/quizPageSlice';

export const QuizPageContainer: React.FC = () => {
  // Access Redux state directly (following architecture rules)
  const quizState = useSelector(selectQuizState);
  const currentQuestion = useSelector(selectCurrentQuestion);
  const formState = useSelector(selectFormState);
  const progress = useSelector(selectProgress);
  const stats = useSelector(selectQuizStats);
  const isLoading = useSelector(selectIsLoading);
  const error = useSelector(selectError);
  
  // Only get handlers and API from context
  const { handlers, quizApi } = useQuizPageContext();

  const handleAnswerSelect = (answerIndex: number) => {
    if (formState.selectedAnswer === null && currentQuestion) {
      handlers.handleAnswerSelect(answerIndex);
    }
  };

  const handleNextQuestion = () => {
    if (quizState.currentQuestionIndex === quizState.questions.length - 1) {
      handlers.handleCompleteQuiz();
    } else {
      handlers.handleNextQuestion();
    }
  };

  // Early returns for loading and error states
  if (isLoading || quizApi.isLoading) {
    return (
      <div className="flex justify-center items-center p-8">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
        <p className="ml-4">Loading quiz...</p>
      </div>
    );
  }

  if (error || quizApi.error) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-16">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-destructive mb-4">Error Loading Quiz</h2>
          <p className="text-muted-foreground mb-6">
            {typeof error === 'string' ? error : 'Failed to load quiz'}
          </p>
          <button 
            onClick={() => quizApi.refetch()} 
            className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Quiz completed - show results
  if (quizState.isCompleted) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-16">
        <ScoreCard
          stats={stats}
          onResetQuiz={handlers.handleResetQuiz}
        />
      </div>
    );
  }

  // Quiz not started or no questions available
  if (quizState.questions.length === 0 || !currentQuestion) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-16">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">
            No quiz questions available
          </p>
          <p className="text-sm text-muted-foreground">
            Please check the quiz ID in the URL
          </p>
        </div>
      </div>
    );
  }

  // Quiz in progress
  const isLastQuestion = quizState.currentQuestionIndex === quizState.questions.length - 1;

  return (
    <div className="max-w-4xl mx-auto px-6 py-16 space-y-8">
      {/* Progress Bar */}
      <ProgressBar
        progress={progress}
        currentQuestion={quizState.currentQuestionIndex + 1}
        totalQuestions={quizState.questions.length}
        score={quizState.score}
      />

      {/* Question Card */}
      <QuestionCard
        question={currentQuestion}
        selectedAnswer={formState.selectedAnswer}
        showExplanation={quizState.showExplanation}
        onAnswerSelect={handleAnswerSelect}
        onNextQuestion={handleNextQuestion}
        isLastQuestion={isLastQuestion}
      />
    </div>
  );
};