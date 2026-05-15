import React from 'react';
import { Lightbulb } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/Tooltip';
import { cn } from '../../lib/utils';
import { IQuizHintTooltip } from './IQuizHintTooltip';

export const QuizHintTooltip: React.FC<IQuizHintTooltip> = ({
  hint,
  label = 'Show hint',
  className,
}) => {
  const trimmedHint = hint?.trim();

  if (!trimmedHint) {
    return null;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className={cn(
              'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary transition-colors hover:bg-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              className
            )}
            aria-label={label}
          >
            <Lightbulb size={15} />
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" align="end" className="max-w-xs px-3 py-2 text-sm">
          <p className="mb-1 text-xs font-semibold text-primary">Hint</p>
          <p className="leading-relaxed text-popover-foreground">{trimmedHint}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
