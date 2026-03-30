import React from 'react';
import { Check, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../components/ui/Card';
import { Button } from '../../../../components/ui/Button';
import { cn } from '../../../../lib/utils';
import { DiagramSlideViewer } from '../DiagramSlideViewer';
import { DiagramAnswerBar } from '../DiagramAnswerBar';
import { IDiagramQuestionCard } from './IDiagramQuestionCard';

export const DiagramQuestionCard: React.FC<IDiagramQuestionCard> = ({
  question,
  currentDiagramIndex,
  selectedAnswer,
  showExplanation,
  onAnswerSelect,
  onNextQuestion,
  onPrevDiagram,
  onNextDiagram,
  onDiagramDotClick,
  isLastQuestion,
  className,
}) => {
  return (
    <Card className={cn('w-full', className)}>
      <CardHeader>
        <CardTitle className="text-lg font-medium leading-relaxed text-foreground">
          {question.question}
        </CardTitle>
      </CardHeader>
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
          showResult={showExplanation}
          onSelect={onAnswerSelect}
        />

        {showExplanation && (
          <Card className="mt-4 border-border/50 bg-muted/30">
            <CardContent className="p-4">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
                {selectedAnswer === question.correct ? (
                  <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
                ) : (
                  <X className="h-4 w-4 text-red-600 dark:text-red-400" />
                )}
                {selectedAnswer === question.correct ? 'Correct!' : 'Incorrect'}
              </h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{question.explanation}</p>
            </CardContent>
          </Card>
        )}

        {showExplanation && (
          <Button onClick={onNextQuestion} className="w-full" size="lg">
            {isLastQuestion ? 'View results' : 'Next question'}
          </Button>
        )}
      </CardContent>
    </Card>
  );
};
