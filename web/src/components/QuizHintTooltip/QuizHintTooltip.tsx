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
  const [isOpen, setIsOpen] = React.useState(false);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const ignoreNextClickRef = React.useRef(false);
  const ignoreClickResetTimerRef = React.useRef<number | undefined>(undefined);
  const trimmedHint = hint?.trim();

  React.useEffect(() => {
    setIsOpen(false);
  }, [trimmedHint]);

  React.useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const handleDocumentPointerDown = (event: PointerEvent) => {
      if (triggerRef.current?.contains(event.target as Node)) {
        return;
      }

      setIsOpen(false);
    };

    document.addEventListener('pointerdown', handleDocumentPointerDown);

    return () => {
      document.removeEventListener('pointerdown', handleDocumentPointerDown);
    };
  }, [isOpen]);

  React.useEffect(() => () => {
    if (ignoreClickResetTimerRef.current !== undefined) {
      window.clearTimeout(ignoreClickResetTimerRef.current);
    }
  }, []);

  const handleTriggerPointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.pointerType === 'mouse') {
      return;
    }

    event.preventDefault();
    ignoreNextClickRef.current = true;

    if (ignoreClickResetTimerRef.current !== undefined) {
      window.clearTimeout(ignoreClickResetTimerRef.current);
    }

    ignoreClickResetTimerRef.current = window.setTimeout(() => {
      ignoreNextClickRef.current = false;
    }, 500);

    setIsOpen((currentIsOpen) => !currentIsOpen);
  };

  const handleTriggerClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (!ignoreNextClickRef.current) {
      return;
    }

    event.preventDefault();
    ignoreNextClickRef.current = false;
  };

  if (!trimmedHint) {
    return null;
  }

  return (
    <TooltipProvider>
      <Tooltip open={isOpen} onOpenChange={setIsOpen}>
        <TooltipTrigger asChild>
          <button
            ref={triggerRef}
            type="button"
            className={cn(
              'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary transition-colors hover:bg-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              className
            )}
            aria-label={label}
            onPointerDown={handleTriggerPointerDown}
            onClick={handleTriggerClick}
          >
            <Lightbulb size={15} />
          </button>
        </TooltipTrigger>
        <TooltipContent
          side="bottom"
          align="end"
          collisionPadding={16}
          className="max-w-[calc(100vw-2rem)] break-words px-3 py-2 text-sm sm:max-w-xs"
        >
          <p className="mb-1 text-xs font-semibold text-primary">Hint</p>
          <p className="leading-relaxed text-popover-foreground">{trimmedHint}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
