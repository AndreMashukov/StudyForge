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
  
  const { handlers } = useQuizPageContext();

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

  if (handlers.isLoading) {
    return (
      <div className="quiz-container quiz-container--loading">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Loading quiz...</p>
        </div>
      </div>
    );
  }

  if (handlers.error) {
    return (
      <div className="quiz-container quiz-container--error">
        <div className="error-message">
          <h2>Error Loading Quiz</h2>
          <p>
            {typeof handlers.error === 'string' ? handlers.error : 'Failed to load quiz'}
          </p>
          <button 
            onClick={() => window.location.reload()} 
            className="retry-button"
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
          stats={handlers.stats}
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
        progress={handlers.progress}
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