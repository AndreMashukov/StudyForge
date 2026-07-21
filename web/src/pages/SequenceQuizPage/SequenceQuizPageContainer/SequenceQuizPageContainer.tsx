import React from 'react';
import { useSelector } from 'react-redux';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { useSequenceQuizPageContext } from '../context/hooks/useSequenceQuizPageContext';
import { ScoreCard } from '../../QuizPage/QuizPageContainer/ScoreCard';
import { SequenceQuestionCard } from './SequenceQuestionCard/SequenceQuestionCard';
import { Spinner } from '../../../components/ui/Spinner';
import { DirectoryChatPanel } from '../../../components/DirectoryChatPanel';
import {
  selectSequenceQuizState,
  selectCurrentSequenceQuestion,
  selectSequenceQuizStats,
} from '../../../store/slices/sequenceQuizPageSlice';
import { IQuizStats, IQuizAnswer } from '../../QuizPage/types/IQuizTypes';

export const SequenceQuizPageContainer: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const quizState = useSelector(selectSequenceQuizState);
  const currentQuestion = useSelector(selectCurrentSequenceQuestion);
  const stats = useSelector(selectSequenceQuizStats);
  const { sequenceQuizApi, handlers } = useSequenceQuizPageContext();

  const directoryIdForBack =
    sequenceQuizApi.firestoreSequenceQuiz?.directoryId?.trim() ||
    searchParams.get('directoryId')?.trim() ||
    null;

  const handleBackToDirectory = () => {
    if (directoryIdForBack) {
      navigate(`/directory/${directoryIdForBack}?tab=sequenceQuizzes`);
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

  if (!sequenceQuizApi.hasValidId) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-16">
        {backButton}
        <div className="text-center">
          <h2 className="mb-4 text-2xl font-bold text-destructive">Invalid sequence quiz</h2>
          <p className="mb-6 text-muted-foreground">No sequence quiz ID was provided.</p>
        </div>
      </div>
    );
  }

  if (sequenceQuizApi.isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Spinner size="md" />
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
  const questionIndex = quizState.currentQuestionIndex;
  const directoryId = sequenceQuizApi.firestoreSequenceQuiz?.directoryId || directoryIdForBack;
  const detailedExplanationSeedKey = `sequenceQuiz:${sequenceQuizApi.firestoreSequenceQuiz?.id ?? 'active'}:${questionIndex}:detailed-explanation`;
  const detailedExplanationMessage = 'Explain this sequence quiz in detail. Include why my ordering is right or wrong, how to reason through the correct sequence, and the source details that support it.';

  return (
    <div className="mx-auto max-w-4xl space-y-4 px-6 py-4">
      <SequenceQuestionCard
        question={currentQuestion}
        availableItems={quizState.availableItems}
        placedItems={quizState.placedItems}
        isChecked={quizState.isChecked}
        isCorrect={quizState.isCorrect}
        showExplanation={quizState.showExplanation}
        handlers={handlers}
        isLastQuestion={isLastQuestion}
        backAction={inlineBackAction}
      />

      {quizState.followupChatOpen[questionIndex] && directoryId && (
        <DirectoryChatPanel
          directoryId={directoryId}
          sourceCount={1}
          compact
          autoSendSeed
          seedKey={detailedExplanationSeedKey}
          seedMessage={detailedExplanationMessage}
          artifactContext={{
            type: 'sequenceQuiz',
            title: sequenceQuizApi.firestoreSequenceQuiz?.title,
            question: currentQuestion.question,
            explanation: currentQuestion.explanation,
            sequenceItems: currentQuestion.items,
            userSequence: quizState.placedItems,
            correctSequence: currentQuestion.items,
            followupRuleIds: sequenceQuizApi.firestoreSequenceQuiz?.followupRuleIds,
          }}
        />
      )}
    </div>
  );
};
