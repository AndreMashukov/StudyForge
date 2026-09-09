import { Annotation } from '@langchain/langgraph';
import type {
  DirectoryChatMessage,
  DirectoryChatPromptContext,
} from '@shared-types';
import { DIRECTORY_CHAT_PIPELINE_STATE_KEYS } from '../directory-chat-pipeline-state-keys';

export type DirectoryChatPipelineOutcome = 'completed' | 'failed';

export const DirectoryChatStateAnnotation = Annotation.Root({
  [DIRECTORY_CHAT_PIPELINE_STATE_KEYS.userId]: Annotation<string>(),
  [DIRECTORY_CHAT_PIPELINE_STATE_KEYS.directoryId]: Annotation<string>(),
  [DIRECTORY_CHAT_PIPELINE_STATE_KEYS.threadId]: Annotation<string>(),
  [DIRECTORY_CHAT_PIPELINE_STATE_KEYS.assembledPrompt]:
    Annotation<DirectoryChatPromptContext>(),
  [DIRECTORY_CHAT_PIPELINE_STATE_KEYS.messages]: Annotation<
    DirectoryChatMessage[]
  >({
    reducer: (current, update) => current.concat(update),
    default: () => [],
  }),
  [DIRECTORY_CHAT_PIPELINE_STATE_KEYS.shouldSummarize]: Annotation<
    boolean | undefined
  >(),
  [DIRECTORY_CHAT_PIPELINE_STATE_KEYS.summaryText]: Annotation<
    string | undefined
  >(),
  [DIRECTORY_CHAT_PIPELINE_STATE_KEYS.selectedDocumentIds]: Annotation<
    string[]
  >(),
  [DIRECTORY_CHAT_PIPELINE_STATE_KEYS.assistantResponse]: Annotation<
    string | undefined
  >(),
  [DIRECTORY_CHAT_PIPELINE_STATE_KEYS.assistantMessage]: Annotation<
    DirectoryChatMessage | undefined
  >(),
  [DIRECTORY_CHAT_PIPELINE_STATE_KEYS.directoryChatOutcome]: Annotation<
    DirectoryChatPipelineOutcome | undefined
  >(),
  [DIRECTORY_CHAT_PIPELINE_STATE_KEYS.failureMessage]: Annotation<
    string | undefined
  >(),
});

export type DirectoryChatState = typeof DirectoryChatStateAnnotation.State;

export const DirectoryChatStateValue = DirectoryChatStateAnnotation;
