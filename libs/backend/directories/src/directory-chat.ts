import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import {
  DirectoryChatArtifactContext,
  DirectoryChatMessage,
  DirectoryChatSourceSummary,
  GetDirectoryChatResponse,
  SendDirectoryChatMessageResponse,
  UpdateDirectoryChatSourcesResponse,
} from '@shared-types';
import { computeExpiresAt } from '@study-forge/backend-core/lib/firestore-ttl';
import { FirestorePaths } from '@study-forge/backend-core/lib/firestore-paths';
import { directoryService } from './directory';
import { DirectoryChatContextAssembler } from './directory-chat-context-assembler';
import { LlmGenerationService } from '@study-forge/backend-llm/llm';

const MAX_USER_MESSAGE_LENGTH = 4000;
const MAX_MESSAGES_RETURNED = 200;
const SUMMARY_TRIGGER_MESSAGE_COUNT = 12;
const SUMMARY_RECENT_MESSAGE_COUNT = 8;
const SUMMARY_MAX_CHARS = 6000;

interface StoredChatMessage {
  role: 'user' | 'assistant';
  content: string;
  createdAt?: Timestamp;
  seedKey?: string;
}

interface DirectoryChatSourceState {
  sources: DirectoryChatSourceSummary[];
  selectedDocumentIds: string[];
  documentCount: number;
}

type ThreadDocumentData = FirebaseFirestore.DocumentData | undefined;

export class DirectoryChatService {
  private static readonly contextAssembler = new DirectoryChatContextAssembler();

  static async getChat(userId: string, directoryId: string): Promise<GetDirectoryChatResponse> {
    const directory = await directoryService.getDirectory(userId, directoryId);
    if (!directory) {
      throw new Error('Directory not found');
    }

    const [messages, threadSnapshot] = await Promise.all([
      this.getMessages(userId, directoryId),
      FirestorePaths.directoryChatThread(userId, directoryId).get(),
    ]);
    const threadData = threadSnapshot.data();
    const summary = this.extractSummary(threadData);
    const sourceState = await this.resolveSourceState(userId, directoryId, threadData);

    return {
      directoryId,
      documentCount: sourceState.documentCount,
      selectedDocumentIds: sourceState.selectedDocumentIds,
      sources: sourceState.sources,
      messages,
      ...(summary ? { summary } : {}),
    };
  }

  static async updateSelectedSources(
    userId: string,
    directoryId: string,
    selectedDocumentIds: string[]
  ): Promise<UpdateDirectoryChatSourcesResponse> {
    const directory = await directoryService.getDirectory(userId, directoryId);
    if (!directory) {
      throw new Error('Directory not found');
    }

    if (!Array.isArray(selectedDocumentIds) || selectedDocumentIds.length === 0) {
      throw new Error('Select at least one source for chat.');
    }

    const sourceState = await this.resolveSourceState(userId, directoryId);
    const availableIds = new Set(sourceState.sources.map((source) => source.id));
    const invalidIds = selectedDocumentIds.filter((id) => !availableIds.has(id));

    if (invalidIds.length > 0) {
      throw new Error('One or more selected sources are not available in this directory.');
    }

    await this.persistSelectedDocumentIds(userId, directoryId, selectedDocumentIds);

    return {
      directoryId,
      documentCount: sourceState.documentCount,
      selectedDocumentIds,
      sources: sourceState.sources,
    };
  }

  static async sendMessage(
    userId: string,
    directoryId: string,
    message: string,
    seedKey?: string,
    artifactContext?: DirectoryChatArtifactContext
  ): Promise<SendDirectoryChatMessageResponse> {
    const trimmedMessage = message.trim();
    if (!trimmedMessage) {
      throw new Error('Message is required');
    }

    if (trimmedMessage.length > MAX_USER_MESSAGE_LENGTH) {
      throw new Error(`Message must be ${MAX_USER_MESSAGE_LENGTH} characters or less`);
    }

    const directory = await directoryService.getDirectory(userId, directoryId);
    if (!directory) {
      throw new Error('Directory not found');
    }

    const threadSnapshot = await FirestorePaths.directoryChatThread(userId, directoryId).get();
    const threadData = threadSnapshot.data();
    const summary = this.extractSummary(threadData);
    const sourceState = await this.resolveSourceState(userId, directoryId, threadData);

    if (sourceState.selectedDocumentIds.length === 0) {
      throw new Error('Select at least one source for chat.');
    }

    if (seedKey) {
      const existing = await this.findSeededMessage(userId, directoryId, seedKey);
      if (existing) {
        const messages = await this.getMessages(userId, directoryId);
        const existingIndex = messages.findIndex((item) => item.id === existing.id);
        const assistantMessage = existingIndex >= 0
          ? messages.slice(existingIndex + 1).find((item) => item.role === 'assistant')
          : undefined;

        return {
          directoryId,
          documentCount: sourceState.documentCount,
          selectedDocumentIds: sourceState.selectedDocumentIds,
          sources: sourceState.sources,
          userMessage: existing,
          ...(assistantMessage ? { assistantMessage } : {}),
          messages,
          ...(summary ? { summary } : {}),
        };
      }
    }

    const previousMessages = await this.getMessages(userId, directoryId);
    const { promptContext } = await this.contextAssembler.assemble({
      userId,
      directory,
      message: trimmedMessage,
      previousMessages,
      conversationSummary: summary,
      artifactContext,
      selectedDocumentIds: sourceState.selectedDocumentIds,
    });

    const now = new Date();
    const userMessageRef = FirestorePaths.directoryChatMessages(userId, directoryId).doc();
    const userMessage: DirectoryChatMessage = {
      id: userMessageRef.id,
      role: 'user',
      content: trimmedMessage,
      createdAt: now.toISOString(),
      ...(seedKey ? { seedKey } : {}),
    };

    await this.ensureThread(userId, directoryId, summary, sourceState.selectedDocumentIds);
    await userMessageRef.set({
      role: 'user',
      content: trimmedMessage,
      createdAt: Timestamp.fromDate(now),
      expiresAt: computeExpiresAt(now, 'directoryChat'),
      ...(seedKey ? { seedKey } : {}),
      ...(artifactContext ? { artifactContext } : {}),
    });

    const answer = await LlmGenerationService.generateDirectoryChatAnswer(userId, promptContext);
    const assistantNow = new Date();
    const assistantMessageRef = FirestorePaths.directoryChatMessages(userId, directoryId).doc();
    const assistantMessage: DirectoryChatMessage = {
      id: assistantMessageRef.id,
      role: 'assistant',
      content: answer,
      createdAt: assistantNow.toISOString(),
    };

    await assistantMessageRef.set({
      role: 'assistant',
      content: answer,
      createdAt: Timestamp.fromDate(assistantNow),
      expiresAt: computeExpiresAt(assistantNow, 'directoryChat'),
    });

    const messages = [...previousMessages, userMessage, assistantMessage];
    const nextSummary = await this.updateThreadAfterMessage(
      userId,
      directoryId,
      messages,
      summary,
      sourceState.selectedDocumentIds
    );

    return {
      directoryId,
      documentCount: sourceState.documentCount,
      selectedDocumentIds: sourceState.selectedDocumentIds,
      sources: sourceState.sources,
      userMessage,
      assistantMessage,
      messages,
      ...(nextSummary ? { summary: nextSummary } : {}),
    };
  }

  private static async resolveSourceState(
    userId: string,
    directoryId: string,
    threadData?: ThreadDocumentData
  ): Promise<DirectoryChatSourceState> {
    const docsSnapshot = await FirestorePaths.documents(userId)
      .where('directoryId', '==', directoryId)
      .get();

    const sources = docsSnapshot.docs.map((docSnapshot) => {
      const data = docSnapshot.data();
      const title = typeof data.title === 'string' && data.title.trim()
        ? data.title.trim()
        : 'Untitled';

      return {
        id: docSnapshot.id,
        title,
      };
    });

    const allDocumentIds = sources.map((source) => source.id);
    const storedSelectedDocumentIds = threadData === undefined
      ? await this.fetchStoredSelectedDocumentIds(userId, directoryId)
      : this.extractSelectedDocumentIds(threadData);
    const selectedDocumentIds = this.normalizeSelectedDocumentIds(
      storedSelectedDocumentIds,
      allDocumentIds
    );

    const shouldPersistSelection =
      allDocumentIds.length > 0 &&
      (
        storedSelectedDocumentIds === undefined ||
        storedSelectedDocumentIds.length === 0 ||
        selectedDocumentIds.length !== storedSelectedDocumentIds.length ||
        selectedDocumentIds.some((id, index) => id !== storedSelectedDocumentIds[index])
      );

    if (shouldPersistSelection) {
      await this.persistSelectedDocumentIds(userId, directoryId, selectedDocumentIds);
    }

    return {
      sources,
      selectedDocumentIds,
      documentCount: sources.length,
    };
  }

  private static normalizeSelectedDocumentIds(
    storedSelectedDocumentIds: string[] | undefined,
    allDocumentIds: string[]
  ): string[] {
    if (allDocumentIds.length === 0) {
      return [];
    }

    if (!storedSelectedDocumentIds || storedSelectedDocumentIds.length === 0) {
      return [...allDocumentIds];
    }

    const availableIds = new Set(allDocumentIds);
    const validSelectedIds = storedSelectedDocumentIds.filter((id) => availableIds.has(id));

    return validSelectedIds.length > 0 ? validSelectedIds : [...allDocumentIds];
  }

  private static extractSummary(threadData?: ThreadDocumentData): string | undefined {
    const summary = threadData?.summary;
    return typeof summary === 'string' && summary.trim() ? summary : undefined;
  }

  private static extractSelectedDocumentIds(
    threadData?: ThreadDocumentData
  ): string[] | undefined {
    const selectedDocumentIds = threadData?.selectedDocumentIds;

    if (!Array.isArray(selectedDocumentIds)) {
      return undefined;
    }

    return selectedDocumentIds.filter((id): id is string => typeof id === 'string' && id.length > 0);
  }

  private static async fetchStoredSelectedDocumentIds(
    userId: string,
    directoryId: string
  ): Promise<string[] | undefined> {
    const threadSnapshot = await FirestorePaths.directoryChatThread(userId, directoryId).get();
    return this.extractSelectedDocumentIds(threadSnapshot.data());
  }

  private static async persistSelectedDocumentIds(
    userId: string,
    directoryId: string,
    selectedDocumentIds: string[]
  ): Promise<void> {
    const threadUpdatedAt = new Date();
    await FirestorePaths.directoryChatThread(userId, directoryId).set(
      {
        directoryId,
        selectedDocumentIds,
        updatedAt: FieldValue.serverTimestamp(),
        expiresAt: computeExpiresAt(threadUpdatedAt, 'directoryChat'),
      },
      { merge: true }
    );
  }

  private static async ensureThread(
    userId: string,
    directoryId: string,
    summary?: string,
    selectedDocumentIds?: string[]
  ): Promise<void> {
    const threadUpdatedAt = new Date();
    await FirestorePaths.directoryChatThread(userId, directoryId).set(
      {
        directoryId,
        updatedAt: FieldValue.serverTimestamp(),
        expiresAt: computeExpiresAt(threadUpdatedAt, 'directoryChat'),
        ...(summary ? { summary } : {}),
        ...(selectedDocumentIds ? { selectedDocumentIds } : {}),
      },
      { merge: true }
    );
  }

  private static async updateThreadAfterMessage(
    userId: string,
    directoryId: string,
    messages: DirectoryChatMessage[],
    currentSummary?: string,
    selectedDocumentIds?: string[]
  ): Promise<string | undefined> {
    const nextSummary = this.buildRollingSummary(messages, currentSummary);
    const threadUpdatedAt = new Date();

    await FirestorePaths.directoryChatThread(userId, directoryId).set(
      {
        directoryId,
        updatedAt: FieldValue.serverTimestamp(),
        expiresAt: computeExpiresAt(threadUpdatedAt, 'directoryChat'),
        ...(nextSummary ? { summary: nextSummary } : {}),
        ...(selectedDocumentIds ? { selectedDocumentIds } : {}),
      },
      { merge: true }
    );

    return nextSummary;
  }

  private static buildRollingSummary(
    messages: DirectoryChatMessage[],
    currentSummary?: string
  ): string | undefined {
    if (messages.length <= SUMMARY_TRIGGER_MESSAGE_COUNT) {
      return currentSummary;
    }

    const olderMessages = messages.slice(0, -SUMMARY_RECENT_MESSAGE_COUNT);
    const summaryText = olderMessages
      .map((message) => `${message.role === 'user' ? 'User' : 'Assistant'}: ${message.content}`)
      .join('\n\n');

    return summaryText.length > SUMMARY_MAX_CHARS
      ? `${summaryText.slice(summaryText.length - SUMMARY_MAX_CHARS)}\n[Earlier chat compressed]`
      : summaryText;
  }

  private static async getMessages(userId: string, directoryId: string): Promise<DirectoryChatMessage[]> {
    const snapshot = await FirestorePaths.directoryChatMessages(userId, directoryId)
      .orderBy('createdAt', 'asc')
      .limit(MAX_MESSAGES_RETURNED)
      .get();

    return snapshot.docs.map((doc) => this.mapMessage(doc.id, doc.data() as StoredChatMessage));
  }

  private static async findSeededMessage(
    userId: string,
    directoryId: string,
    seedKey: string
  ): Promise<DirectoryChatMessage | null> {
    const snapshot = await FirestorePaths.directoryChatMessages(userId, directoryId)
      .where('seedKey', '==', seedKey)
      .where('role', '==', 'user')
      .limit(1)
      .get();

    const doc = snapshot.docs[0];
    return doc ? this.mapMessage(doc.id, doc.data() as StoredChatMessage) : null;
  }

  private static mapMessage(id: string, data: StoredChatMessage): DirectoryChatMessage {
    return {
      id,
      role: data.role,
      content: data.content,
      createdAt: data.createdAt?.toDate?.().toISOString() || new Date().toISOString(),
      ...(data.seedKey ? { seedKey: data.seedKey } : {}),
    };
  }
}
