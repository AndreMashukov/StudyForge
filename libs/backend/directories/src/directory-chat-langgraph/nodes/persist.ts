import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { computeExpiresAt } from '@study-forge/backend-core/lib/firestore-ttl';
import { FirestorePaths } from '@study-forge/backend-core/lib/firestore-paths';
import { DIRECTORY_CHAT_PIPELINE_STATE_KEYS } from '../../directory-chat-pipeline-state-keys';
import type { DirectoryChatState } from '../state';
import { DirectoryChatStateValue } from '../state';
import { logNodeEnter, logNodeExitError, logNodeExitOk } from './node-logger';

const NODE_NAME = 'persist';

export type PersistNodeResult = Partial<DirectoryChatState>;

export async function persistNode(
  state: typeof DirectoryChatStateValue.State
): Promise<PersistNodeResult> {
  logNodeEnter(NODE_NAME, state);
  try {
    const userId = state[DIRECTORY_CHAT_PIPELINE_STATE_KEYS.userId];
    const directoryId = state[DIRECTORY_CHAT_PIPELINE_STATE_KEYS.directoryId];
    const assistantMessage = state[DIRECTORY_CHAT_PIPELINE_STATE_KEYS.assistantMessage];
    const summaryText = state[DIRECTORY_CHAT_PIPELINE_STATE_KEYS.summaryText];
    const selectedDocumentIds =
      state[DIRECTORY_CHAT_PIPELINE_STATE_KEYS.selectedDocumentIds] ?? [];

    if (!userId || !directoryId || !assistantMessage) {
      return {
        [DIRECTORY_CHAT_PIPELINE_STATE_KEYS.directoryChatOutcome]: 'failed',
        [DIRECTORY_CHAT_PIPELINE_STATE_KEYS.failureMessage]:
          'Persist node requires userId, directoryId, and assistantMessage',
      };
    }

    const assistantCreatedAt = new Date(assistantMessage.createdAt);
    await FirestorePaths.directoryChatMessages(userId, directoryId)
      .doc(assistantMessage.id)
      .set({
        role: 'assistant',
        content: assistantMessage.content,
        createdAt: Timestamp.fromDate(assistantCreatedAt),
        expiresAt: computeExpiresAt(assistantCreatedAt, 'directoryChat'),
      });

    const threadUpdatedAt = new Date();
    await FirestorePaths.directoryChatThread(userId, directoryId).set(
      {
        directoryId,
        updatedAt: FieldValue.serverTimestamp(),
        expiresAt: computeExpiresAt(threadUpdatedAt, 'directoryChat'),
        ...(summaryText ? { summary: summaryText } : {}),
        ...(selectedDocumentIds.length > 0
          ? { selectedDocumentIds }
          : {}),
      },
      { merge: true }
    );

    const result = {
      [DIRECTORY_CHAT_PIPELINE_STATE_KEYS.directoryChatOutcome]: 'completed',
    } as PersistNodeResult;

    logNodeExitOk(NODE_NAME, state);
    return result;
  } catch (err) {
    logNodeExitError(NODE_NAME, state, err);
    const message =
      err instanceof Error ? err.message : 'Failed to persist directory chat thread';
    return {
      [DIRECTORY_CHAT_PIPELINE_STATE_KEYS.directoryChatOutcome]: 'failed',
      [DIRECTORY_CHAT_PIPELINE_STATE_KEYS.failureMessage]: message,
    };
  }
}
