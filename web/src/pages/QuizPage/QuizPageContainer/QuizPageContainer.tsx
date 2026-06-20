import React from 'react';
import { useSelector } from 'react-redux';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { useQuizPageContext } from '../context';
import { QuestionCard } from './QuestionCard';
import { ScoreCard } from './ScoreCard';
import { Spinner } from '../../../components/ui/Spinner';
import { DirectoryChatPanel } from '../../../components/DirectoryChatPanel';
import {
  selectQuizState,
  selectCurrentQuestion,
  selectFormState,
  selectQuizStats,
  selectIsLoading,
  selectError,
  selectIsGeneratingFollowup,
  selectFollowupGenerated,
  selectFollowupError,
  selectFollowupChatOpen,
} from '../../../store/slices/quizPageSlice';

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
  const isGeneratingFollowup = useSelector(selectIsGeneratingFollowup);
  const followupGenerated = useSelector(selectFollowupGenerated);
  const followupError = useSelector(selectFollowupError);
  const followupChatOpen = useSelector(selectFollowupChatOpen);

  // Only get handlers and API from context
  const { handlers, quizApi } = useQuizPageContext();

  const directoryIdForBack =
    quizApi.firestoreQuiz?.directoryId?.trim() ||
    searchParams.get('directoryId')?.trim() ||
    null;

  const handleBackToDirectory = () => {
    if (directoryIdForBack) {
      navigate(`/directory/${directoryIdForBack}?tab=quizzes`);
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

  const handleGenerateFollowup = () => {
    handlers.handleGenerateFollowup();
  };

  const backButton = (
    <button
      type="button"
      onClick={handleBackToDirectory}
      className="flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors mb-6"
    >
      <ChevronLeft className="h-4 w-4 shrink-0" />
      Back to directory
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

  // Check if current question has followup generated
  const isCurrentFollowupGenerated = followupGenerated[quizState.currentQuestionIndex] || false;
  const isCurrentFollowupChatOpen = followupChatOpen[quizState.currentQuestionIndex] || false;
  const directoryId = quizApi.firestoreQuiz?.directoryId || directoryIdForBack;
  const selectedAnswerText = formState.selectedAnswer !== null
    ? currentQuestion.options[formState.selectedAnswer]
    : undefined;
  const correctAnswerText = currentQuestion.options[currentQuestion.correct];
  const detailedExplanationSeedKey = `quiz:${quizApi.firestoreQuiz?.id ?? 'active'}:${quizState.currentQuestionIndex}:detailed-explanation`;
  const detailedExplanationMessage = 'Explain this quiz question in detail. Include why my answer is right or wrong, how to reason toward the correct answer, and the key source details that matter.';

  return (
    <div className="max-w-4xl mx-auto px-6 py-16 space-y-8">
      {backButton}

      {/* Question Card (with embedded progress bar) */}
      <QuestionCard
        question={currentQuestion}
        selectedAnswer={formState.selectedAnswer}
        showExplanation={quizState.showExplanation}
        onAnswerSelect={handleAnswerSelect}
        onNextQuestion={handleNextQuestion}
        onGenerateFollowup={handleGenerateFollowup}
        isGeneratingFollowup={isGeneratingFollowup}
        isFollowupGenerated={isCurrentFollowupGenerated}
        isLastQuestion={isLastQuestion}
      />

      {isCurrentFollowupChatOpen && directoryId && (
        <DirectoryChatPanel
          directoryId={directoryId}
          sourceCount={1}
          compact
          autoSendSeed
          seedKey={detailedExplanationSeedKey}
          seedMessage={detailedExplanationMessage}
          artifactContext={{
            type: 'quiz',
            title: quizApi.firestoreQuiz?.title,
            question: currentQuestion.question,
            options: currentQuestion.options,
            userAnswer: selectedAnswerText,
            correctAnswer: correctAnswerText,
            explanation: currentQuestion.explanation,
            followupRuleIds: quizApi.firestoreQuiz?.followupRuleIds,
          }}
        />
      )}

      {/* Error Display for Followup */}
      {followupError && (
        <div className="rounded-lg border border-destructive bg-destructive/10 p-4">
          <p className="text-destructive text-sm">{followupError}</p>
        </div>
      )}
    </div>
  );
};
