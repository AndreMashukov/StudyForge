/**
 * Channel names for the directory chat LangGraph pipeline.
 * Nodes must reference these keys, not string literals.
 */
export const DIRECTORY_CHAT_PIPELINE_STATE_KEYS = {
  userId: 'userId',
  directoryId: 'directoryId',
  threadId: 'threadId',
  assembledPrompt: 'assembledPrompt',
  messages: 'messages',
  shouldSummarize: 'shouldSummarize',
  summaryText: 'summaryText',
  selectedDocumentIds: 'selectedDocumentIds',
  assistantResponse: 'assistantResponse',
  assistantMessage: 'assistantMessage',
  directoryChatOutcome: 'directoryChatOutcome',
  failureMessage: 'failureMessage',
} as const;

export type DirectoryChatPipelineStateKey =
  (typeof DIRECTORY_CHAT_PIPELINE_STATE_KEYS)[keyof typeof DIRECTORY_CHAT_PIPELINE_STATE_KEYS];
