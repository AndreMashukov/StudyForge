import type { useRouter } from 'expo-router';

export interface IStartChat {
  message: string;
  directoryId?: string | null;
  documentId?: string;
  label?: string;
}

/** Open a new assistant chat. A directory (or a document's directory) scopes it to the directory-scoped agent. */
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
    },
  });
}
