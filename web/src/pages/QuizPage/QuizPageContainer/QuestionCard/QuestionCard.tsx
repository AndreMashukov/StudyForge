import React from 'react';
import { useSelector } from 'react-redux';
import { Check, X } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../../../../components/ui/Card';
import { Button } from '../../../../components/ui/Button';
import { cn } from '../../../../lib/utils';
import { MarkdownRenderer } from '../../../../components/MarkdownRenderer';
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
  followupContent,
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
      return cn(baseClass, "bg-green-100 dark:bg-green-900/30 border-green-600 text-green-900 dark:text-green-100");
    } else if (optionIndex === selectedAnswer && optionIndex !== question.correct) {
      return cn(baseClass, "bg-red-100 dark:bg-red-900/30 border-red-600 text-red-900 dark:text-red-100");
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
        <CardTitle className="text-lg font-medium text-foreground leading-relaxed">
          {question.question}
        </CardTitle>
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
                    <Check className="w-5 h-5 text-green-600 dark:text-green-400" />
                  ) : index === selectedAnswer ? (
                    <X className="w-5 h-5 text-red-600 dark:text-red-400" />
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
                  <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
                ) : (
                  <X className="h-4 w-4 text-red-600 dark:text-red-400" />
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

            {followupContent && (
              <Card className="mt-4 bg-primary/5 border-primary/20">
                <CardContent className="p-5">
                  <h3 className="text-sm font-semibold text-primary mb-3">
                    Detailed Explanation
                  </h3>
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <MarkdownRenderer content={followupContent} />
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
