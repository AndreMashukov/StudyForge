import React from 'react';
import { useSelector } from 'react-redux';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { useDiagramQuizPageContext } from '../context/hooks/useDiagramQuizPageContext';
import { ScoreCard } from '../../QuizPage/QuizPageContainer/ScoreCard';
import { DiagramQuestionCard } from './DiagramQuestionCard';
import { Spinner } from '../../../components/ui/Spinner';
import {
  selectDiagramQuizState,
  selectCurrentDiagramQuestion,
  selectDiagramFormState,
  selectDiagramQuizStats,
} from '../../../store/slices/diagramQuizPageSlice';
import { IQuizStats } from '../../QuizPage/types/IQuizTypes';

export const DiagramQuizPageContainer: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const quizState = useSelector(selectDiagramQuizState);
  const currentQuestion = useSelector(selectCurrentDiagramQuestion);
  const formState = useSelector(selectDiagramFormState);
  const stats = useSelector(selectDiagramQuizStats);
  const { diagramQuizApi, handlers } = useDiagramQuizPageContext();

  const directoryIdForBack =
    diagramQuizApi.firestoreDiagramQuiz?.directoryId?.trim() ||
    searchParams.get('directoryId')?.trim() ||
    null;

  const handleBackToDirectory = () => {
    if (directoryIdForBack) {
      navigate(`/directory/${directoryIdForBack}`);
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

  if (diagramQuizApi.isLoading || !diagramQuizApi.hasValidId) {
    return (
      <div className="flex items-center justify-center p-8">
        <Spinner size="md" />
        <p className="ml-4">Loading diagram quiz…</p>
      </div>
    );
  }

  if (diagramQuizApi.error || diagramQuizApi.isError) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-16">
        {backButton}
        <div className="text-center">
          <h2 className="mb-4 text-2xl font-bold text-destructive">Error loading diagram quiz</h2>
          <p className="mb-6 text-muted-foreground">Failed to load quiz</p>
          <button
            type="button"
            onClick={() => diagramQuizApi.refetch()}
            className="rounded bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (quizState.isCompleted) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-16">
        {backButton}
        <ScoreCard
          stats={stats as IQuizStats}
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

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-6 py-16">
      {backButton}
      <DiagramQuestionCard
        question={currentQuestion}
        currentDiagramIndex={quizState.currentDiagramIndex}
        selectedAnswer={formState.selectedAnswer}
        showExplanation={quizState.showExplanation}
        onAnswerSelect={handleAnswerSelect}
        onNextQuestion={handleNextQuestion}
        onPrevDiagram={handlers.handlePrevDiagram}
        onNextDiagram={handlers.handleNextDiagram}
        onDiagramDotClick={handlers.handleDiagramDotClick}
        isLastQuestion={isLastQuestion}
        onGenerateFollowup={handlers.handleGenerateFollowup}
        isGeneratingFollowup={quizState.isGeneratingFollowup}
        isFollowupGenerated={!!quizState.followupGenerated[questionIndex]}
        followupContent={quizState.followupContent[questionIndex]}
      />
    </div>
  );
};
