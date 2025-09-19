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
} from '../../../store/slices/quizPageSlice';

export const QuizPageContainer: React.FC = () => {
  const quizState = useSelector(selectQuizState);
  const currentQuestion = useSelector(selectCurrentQuestion);
  const formState = useSelector(selectFormState);
  
  const {
    progress,
    stats,
    handlers,
    isLoading,
    error,
  } = useQuizPageContext();

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

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-16">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading quiz...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-16">
        <div className="text-center">
          <p className="text-destructive mb-4">
            {typeof error === 'string' ? error : 'Failed to load quiz'}
          </p>
          <button 
            onClick={() => window.location.reload()} 
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          >
            Try Again
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