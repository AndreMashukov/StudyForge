import React from 'react';
import { useSelector } from 'react-redux';
import { Check, X } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../../../../components/ui/Card';
import { Button } from '../../../../components/ui/Button';
import { cn } from '../../../../lib/utils';
import { QuizHintTooltip } from '../../../../components/QuizHintTooltip';
import { QuizProgressBar } from '../../../../components/QuizProgressBar';
import { Spinner } from '../../../../components/ui/Spinner';
import {
  selectQuizState,
  selectProgress,
} from '../../../../store/slices/quizPageSlice';
import { IQuestionCard } from './IQuestionCard';

export const QuestionCard: React.FC<IQuestionCard> = ({
  question,
  selectedAnswer,
  showExplanation,
  onAnswerSelect,
  onNextQuestion,
  isLastQuestion,
  className,
  onGenerateFollowup,
  isGeneratingFollowup = false,
  isFollowupGenerated = false,
}) => {
  const quizState = useSelector(selectQuizState);
  const progress = useSelector(selectProgress);

  const currentQuestion = quizState.currentQuestionIndex + 1;
  const totalQuestions = quizState.questions.length;
  const answeredCount = quizState.answers.length;

  const getOptionButtonClass = (optionIndex: number) => {
    const baseClass = "w-full text-left p-4 rounded-xl border transition-all duration-200 hover:scale-[1.01] transform ";
    
    if (selectedAnswer === null) {
      return cn(baseClass, "bg-card border-border hover:bg-muted hover:border-muted-foreground text-foreground");
    } else if (optionIndex === question.correct) {
      return cn(baseClass, "bg-success/10 border-success text-success");
    } else if (optionIndex === selectedAnswer && optionIndex !== question.correct) {
      return cn(baseClass, "bg-destructive/10 border-destructive text-destructive");
    } else {
      return cn(baseClass, "bg-card border-border text-muted-foreground");
    }
  };

  return (
    <Card className={cn('w-full overflow-hidden', className)}>
      {totalQuestions > 0 && (
        <QuizProgressBar
          progress={progress}
          currentQuestion={currentQuestion}
          totalQuestions={totalQuestions}
          score={quizState.score}
          answeredCount={answeredCount}
        />
      )}

      <CardHeader>
        <div className="flex items-start gap-2">
          <CardTitle className="flex-1 text-lg font-medium leading-relaxed text-foreground">
            {question.question}
          </CardTitle>
          <QuizHintTooltip hint={question.hint} className="mt-0.5" />
        </div>
      </CardHeader>
      
      <CardContent className="space-y-3">
        {question.options.map((option, index) => (
          <button
            key={index}
            onClick={() => onAnswerSelect(index)}
            className={getOptionButtonClass(index)}
            disabled={selectedAnswer !== null}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm leading-relaxed">{option}</span>
              {selectedAnswer !== null && (
                <div className="ml-4 flex-shrink-0">
                  {index === question.correct ? (
                    <Check className="w-5 h-5 text-success" />
                  ) : index === selectedAnswer ? (
                    <X className="w-5 h-5 text-destructive" />
                  ) : null}
                </div>
              )}
            </div>
          </button>
        ))}

        {showExplanation && (
          <Card className="mt-6 bg-muted/30 border-border/50">
            <CardContent className="p-4">
              <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                {selectedAnswer === question.correct ? (
                  <Check className="h-4 w-4 text-success" />
                ) : (
                  <X className="h-4 w-4 text-destructive" />
                )}
                {selectedAnswer === question.correct ? 'Correct!' : 'Incorrect'}
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {question.explanation}
              </p>
            </CardContent>
          </Card>
        )}

        {showExplanation && (
          <div className="space-y-3 mt-6">
            <Button
              onClick={onNextQuestion}
              className="w-full"
              size="lg"
            >
              {isLastQuestion ? 'View Results' : 'Next Question'}
            </Button>

            {onGenerateFollowup && (
              <Button
                onClick={onGenerateFollowup}
                variant="outline"
                className="w-full"
                size="lg"
                disabled={isFollowupGenerated || isGeneratingFollowup}
              >
                {isGeneratingFollowup ? (
                  <>
                    <Spinner size="xs" className="mr-2" />
                    Generating Detailed Explanation...
                  </>
                ) : isFollowupGenerated ? (
                  'Detailed Explanation Generated'
                ) : (
                  'Generate Detailed Explanation'
                )}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
