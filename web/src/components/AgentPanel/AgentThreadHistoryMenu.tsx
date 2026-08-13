import React from 'react';
import { History, Plus } from 'lucide-react';
import { Button } from '../ui/Button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/DropdownMenu';
import { Spinner } from '../ui/Spinner';
import { formatDate } from '../../utils/dateUtils';
import { cn } from '../../lib/utils';
import { IAgentThreadHistoryMenu } from './IAgentThreadHistoryMenu';

export const AgentThreadHistoryMenu: React.FC<IAgentThreadHistoryMenu> = ({
  threads,
  activeThreadId,
  isLoading = false,
  disabled = false,
  onSelectThread,
  onNewChat,
}) => {
  return (
    <div className="flex shrink-0 items-center gap-1">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={onNewChat}
        disabled={disabled}
        aria-label="New chat"
      >
        <Plus size={16} />
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            disabled={disabled}
            aria-label="Conversation history"
          >
            {isLoading ? <Spinner size="xs" /> : <History size={16} />}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72 p-1">
          <DropdownMenuItem onClick={onNewChat} disabled={disabled}>
            <Plus size={14} className="mr-2 shrink-0" />
            New chat
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {threads.length === 0 ? (
            <p className="px-2 py-3 text-xs text-muted-foreground">
              No saved conversations yet.
            </p>
          ) : (
            <div className="max-h-64 overflow-y-auto">
              {threads.map((thread) => {
                const isActive = thread.id === activeThreadId;
                return (
                  <DropdownMenuItem
                    key={thread.id}
                    onClick={() => onSelectThread(thread.id)}
                    disabled={disabled}
                    className={cn(
                      'flex flex-col items-start gap-0.5 whitespace-normal text-left',
                      isActive && 'bg-muted/60',
                    )}
                  >
                    <span className="line-clamp-1 w-full text-sm font-medium">
                      {thread.title}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(thread.lastMessageAt ?? thread.updatedAt)}
                    </span>
                  </DropdownMenuItem>
                );
              })}
            </div>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};
