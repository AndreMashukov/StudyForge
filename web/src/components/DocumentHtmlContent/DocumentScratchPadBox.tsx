import React, { useCallback, useEffect, useState } from 'react';
import type { IScratchPad } from '@shared-types';
import { Button } from '../ui/Button';
import { RefreshCw } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface IDocumentScratchPadBox {
  pad: IScratchPad;
  onRegenerate?: (sectionIndex: number) => Promise<void>;
}

export function DocumentScratchPadBox({
  pad,
  onRegenerate,
}: IDocumentScratchPadBox) {
  const [revealed, setRevealed] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    setRevealed(false);
    setErrorMessage(null);
  }, [pad.question, pad.answer]);

  const handleRegenerate = useCallback(async () => {
    if (!onRegenerate || isRegenerating) {
      return;
    }
    setIsRegenerating(true);
    setRevealed(false);
    setErrorMessage(null);
    try {
      await onRegenerate(pad.sectionIndex);
    } catch {
      setErrorMessage('Could not generate a different question. Try again.');
    } finally {
      setIsRegenerating(false);
    }
  }, [isRegenerating, onRegenerate, pad.sectionIndex]);

  return (
    <div
      className={cn(
        'my-6 rounded-lg border border-primary/25 bg-primary/5 px-4 py-4',
        'shadow-sm',
      )}
      data-testid={`scratch-pad-${pad.sectionIndex}`}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Scratchpad
      </p>
      <p className="mt-2 text-base font-medium text-foreground">{pad.question}</p>
      {revealed ? (
        <div className="mt-3 rounded-md border border-border bg-background/80 px-3 py-2 text-sm text-foreground">
          {pad.answer}
        </div>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setRevealed((current) => !current)}
        >
          {revealed ? 'Hide answer' : 'Reveal answer'}
        </Button>
        {onRegenerate ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={isRegenerating}
            onClick={() => {
              void handleRegenerate();
            }}
          >
            <RefreshCw
              size={14}
              className={cn(isRegenerating && 'animate-spin')}
            />
            Generate a different question
          </Button>
        ) : null}
      </div>
      {errorMessage ? (
        <p className="mt-2 text-sm text-destructive">{errorMessage}</p>
      ) : null}
    </div>
  );
}
