import React from 'react';
import { useSelector } from 'react-redux';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { useMatchQuizPageContext } from '../context/hooks/useMatchQuizPageContext';
import { ScoreCard } from '../../QuizPage/QuizPageContainer/ScoreCard';
import { MatchQuestionCard } from './MatchQuestionCard/MatchQuestionCard';
import { Spinner } from '../../../components/ui/Spinner';
import { Button } from '../../../components/ui/Button';
import { DirectoryChatPanel } from '../../../components/DirectoryChatPanel';
import {
  selectMatchQuizState,
  selectCurrentMatchQuestion,
  selectMatchQuizStats,
} from '../../../store/slices/matchQuizPageSlice';
import { IQuizStats, IQuizAnswer } from '../../QuizPage/types/IQuizTypes';
import { buildDirectoryPathWithOptionalName } from '../../../utils/directoryUrl';

export const MatchQuizPageContainer: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const quizState = useSelector(selectMatchQuizState);
  const currentQuestion = useSelector(selectCurrentMatchQuestion);
  const stats = useSelector(selectMatchQuizStats);
  const { matchQuizApi, handlers } = useMatchQuizPageContext();

  const directoryIdForBack =
    matchQuizApi.firestoreMatchQuiz?.directoryId?.trim() ||
    searchParams.get('directoryId')?.trim() ||
    null;

  const handleBackToDirectory = () => {
    if (directoryIdForBack) {
      navigate(
        buildDirectoryPathWithOptionalName(
          directoryIdForBack,
          undefined,
          'matchQuizzes',
        ),
      );
    } else {
      navigate('/');
    }
  };

  const backButton = (
    <Button
      type="button"
      variant="ghost"
      onClick={handleBackToDirectory}
      className="mb-6 h-auto px-0 text-sm font-medium text-muted-foreground hover:text-foreground"
    >
      <ChevronLeft className="h-4 w-4 shrink-0" />
      Back to directory
    </Button>
  );

  const inlineBackAction = (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={handleBackToDirectory}
      className="h-auto px-0 text-xs font-medium text-muted-foreground hover:text-foreground"
    >
      <ChevronLeft className="h-3.5 w-3.5 shrink-0" />
      Back
    </Button>
  );

  if (!matchQuizApi.hasValidId) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-16">
        {backButton}
        <div className="text-center">
          <h2 className="mb-4 text-2xl font-bold text-destructive">
            Invalid match quiz
          </h2>
          <p className="mb-6 text-muted-foreground">
            No match quiz ID was provided.
          </p>
        </div>
      </div>
    );
  }

  if (matchQuizApi.isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Spinner size="md" />
        <p className="ml-4">Loading match quiz…</p>
      </div>
    );
  }

  if (matchQuizApi.error || matchQuizApi.isError) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-16">
        {backButton}
        <div className="text-center">
          <h2 className="mb-4 text-2xl font-bold text-destructive">
            Error loading match quiz
          </h2>
          <p className="mb-6 text-muted-foreground">Failed to load quiz</p>
          <Button type="button" onClick={() => matchQuizApi.refetch()}>
            Retry
          </Button>
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
      answersBreakdown: stats.answersBreakdown.map(
        (a): IQuizAnswer => ({
          questionId: a.questionId,
          selected: a.isCorrect ? 1 : 0,
          correct: 1,
          isCorrect: a.isCorrect,
          timeSpent: a.timeSpent,
        }),
      ),
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

  const isLastQuestion =
    quizState.currentQuestionIndex === quizState.questions.length - 1;
  const questionIndex = quizState.currentQuestionIndex;
  const directoryId =
    matchQuizApi.firestoreMatchQuiz?.directoryId || directoryIdForBack;
  const detailedExplanationSeedKey = `matchQuiz:${matchQuizApi.firestoreMatchQuiz?.id ?? 'active'}:${questionIndex}:detailed-explanation`;
  const detailedExplanationMessage =
    'Explain this match quiz in detail. Include why my matches are right or wrong, how to reason about each pairing, and the source details that support it.';

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

  return (
    <div className="mx-auto max-w-4xl space-y-4 px-6 py-4">
      <MatchQuestionCard
        question={currentQuestion}
        bankOptionIds={quizState.bankOptionIds}
        placements={quizState.placements}
        lockedPromptIds={quizState.lockedPromptIds}
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
            type: 'matchQuiz',
            title: matchQuizApi.firestoreMatchQuiz?.title,
            explanation: currentQuestion.explanation,
            matchPrompts: currentQuestion.prompts.map((p) => p.text),
            userMatches: userMatchLabels,
            correctMatches: correctMatchLabels,
            followupRuleIds: matchQuizApi.firestoreMatchQuiz?.followupRuleIds,
          }}
        />
      )}
    </div>
  );
};
