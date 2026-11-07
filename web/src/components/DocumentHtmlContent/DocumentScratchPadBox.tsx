import React, { useCallback, useEffect, useState } from 'react';
import type { IScratchPad } from '@shared-types';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge/Badge';
import { Textarea } from '../ui/Textarea';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../ui/Tooltip';
import { RefreshCw, RotateCcw } from 'lucide-react';
import { cn } from '../../lib/utils';

export type ScratchPadInteractionMode = 'reveal' | 'type';

export interface IDocumentScratchPadBox {
  pad: IScratchPad;
  onRegenerate?: (sectionIndex: number) => Promise<void>;
  onClearMemory?: (sectionIndex: number) => Promise<void>;
  onEvaluate?: (
    sectionIndex: number,
    userAnswer: string,
  ) => Promise<{ score: number; hint?: string }>;
}

export function DocumentScratchPadBox({
  pad,
  onRegenerate,
  onClearMemory,
  onEvaluate,
}: IDocumentScratchPadBox) {
  const [mode, setMode] = useState<ScratchPadInteractionMode>('reveal');
  const [revealed, setRevealed] = useState(false);
  const [typedAnswer, setTypedAnswer] = useState('');
  const [checkResult, setCheckResult] = useState<{
    score: number;
    hint?: string;
  } | null>(null);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const memoryCount = pad.avoidedQuestions?.length ?? 0;

  useEffect(() => {
    setRevealed(false);
    setTypedAnswer('');
    setCheckResult(null);
    setErrorMessage(null);
  }, [pad.question, pad.answer]);

  const busy = isRegenerating || isClearing || isChecking;

  const handleRegenerate = useCallback(async () => {
    if (!onRegenerate || busy) {
      return;
    }
    setIsRegenerating(true);
    setRevealed(false);
    setCheckResult(null);
    setErrorMessage(null);
    try {
      await onRegenerate(pad.sectionIndex);
    } catch {
      setErrorMessage('Could not generate a different question. Try again.');
    } finally {
      setIsRegenerating(false);
    }
  }, [busy, onRegenerate, pad.sectionIndex]);

  const handleClearMemory = useCallback(async () => {
    if (!onClearMemory || busy || memoryCount === 0) {
      return;
    }
    setIsClearing(true);
    setErrorMessage(null);
    try {
      await onClearMemory(pad.sectionIndex);
    } catch {
      setErrorMessage('Could not reset memory. Try again.');
    } finally {
      setIsClearing(false);
    }
  }, [busy, memoryCount, onClearMemory, pad.sectionIndex]);

  const handleCheck = useCallback(async () => {
    if (!onEvaluate || busy || !typedAnswer.trim()) {
      return;
    }
    setIsChecking(true);
    setErrorMessage(null);
    try {
      const result = await onEvaluate(pad.sectionIndex, typedAnswer.trim());
      setCheckResult(result);
    } catch {
      setErrorMessage('Could not evaluate your answer. Try again.');
    } finally {
      setIsChecking(false);
    }
  }, [busy, onEvaluate, pad.sectionIndex, typedAnswer]);

  return (
    <div
      className={cn(
        'my-6 rounded-lg border border-primary/25 bg-primary/5 px-4 py-4',
        'shadow-sm',
      )}
      data-testid={`scratch-pad-${pad.sectionIndex}`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Scratchpad
          </p>
          {memoryCount > 0 ? (
            <Badge variant="secondary" title="Questions kept in memory">
              {memoryCount}
            </Badge>
          ) : null}
        </div>
        <div className="inline-flex shrink-0 rounded-md border border-border p-0.5">
          <button
            type="button"
            className={cn(
              'rounded px-2.5 py-1 text-xs font-medium transition-colors',
              mode === 'reveal'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
            onClick={() => setMode('reveal')}
          >
            Reveal
          </button>
          <button
            type="button"
            className={cn(
              'rounded px-2.5 py-1 text-xs font-medium transition-colors',
              mode === 'type'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
            onClick={() => setMode('type')}
          >
            Type
          </button>
        </div>
      </div>

      <p className="mt-3 text-base font-medium text-foreground">{pad.question}</p>

      {mode === 'reveal' ? (
        <>
          {revealed ? (
            <div className="mt-3 rounded-md border border-border bg-background/80 px-3 py-2 text-sm text-foreground">
              {pad.answer}
            </div>
          ) : null}
          <div className="mt-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setRevealed((current) => !current)}
            >
              {revealed ? 'Hide answer' : 'Reveal answer'}
            </Button>
          </div>
        </>
      ) : (
        <div className="mt-3 space-y-2">
          <Textarea
            value={typedAnswer}
            onChange={(event) => setTypedAnswer(event.target.value)}
            placeholder="Type your answer"
            rows={3}
            className="min-h-[72px] resize-y text-sm"
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy || !typedAnswer.trim()}
              onClick={() => {
                void handleCheck();
              }}
            >
              {isChecking ? 'Checking…' : 'Check'}
            </Button>
            {checkResult ? (
              <p className="text-sm text-foreground">
                Score: <span className="font-semibold">{checkResult.score}</span>
                /10
              </p>
            ) : null}
            {checkResult?.hint ? (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="inline-flex items-center rounded-full border border-border bg-background px-2.5 py-0.5 text-xs font-medium text-foreground"
                    >
                      Hint
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-sm text-sm">
                    {checkResult.hint}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : null}
          </div>
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {onRegenerate ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={busy}
            className="gap-2"
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
        {onClearMemory ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={busy || memoryCount === 0}
            className="gap-2"
            onClick={() => {
              void handleClearMemory();
            }}
          >
            <RotateCcw
              size={14}
              className={cn(isClearing && 'animate-spin')}
            />
            Reset
          </Button>
        ) : null}
      </div>
      {errorMessage ? (
        <p className="mt-2 text-sm text-destructive">{errorMessage}</p>
      ) : null}
    </div>
  );
}
