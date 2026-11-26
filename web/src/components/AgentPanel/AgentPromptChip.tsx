import React from 'react';
import { Sparkles, X } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface IAgentPromptChip {
  name: string;
  /** Shown in the composer: removes the picked prompt. */
  onRemove?: () => void;
  className?: string;
}

/** A saved agent prompt ("/" menu, ADR 017) in a message or the composer. */
export const AgentPromptChip: React.FC<IAgentPromptChip> = ({
  name,
  onRemove,
  className,
}) => (
  <span
    className={cn(
      'inline-flex max-w-full items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary',
      className,
    )}
  >
    <Sparkles className="h-3 w-3 shrink-0" aria-hidden="true" />
    <span className="truncate">/{name}</span>
    {onRemove ? (
      <button
        type="button"
        onClick={onRemove}
        className="-mr-0.5 rounded-full p-0.5 hover:bg-primary/20"
        aria-label={`Remove prompt ${name}`}
      >
        <X className="h-3 w-3" aria-hidden="true" />
      </button>
    ) : null}
  </span>
);
