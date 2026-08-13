import type { AgentThreadSummary } from '@shared-types';

export interface IAgentThreadHistoryMenu {
  threads: AgentThreadSummary[];
  activeThreadId?: string;
  isLoading?: boolean;
  disabled?: boolean;
  onSelectThread: (threadId: string) => void;
  onNewChat: () => void;
}
