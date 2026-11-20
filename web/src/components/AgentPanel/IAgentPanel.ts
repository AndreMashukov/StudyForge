import type { IAgentConversationEntry } from '../../services/agentConversation';
import type {
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
  /** Text placed in the message box when the panel mounts. Not sent. */
  initialInput?: string;
  className?: string;
}

export interface IAgentChatMessage {
  entry: IAgentConversationEntry;
  /** Delete proposals still awaiting confirmation (confirmed ones are hidden). */
  proposedDeletes: AgentProposedDelete[];
  onDeleteConfirmed: (proposal: AgentProposedDelete) => void;
}

export interface IAgentDeleteProposalCard {
  proposal: AgentProposedDelete;
  onConfirmed: () => void;
}

export type IAgentMessageResponse = AgentMessageResponse;
