import React from 'react';
import { FileText, Folder, ScrollText, X } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/Tooltip';
import { cn } from '../../lib/utils';
import type { IAgentLocationContext } from './useAgentLocationContext';

export interface IAgentContextPill {
  locationContext: IAgentLocationContext;
  onRemove: () => void;
  disabled?: boolean;
}

export interface IAgentRestoreContextPill {
  onRestore: () => void;
  disabled?: boolean;
}

export const AgentContextPill: React.FC<IAgentContextPill> = ({
  locationContext,
  onRemove,
  disabled = false,
}) => {
  const Icon =
    locationContext.kind === 'document'
      ? FileText
      : locationContext.kind === 'rule'
        ? ScrollText
        : Folder;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              'inline-flex max-w-full items-center gap-1.5 rounded-full border border-border bg-muted/40 py-1 pl-2.5 pr-1 text-xs text-muted-foreground',
              disabled && 'opacity-60',
            )}
          >
            <Icon size={12} className="shrink-0" aria-hidden="true" />
            <span className="truncate">{locationContext.label}</span>
            <button
              type="button"
              onClick={onRemove}
              disabled={disabled}
              className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none"
              aria-label="Remove context"
            >
              <X size={12} />
            </button>
          </span>
        </TooltipTrigger>
        <TooltipContent side="top">{locationContext.tooltipPath}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export const AgentRestoreContextPill: React.FC<IAgentRestoreContextPill> = ({
  onRestore,
  disabled = false,
}) => {
  return (
    <button
      type="button"
      onClick={onRestore}
      disabled={disabled}
      className={cn(
        'inline-flex max-w-full items-center rounded-full border border-dashed border-border px-2.5 py-1 text-xs text-muted-foreground transition-colors',
        'hover:border-foreground/30 hover:bg-muted/50 hover:text-foreground',
        'disabled:pointer-events-none disabled:opacity-60',
      )}
    >
      Add current context
    </button>
  );
};
