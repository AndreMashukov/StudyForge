import React from 'react';
import { cn } from '../../../../lib/utils';
import { IDiagramAnswerBar } from './IDiagramAnswerBar';

const LABELS = ['A', 'B', 'C', 'D'] as const;

export const DiagramAnswerBar: React.FC<IDiagramAnswerBar> = ({
  selectedAnswer,
  correctAnswer,
  showResult,
  onSelect,
  className,
}) => {
  return (
    <div className={cn('w-full', className)}>
      <p className="mb-2 text-center text-[10px] uppercase tracking-wide text-muted-foreground">
        Select your answer
      </p>
      <div className="grid grid-cols-4 gap-2 sm:gap-3">
        {LABELS.map((label, index) => {
          const isWrongPick = showResult && selectedAnswer === index && index !== correctAnswer;
          const isRightPick = showResult && index === correctAnswer;

          return (
            <button
              key={label}
              type="button"
              onClick={() => onSelect(index)}
              disabled={selectedAnswer !== null}
              className={cn(
                'rounded-xl border py-3 text-lg font-bold transition-colors',
                !showResult && 'border-border bg-card hover:border-primary/50 hover:bg-muted',
                showResult &&
                  isRightPick &&
                  'border-green-600 bg-green-100 dark:bg-green-900/30 text-green-900 dark:text-green-100',
                showResult &&
                  isWrongPick &&
                  'border-red-600 bg-red-100 dark:bg-red-900/30 text-red-900 dark:text-red-100',
                showResult &&
                  !isRightPick &&
                  !isWrongPick &&
                  'border-border bg-card text-muted-foreground opacity-60'
              )}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
};
