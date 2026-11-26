import type { useRouter } from 'expo-router';
import type { IAgentPromptMenuItem } from '@shared-types';

export interface IStartChat {
  message: string;
  /** A saved agent prompt to run first ("/" menu, ADR 017). */
  agentPrompt?: IAgentPromptMenuItem;
  directoryId?: string | null;
  documentId?: string;
  label?: string;
}

/** Open a new assistant chat. A directory (or a document's directory) is its context; a directory chat lists under that folder's Chats. */
export function startChat(
  router: ReturnType<typeof useRouter>,
  input: IStartChat,
): void {
  router.push({
    pathname: '/chat/[threadId]',
    params: {
      threadId: 'new',
      message: input.message,
      ...(input.directoryId ? { directoryId: input.directoryId } : {}),
      ...(input.documentId ? { documentId: input.documentId } : {}),
      ...(input.label ? { label: input.label } : {}),
      ...(input.agentPrompt
        ? {
            promptSource: input.agentPrompt.source,
            promptId: input.agentPrompt.id,
            promptName: input.agentPrompt.name,
          }
        : {}),
    },
  });
}
