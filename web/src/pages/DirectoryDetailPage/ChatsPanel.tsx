import React from 'react';
import { MessageSquare, Plus } from 'lucide-react';
import type { AgentThreadSummary } from '@shared-types';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Spinner';
import { useAppDispatch } from '../../hooks/redux';
import { setAgentLauncherThread } from '../../store/slices/uiSlice';
import { formatDate } from '../../utils/dateUtils';
import { DIRECTORY_CHAT_LIST_LIMIT } from '../../services/agentThreadFirestore';

interface IChatsPanelProps {
  threads: AgentThreadSummary[];
  isLoading: boolean;
  hasError: boolean;
}

/**
 * Directory Chats tab: agent conversations started in this folder (their
 * home folder), newest message first. A row opens the Assistant on it.
 */
export const ChatsPanel: React.FC<IChatsPanelProps> = ({
  threads,
  isLoading,
  hasError,
}) => {
  const dispatch = useAppDispatch();
  const handleOpenThread = (threadId: string | null) => {
    dispatch(setAgentLauncherThread({ threadId }));
  };

  return (
    <div className="space-y-4">
      <div className="flex min-h-10 items-center justify-between gap-2">
        <h2 className="truncate text-lg font-semibold">Chats ({threads.length})</h2>
        <Button
          size="sm"
          type="button"
          onClick={() => handleOpenThread(null)}
          className="gap-1.5"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          New chat
        </Button>
      </div>

      {threads.length >= DIRECTORY_CHAT_LIST_LIMIT ? (
        <p className="text-sm text-muted-foreground">
          Showing the latest {DIRECTORY_CHAT_LIST_LIMIT} chats.
        </p>
      ) : null}

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Spinner size="md" />
        </div>
      ) : hasError ? (
        <div className="py-8 text-center text-sm text-destructive">
          Could not load chats for this folder.
        </div>
      ) : threads.length === 0 ? (
        <div className="py-8 text-center text-sm text-muted-foreground">
          No chats started in this folder yet.
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {threads.map((thread) => (
            <li key={thread.id}>
              <button
                type="button"
                onClick={() => handleOpenThread(thread.id)}
                className="flex w-full items-center gap-3 rounded-lg border border-border p-3 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <MessageSquare size={18} className="shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{thread.title}</div>
                  {thread.preview ? (
                    <div className="truncate text-sm text-muted-foreground">
                      {thread.preview}
                    </div>
                  ) : null}
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatDate(thread.lastMessageAt ?? thread.updatedAt)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
