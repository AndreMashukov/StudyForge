import type { IAgentConversationEntry } from '../../services/agentConversation';
import type {
  AgentMessageResponse,
  AgentProposedDelete,
  AgentQuestion,
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
  /**
   * Shows only this conversation (for example the onboarding starter
   * course): no history menu, no new chat, nothing remembered.
   */
  pinnedThreadId?: string;
  /**
   * Opens on this thread instead of the remembered one (`threadId: null` =
   * new chat). Read once when the panel mounts.
   */
  initialThread?: { threadId: string | null };
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

export interface IAgentQuestionCard {
  /** The questions from the latest assistant reply, answered one at a time. */
  questions: AgentQuestion[];
  disabled?: boolean;
  /** Called once with the message holding every answer. */
  onSubmit: (message: string) => void;
  /** Hides the card; the user can still reply in the composer. */
  onDismiss: () => void;
}

export type IAgentMessageResponse = AgentMessageResponse;
