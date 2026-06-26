import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import {
  DirectoryChatArtifactContext,
  DirectoryChatMessage,
  GetDirectoryChatResponse,
  SendDirectoryChatMessageResponse,
} from '@shared-types';
import { FirestorePaths } from '../lib/firestore-paths';
import { directoryService } from './directory';
import { DirectoryChatContextAssembler } from './directory-chat-context-assembler';
import { LlmGenerationService } from './llm';

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

export class DirectoryChatService {
  private static readonly contextAssembler = new DirectoryChatContextAssembler();

  static async getChat(userId: string, directoryId: string): Promise<GetDirectoryChatResponse> {
    const directory = await directoryService.getDirectory(userId, directoryId);
    if (!directory) {
      throw new Error('Directory not found');
    }

    const [messages, summary, documentCount] = await Promise.all([
      this.getMessages(userId, directoryId),
      this.getSummary(userId, directoryId),
      this.getDirectDocumentCount(userId, directoryId),
    ]);

    return {
      directoryId,
      documentCount,
      messages,
      ...(summary ? { summary } : {}),
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

    if (seedKey) {
      const existing = await this.findSeededMessage(userId, directoryId, seedKey);
      if (existing) {
        const [messages, summary, documentCount] = await Promise.all([
          this.getMessages(userId, directoryId),
          this.getSummary(userId, directoryId),
          this.getDirectDocumentCount(userId, directoryId),
        ]);
        const existingIndex = messages.findIndex((item) => item.id === existing.id);
        const assistantMessage = existingIndex >= 0
          ? messages.slice(existingIndex + 1).find((item) => item.role === 'assistant')
          : undefined;

        return {
          directoryId,
          documentCount,
          userMessage: existing,
          ...(assistantMessage ? { assistantMessage } : {}),
          messages,
          ...(summary ? { summary } : {}),
        };
      }
    }

    const previousMessages = await this.getMessages(userId, directoryId);
    const summary = await this.getSummary(userId, directoryId);
    const { promptContext, documentCount } = await this.contextAssembler.assemble({
      userId,
      directory,
      message: trimmedMessage,
      previousMessages,
      conversationSummary: summary,
      artifactContext,
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

    await this.ensureThread(userId, directoryId, summary);
    await userMessageRef.set({
      role: 'user',
      content: trimmedMessage,
      createdAt: Timestamp.fromDate(now),
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
    });

    const messages = [...previousMessages, userMessage, assistantMessage];
    const nextSummary = await this.updateThreadAfterMessage(userId, directoryId, messages, summary);

    return {
      directoryId,
      documentCount,
      userMessage,
      assistantMessage,
      messages,
      ...(nextSummary ? { summary: nextSummary } : {}),
    };
  }

  private static async ensureThread(userId: string, directoryId: string, summary?: string): Promise<void> {
    await FirestorePaths.directoryChatThread(userId, directoryId).set(
      {
        directoryId,
        updatedAt: FieldValue.serverTimestamp(),
        ...(summary ? { summary } : {}),
      },
      { merge: true }
    );
  }

  private static async updateThreadAfterMessage(
    userId: string,
    directoryId: string,
    messages: DirectoryChatMessage[],
    currentSummary?: string
  ): Promise<string | undefined> {
    const nextSummary = this.buildRollingSummary(messages, currentSummary);

    await FirestorePaths.directoryChatThread(userId, directoryId).set(
      {
        directoryId,
        updatedAt: FieldValue.serverTimestamp(),
        ...(nextSummary ? { summary: nextSummary } : {}),
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

  private static async getSummary(userId: string, directoryId: string): Promise<string | undefined> {
    const threadSnapshot = await FirestorePaths.directoryChatThread(userId, directoryId).get();
    const summary = threadSnapshot.data()?.summary;
    return typeof summary === 'string' && summary.trim() ? summary : undefined;
  }

  private static async getDirectDocumentCount(userId: string, directoryId: string): Promise<number> {
    const snapshot = await FirestorePaths.documents(userId)
      .where('directoryId', '==', directoryId)
      .get();

    return snapshot.size;
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
