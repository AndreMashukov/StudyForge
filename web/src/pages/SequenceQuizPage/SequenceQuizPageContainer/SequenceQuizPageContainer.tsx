import React from 'react';
import { useSelector } from 'react-redux';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { useSequenceQuizPageContext } from '../context/hooks/useSequenceQuizPageContext';
import { ProgressBar } from '../../QuizPage/QuizPageContainer/ProgressBar';
import { ScoreCard } from '../../QuizPage/QuizPageContainer/ScoreCard';
import { SequenceQuestionCard } from './SequenceQuestionCard/SequenceQuestionCard';
import {
  selectSequenceQuizState,
  selectCurrentSequenceQuestion,
  selectSequenceQuizProgress,
  selectSequenceQuizStats,
} from '../../../store/slices/sequenceQuizPageSlice';
import { IQuizStats, IQuizAnswer } from '../../QuizPage/types/IQuizTypes';

export const SequenceQuizPageContainer: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const quizState = useSelector(selectSequenceQuizState);
  const currentQuestion = useSelector(selectCurrentSequenceQuestion);
  const progress = useSelector(selectSequenceQuizProgress);
  const stats = useSelector(selectSequenceQuizStats);
  const { sequenceQuizApi, handlers } = useSequenceQuizPageContext();

  const directoryIdForBack =
    sequenceQuizApi.firestoreSequenceQuiz?.directoryId?.trim() ||
    searchParams.get('directoryId')?.trim() ||
    null;

  const handleBackToDirectory = () => {
    if (directoryIdForBack) {
      navigate(`/directory/${directoryIdForBack}`);
    } else {
      navigate('/');
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

  if (sequenceQuizApi.isLoading || !sequenceQuizApi.hasValidId) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="ml-4">Loading sequence quiz…</p>
      </div>
    );
  }

  if (sequenceQuizApi.error || sequenceQuizApi.isError) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-16">
        {backButton}
        <div className="text-center">
          <h2 className="mb-4 text-2xl font-bold text-destructive">Error loading sequence quiz</h2>
          <p className="mb-6 text-muted-foreground">Failed to load quiz</p>
          <button
            type="button"
            onClick={() => sequenceQuizApi.refetch()}
            className="rounded bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (quizState.isCompleted) {
    const adaptedStats: IQuizStats = {
      score: stats.score,
      totalQuestions: stats.totalQuestions,
      percentage: stats.percentage,
      timeTaken: stats.timeTaken,
      answersBreakdown: stats.answersBreakdown.map((a): IQuizAnswer => ({
        questionId: a.questionId,
        selected: a.isCorrect ? 1 : 0,
        correct: 1,
        isCorrect: a.isCorrect,
        timeSpent: a.timeSpent,
      })),
    };
    return (
      <div className="mx-auto max-w-4xl px-6 py-16">
        {backButton}
        <ScoreCard
          stats={adaptedStats}
          onResetQuiz={handlers.handleResetQuiz}
        />
      </div>
    );
  }

  if (quizState.questions.length === 0 || !currentQuestion) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-16">
        {backButton}
        <div className="text-center">
          <p className="mb-4 text-muted-foreground">No questions available</p>
        </div>
      </div>
    );
  }

  const isLastQuestion = quizState.currentQuestionIndex === quizState.questions.length - 1;

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-6 py-16">
      {backButton}
      <ProgressBar
        progress={progress}
        currentQuestion={quizState.currentQuestionIndex + 1}
        totalQuestions={quizState.questions.length}
        score={quizState.score}
      />
      <SequenceQuestionCard
        question={currentQuestion}
        availableItems={quizState.availableItems}
        placedItems={quizState.placedItems}
        isChecked={quizState.isChecked}
        isCorrect={quizState.isCorrect}
        showExplanation={quizState.showExplanation}
        handlers={handlers}
        isLastQuestion={isLastQuestion}
      />
    </div>
  );
};
