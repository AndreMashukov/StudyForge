export const queryKeys = {
  directoryTree: (userId: string) => ['directoryTree', userId] as const,
  directoryItems: (userId: string, directoryId: string) => ['directoryItems', userId, directoryId] as const,
  document: (userId: string, documentId: string) => ['document', userId, documentId] as const,
  documentContent: (userId: string, documentId: string, version: string) => ['documentContent', userId, documentId, version] as const,
};
