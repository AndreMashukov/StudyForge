import React, { useEffect, useRef, useState } from 'react';
import {
  Check,
  ChevronLeft,
  CornerDownLeft,
  MessageCircleQuestion,
  PenLine,
  X,
} from 'lucide-react';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { cn } from '../../lib/utils';
import {
  buildAgentQuestionFlowMessage,
  INITIAL_AGENT_QUESTION_FLOW,
  initialAgentQuestionHighlight,
  isAgentQuestionFlowComplete,
  previousAgentQuestionAnswer,
  reduceAgentQuestionFlow,
  type AgentQuestionFlowAction,
} from '../../services/agentQuestionFlow';
import type { IAgentQuestionCard } from './IAgentPanel';

const MAX_OTHER_ANSWER_LENGTH = 500;

/**
 * The agent's clarifying questions, one at a time: numbered options with the
 * recommended one pre-selected, an optional free-text answer, Back and Skip.
 * Keyboard: ↑/↓ to move, 1–9 to pick, Enter to choose, Esc to dismiss.
 */
export const AgentQuestionCard: React.FC<IAgentQuestionCard> = ({
  questions,
  disabled = false,
  onSubmit,
  onDismiss,
}) => {
  const [flow, setFlow] = useState(INITIAL_AGENT_QUESTION_FLOW);
  const question = questions[Math.min(flow.index, questions.length - 1)];
  const previous = previousAgentQuestionAnswer(flow);
  const previousOptionIndex = question.options.findIndex(
    (option) => option.label === previous,
  );
  const previousWasOther =
    typeof previous === 'string' && previousOptionIndex < 0;
  const otherIndex = question.options.length;
  const rowCount = question.allowOther ? otherIndex + 1 : otherIndex;

  const [highlight, setHighlight] = useState(() =>
    initialAgentQuestionHighlight(question),
  );
  const [otherOpen, setOtherOpen] = useState(false);
  const [otherText, setOtherText] = useState('');
  const rowRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const otherInputRef = useRef<HTMLInputElement | null>(null);

  // A new question on screen: highlight its earlier answer, else the recommendation.
  useEffect(() => {
    const start = previousWasOther
      ? otherIndex
      : previousOptionIndex >= 0
        ? previousOptionIndex
        : initialAgentQuestionHighlight(question);
    setHighlight(start);
    setOtherOpen(previousWasOther);
    setOtherText(
      previousWasOther && typeof previous === 'string' ? previous : '',
    );
    if (!previousWasOther) {
      rowRefs.current[start]?.focus({ preventScroll: true });
    }
    // Only when the question changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flow.index]);

  useEffect(() => {
    if (otherOpen) {
      otherInputRef.current?.focus();
    }
  }, [otherOpen]);

  const dispatch = (action: AgentQuestionFlowAction) => {
    if (disabled) {
      return;
    }
    const next = reduceAgentQuestionFlow(flow, action, questions.length);
    if (isAgentQuestionFlowComplete(next, questions.length)) {
      onSubmit(buildAgentQuestionFlowMessage(questions, next));
      return;
    }
    setFlow(next);
  };

  const submitOther = () => {
    const text = otherText.trim();
    if (text) {
      dispatch({ type: 'answer', answer: text });
    }
  };

  const moveHighlight = (delta: number) => {
    const next = (highlight + delta + rowCount) % rowCount;
    setHighlight(next);
    rowRefs.current[next]?.focus();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onDismiss();
      return;
    }
    if (event.target instanceof HTMLInputElement) {
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      moveHighlight(event.key === 'ArrowDown' ? 1 : -1);
      return;
    }
    const digit = Number.parseInt(event.key, 10);
    if (
      Number.isInteger(digit) &&
      digit >= 1 &&
      digit <= question.options.length
    ) {
      event.preventDefault();
      dispatch({ type: 'answer', answer: question.options[digit - 1].label });
    }
  };

  return (
    <div
      role="group"
      aria-label="The agent has a question"
      className="mx-3 mt-3 max-h-[38dvh] sm:max-h-[min(32rem,55dvh)] overflow-y-auto overscroll-contain rounded-xl border border-primary/30 bg-card shadow-sm"
      onKeyDown={handleKeyDown}
    >
      <div className="flex items-center justify-between gap-2 px-4 pt-3">
        <div className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
          <MessageCircleQuestion
            className="h-4 w-4 shrink-0 text-primary"
            aria-hidden="true"
          />
          {question.header ? (
            <span className="truncate font-medium text-foreground">
              {question.header}
            </span>
          ) : null}
          {questions.length > 1 ? (
            <span className="shrink-0">
              {flow.index + 1} of {questions.length}
            </span>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
          aria-label="Dismiss questions"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      {questions.length > 1 ? (
        <div className="flex gap-1 px-4 pt-2" aria-hidden="true">
          {questions.map((entry, index) => (
            <span
              key={entry.id}
              className={cn(
                'h-1 flex-1 rounded-full',
                index < flow.index
                  ? 'bg-primary'
                  : index === flow.index
                    ? 'bg-primary/50'
                    : 'bg-muted',
              )}
            />
          ))}
        </div>
      ) : null}

      <p className="px-4 pt-3 text-sm font-medium leading-snug text-foreground">
        {question.question}
      </p>

      <div className="space-y-1.5 px-3 pt-3" role="list">
        {question.options.map((option, index) => {
          const isHighlighted = highlight === index;
          const wasChosen = previousOptionIndex === index;
          return (
            <button
              key={option.label}
              ref={(element) => {
                rowRefs.current[index] = element;
              }}
              type="button"
              role="listitem"
              disabled={disabled}
              onClick={() => dispatch({ type: 'answer', answer: option.label })}
              onMouseEnter={() => setHighlight(index)}
              onFocus={() => setHighlight(index)}
              className={cn(
                'flex w-full items-start gap-3 rounded-lg border px-3 py-2.5 text-left text-sm outline-none transition-colors disabled:opacity-60',
                isHighlighted
                  ? 'border-primary/60 bg-primary/10'
                  : 'border-border hover:bg-muted/50',
              )}
            >
              <kbd
                className={cn(
                  'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border font-sans text-[11px]',
                  isHighlighted
                    ? 'border-primary/50 text-primary'
                    : 'border-border text-muted-foreground',
                )}
              >
                {index + 1}
              </kbd>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2 font-medium text-foreground">
                  {option.label}
                  {option.recommended ? (
                    <Badge
                      variant="secondary"
                      className="px-2 py-0 text-[11px] font-medium"
                    >
                      Recommended
                    </Badge>
                  ) : null}
                </span>
                {option.description ? (
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {option.description}
                  </span>
                ) : null}
              </span>
              {wasChosen ? (
                <Check
                  className="mt-0.5 h-4 w-4 shrink-0 text-primary"
                  aria-label="Your earlier answer"
                />
              ) : null}
            </button>
          );
        })}

        {question.allowOther ? (
          otherOpen ? (
            <form
              className="flex items-center gap-2 rounded-lg border border-primary/60 bg-primary/5 p-1.5 pl-3"
              onSubmit={(event) => {
                event.preventDefault();
                submitOther();
              }}
            >
              <PenLine
                className="h-4 w-4 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                ref={otherInputRef}
                value={otherText}
                onChange={(event) =>
                  setOtherText(
                    event.target.value.slice(0, MAX_OTHER_ANSWER_LENGTH),
                  )
                }
                placeholder="Type your answer"
                aria-label="Your own answer"
                disabled={disabled}
                className="h-8 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
              />
              <Button
                type="submit"
                size="sm"
                disabled={disabled || !otherText.trim()}
                className="h-8 shrink-0 gap-1.5"
              >
                <CornerDownLeft className="h-3.5 w-3.5" aria-hidden="true" />
                Answer
              </Button>
            </form>
          ) : (
            <button
              ref={(element) => {
                rowRefs.current[otherIndex] = element;
              }}
              type="button"
              disabled={disabled}
              onClick={() => setOtherOpen(true)}
              onMouseEnter={() => setHighlight(otherIndex)}
              onFocus={() => setHighlight(otherIndex)}
              className={cn(
                'flex w-full items-center gap-3 rounded-lg border border-dashed px-3 py-2.5 text-left text-sm text-muted-foreground outline-none transition-colors disabled:opacity-60',
                highlight === otherIndex
                  ? 'border-primary/60 bg-primary/5 text-foreground'
                  : 'border-border hover:bg-muted/50',
              )}
            >
              <PenLine className="h-4 w-4 shrink-0" aria-hidden="true" />
              Something else…
            </button>
          )
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-2 px-3 pb-3 pt-2">
        <div className="flex items-center gap-1">
          {flow.index > 0 ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 gap-1 px-2 text-muted-foreground"
              onClick={() => dispatch({ type: 'back' })}
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              Back
            </Button>
          ) : null}
          <span className="hidden px-1 text-[11px] text-muted-foreground sm:inline">
            ↑↓ to move · Enter to choose · Esc to dismiss
          </span>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 px-2 text-muted-foreground"
          disabled={disabled}
          onClick={() => dispatch({ type: 'skip' })}
        >
          Skip
        </Button>
      </div>
    </div>
  );
};
