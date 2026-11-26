export const queryKeys = {
  directoryTree: (userId: string) => ['directoryTree', userId] as const,
  directoryItems: (userId: string, directoryId: string) =>
    ['directoryItems', userId, directoryId] as const,
  document: (userId: string, documentId: string) =>
    ['document', userId, documentId] as const,
  documentContent: (userId: string, documentId: string, version: string) =>
    ['documentContent', userId, documentId, version] as const,
  artifact: (userId: string, kind: string, artifactId: string) =>
    ['artifact', userId, kind, artifactId] as const,
  agentThreads: (userId: string) => ['agentThreads', userId] as const,
  agentPromptRules: (userId: string) => ['agentPromptRules', userId] as const,
  suggestedAgentPrompts: () => ['suggestedAgentPrompts'] as const,
  directoryAgentThreads: (userId: string, directoryId: string) =>
    ['agentThreads', userId, 'directory', directoryId] as const,
  agentThread: (userId: string, threadId: string) =>
    ['agentThread', userId, threadId] as const,
  agentTurn: (userId: string, threadId: string, turnId: string) =>
    ['agentTurn', userId, threadId, turnId] as const,
  missedFlashcards: (userId: string) => ['missedFlashcards', userId] as const,
};
