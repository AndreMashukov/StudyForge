import React from 'react';
import { useSelector } from 'react-redux';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { useQuizPageContext } from '../context';
import { QuestionCard } from './QuestionCard';
import { ScoreCard } from './ScoreCard';
import { Spinner } from '../../../components/ui/Spinner';
import {
  selectQuizState,
  selectCurrentQuestion,
  selectFormState,
  selectQuizStats,
  selectIsLoading,
  selectError,
} from '../../../store/slices/quizPageSlice';
import { buildDirectoryPathWithOptionalName } from '../../../utils/directoryUrl';

export const QuizPageContainer: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Access Redux state directly (following architecture rules)
  const quizState = useSelector(selectQuizState);
  const currentQuestion = useSelector(selectCurrentQuestion);
  const formState = useSelector(selectFormState);
  const stats = useSelector(selectQuizStats);
  const isLoading = useSelector(selectIsLoading);
  const error = useSelector(selectError);

  // Only get handlers and API from context
  const { handlers, quizApi } = useQuizPageContext();

  const directoryIdForBack =
    quizApi.firestoreQuiz?.directoryId?.trim() ||
    searchParams.get('directoryId')?.trim() ||
    null;

  const handleBackToDirectory = () => {
    if (directoryIdForBack) {
      navigate(buildDirectoryPathWithOptionalName(directoryIdForBack, undefined, 'quizzes'));
    } else {
      navigate('/');
    }
  };

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

  const backButton = (
    <button
      type="button"
      onClick={handleBackToDirectory}
      className="mb-6 flex items-center gap-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
    >
      <ChevronLeft className="h-4 w-4 shrink-0" />
      Back to directory
    </button>
  );

  const inlineBackAction = (
    <button
      type="button"
      onClick={handleBackToDirectory}
      className="flex items-center gap-0.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
    >
      <ChevronLeft className="h-3.5 w-3.5 shrink-0" />
      Back
    </button>
  );

  // Early returns for loading and error states
  if (isLoading || quizApi.isLoading) {
    return (
      <div className="flex justify-center items-center p-8">
        <Spinner size="md" />
        <p className="ml-4">Loading quiz...</p>
      </div>
    );
  }

  if (error || quizApi.error) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-16">
        {backButton}
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
        {backButton}
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
        {backButton}
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
    <div className="mx-auto max-w-4xl space-y-4 px-6 py-4">
      <QuestionCard
        question={currentQuestion}
        selectedAnswer={formState.selectedAnswer}
        showFeedback={quizState.showFeedback}
        onAnswerSelect={handleAnswerSelect}
        onNextQuestion={handleNextQuestion}
        isLastQuestion={isLastQuestion}
        backAction={inlineBackAction}
      />
    </div>
  );
};
