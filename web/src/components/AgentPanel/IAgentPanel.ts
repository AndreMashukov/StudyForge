import type {
  AgentActionResult,
  AgentMessageResponse,
  AgentProposedDelete,
  AgentScope,
} from '@shared-types';

export interface IAgentPanel {
  scope?: AgentScope;
  directoryId?: string;
  onMutated?: () => void;
  defaultExpanded?: boolean;
  onClose?: () => void;
  variant?: 'embedded' | 'overlay';
}

export interface IAgentChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  executedActions?: AgentActionResult[];
  proposedDeletes?: AgentProposedDelete[];
  isStreaming?: boolean;
  statusMessage?: string;
}

export interface IAgentDeleteProposalCard {
  proposal: AgentProposedDelete;
  onConfirmed: () => void;
}

export type IAgentMessageResponse = AgentMessageResponse;
