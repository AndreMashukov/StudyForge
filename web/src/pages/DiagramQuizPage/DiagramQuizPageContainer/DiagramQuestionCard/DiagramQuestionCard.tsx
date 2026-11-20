import React from 'react';
import { useSelector } from 'react-redux';
import { Check, X } from 'lucide-react';
import { Card, CardContent } from '../../../../components/ui/Card';
import { Button } from '../../../../components/ui/Button';
import { cn } from '../../../../lib/utils';
import { QuizQuestionHeader } from '../../../../components/QuizQuestionHeader';
import { DiagramSlideViewer } from '../DiagramSlideViewer';
import { DiagramAnswerBar } from '../DiagramAnswerBar';
import {
  selectDiagramQuizState,
  selectDiagramQuizProgress,
} from '../../../../store/slices/diagramQuizPageSlice';
import { IDiagramQuestionCard } from './IDiagramQuestionCard';

export const DiagramQuestionCard: React.FC<IDiagramQuestionCard> = ({
  question,
  currentDiagramIndex,
  selectedAnswer,
  showFeedback,
  onAnswerSelect,
  onNextQuestion,
  onPrevDiagram,
  onNextDiagram,
  onDiagramDotClick,
  isLastQuestion,
  className,
  backAction,
}) => {
  const quizState = useSelector(selectDiagramQuizState);
  const progress = useSelector(selectDiagramQuizProgress);

  const currentQuestion = quizState.currentQuestionIndex + 1;
  const totalQuestions = quizState.questions.length;
  const answeredCount = quizState.answers.length;

  return (
    <Card className={cn('w-full overflow-hidden', className)}>
      <QuizQuestionHeader
        progress={progress}
        currentQuestion={currentQuestion}
        totalQuestions={totalQuestions}
        score={quizState.score}
        answeredCount={answeredCount}
        questionText={question.question}
        hint={question.hint}
        leadingAction={backAction}
      />

      <CardContent className="space-y-4">
        <DiagramSlideViewer
          diagrams={question.diagrams}
          currentIndex={currentDiagramIndex}
          onPrev={onPrevDiagram}
          onNext={onNextDiagram}
          onDotClick={onDiagramDotClick}
        />

        <DiagramAnswerBar
          selectedAnswer={selectedAnswer}
          correctAnswer={question.correct}
          showResult={showFeedback}
          onSelect={onAnswerSelect}
        />

        {showFeedback && (
          <Card className="mt-4 border-border/50 bg-muted/30">
            <CardContent className="p-4">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                {selectedAnswer === question.correct ? (
                  <Check className="h-4 w-4 text-success" />
                ) : (
                  <X className="h-4 w-4 text-destructive" />
                )}
                {selectedAnswer === question.correct ? 'Correct!' : 'Incorrect'}
              </h3>
            </CardContent>
          </Card>
        )}

        {showFeedback && (
          <div className="space-y-3 mt-6">
            <Button onClick={onNextQuestion} className="w-full" size="lg">
              {isLastQuestion ? 'View results' : 'Next question'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
