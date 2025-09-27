import React from 'react';
import { Check, X } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../../../../components/ui/Card';
import { Button } from '../../../../components/ui/Button';
import { cn } from '../../../../lib/utils';
import { IQuestionCard } from './IQuestionCard';

export const QuestionCard: React.FC<IQuestionCard> = ({
  question,
  selectedAnswer,
  showExplanation,
  onAnswerSelect,
  onNextQuestion,
  isLastQuestion,
  className,
}) => {
  const getOptionButtonClass = (optionIndex: number) => {
    const baseClass = "w-full text-left p-4 rounded-xl border transition-all duration-200 hover:scale-[1.01] transform ";
    
    if (selectedAnswer === null) {
      return cn(baseClass, "bg-card border-border hover:bg-muted hover:border-muted-foreground text-foreground");
    } else if (optionIndex === question.correct) {
      return cn(baseClass, "bg-green-900/30 border-green-600 text-green-100");
    } else if (optionIndex === selectedAnswer && optionIndex !== question.correct) {
      return cn(baseClass, "bg-red-900/30 border-red-600 text-red-100");
    } else {
      return cn(baseClass, "bg-card border-border text-muted-foreground");
    }
  };

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader>
        <CardTitle className="text-lg font-medium text-foreground leading-relaxed">
          {question.question}
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-3">
        {/* Answer Options */}
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
                    <Check className="w-5 h-5 text-green-400" />
                  ) : index === selectedAnswer ? (
                    <X className="w-5 h-5 text-red-400" />
                  ) : null}
                </div>
              )}
            </div>
          </button>
        ))}

        {/* Explanation */}
        {showExplanation && (
          <Card className="mt-6 bg-muted/30 border-border/50">
            <CardContent className="p-4">
              <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                {selectedAnswer === question.correct ? (
                  <Check className="w-4 h-4 text-green-400" />
                ) : (
                  <X className="w-4 h-4 text-red-400" />
                )}
                {selectedAnswer === question.correct ? 'Correct!' : 'Incorrect'}
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {question.explanation}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Next Button */}
        {showExplanation && (
          <Button
            onClick={onNextQuestion}
            className="w-full mt-6"
            size="lg"
          >
            {isLastQuestion ? 'View Results' : 'Next Question'}
          </Button>
        )}
      </CardContent>
    </Card>
  );
};