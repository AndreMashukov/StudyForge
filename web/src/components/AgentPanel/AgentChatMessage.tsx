import React from 'react';
import type { AgentProposedDelete } from '@shared-types';
import { normalizeAgentReplyMarkdown } from '@shared-types';
import { MarkdownRenderer } from '../MarkdownRenderer';
import { Spinner } from '../ui/Spinner';
import { cn } from '../../lib/utils';
import { stripAgentThinkingContent } from '../../utils/stripAgentThinkingContent';
import { AgentDeleteProposalCard } from './AgentDeleteProposalCard';
import type { IAgentChatMessage } from './IAgentPanel';
import { useSmoothedText } from './hooks/useSmoothedText';
import { AgentPromptChip } from './AgentPromptChip';

const TURN_STATUS_LABELS: Record<string, string> = {
  cancelled: 'Stopped',
  failed: "Couldn't finish",
  incomplete: 'Incomplete',
};

function liveStatusText(entry: IAgentChatMessage['entry']): string {
  const live = entry.live;
  if (!live) {
    return '';
  }
  if (live.cancelRequested) {
    return 'Stopping...';
  }
  if (live.statusMessage) {
    return live.statusMessage;
  }
  return live.status === 'queued' ? 'Starting...' : 'Planning...';
}

export const AgentChatMessage: React.FC<IAgentChatMessage> = ({
  entry,
  proposedDeletes,
  onDeleteConfirmed,
}) => {
  const isAssistant = entry.role === 'assistant';
  const isLive = Boolean(entry.live);
  const content = isAssistant
    ? normalizeAgentReplyMarkdown(stripAgentThinkingContent(entry.content))
    : stripAgentThinkingContent(entry.content);
  const shownContent = useSmoothedText(content, isLive);
  const statusLabel = entry.turnStatus
    ? TURN_STATUS_LABELS[entry.turnStatus]
    : undefined;

  if (isAssistant && isLive && shownContent.trim().length === 0) {
    return (
      <div className="flex justify-start">
        <div className="flex flex-col gap-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Spinner size="xs" />
            {liveStatusText(entry)}
          </div>
          {entry.live?.stuck ? (
            <p className="text-xs">
              Still working. This is taking longer than usual.
            </p>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className={cn('flex', isAssistant ? 'justify-start' : 'justify-end')}>
      <div
        className={cn(
          'max-w-[88%] rounded-lg border px-3 py-2 text-sm leading-relaxed',
          isAssistant
            ? 'border-border bg-background text-foreground'
            : 'border-primary/30 bg-primary/15 text-foreground',
          entry.pending ? 'opacity-70' : undefined,
        )}
      >
        {isAssistant && isLive ? (
          <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
            <Spinner size="xs" />
            <span>{liveStatusText(entry)}</span>
          </div>
        ) : null}

        {isAssistant ? (
          shownContent.trim().length > 0 ? (
            <MarkdownRenderer
              content={shownContent}
              richContent
              deferRichBlocks={isLive}
              className="[&_p:last-child]:!mb-0 [&_ul:last-child]:!mb-0 [&_ol:last-child]:!mb-0 [&_blockquote:last-child]:!mb-0 [&_>div:last-child]:!mb-0"
            />
          ) : (
            <p className="text-muted-foreground">No response text.</p>
          )
        ) : (
          <>
            {entry.agentPromptName ? (
              <AgentPromptChip name={entry.agentPromptName} />
            ) : null}
            {entry.content.trim().length > 0 ? (
              <p
                className={cn(
                  'whitespace-pre-wrap',
                  entry.agentPromptName ? 'mt-1' : undefined,
                )}
              >
                {entry.content}
              </p>
            ) : null}
          </>
        )}

        {isAssistant && entry.live?.stuck ? (
          <p className="mt-2 text-xs text-muted-foreground">
            Still working. This is taking longer than usual.
          </p>
        ) : null}

        {statusLabel ? (
          <p className="mt-2 text-xs text-muted-foreground">{statusLabel}</p>
        ) : null}

        {entry.executedActions.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {entry.executedActions.map((action, index) => (
              <span
                key={`${entry.id}-action-${index}`}
                className="rounded-full border border-border bg-muted/40 px-2 py-1 text-xs text-muted-foreground"
              >
                {action.summary}
              </span>
            ))}
          </div>
        ) : null}

        {!isLive && proposedDeletes.length > 0 ? (
          <div className="mt-3 space-y-2">
            {proposedDeletes.map((proposal: AgentProposedDelete) => (
              <AgentDeleteProposalCard
                key={`${proposal.targetType}-${proposal.targetId}`}
                proposal={proposal}
                onConfirmed={() => onDeleteConfirmed(proposal)}
              />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
};
