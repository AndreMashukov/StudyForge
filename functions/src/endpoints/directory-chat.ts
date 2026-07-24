import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { logger } from 'firebase-functions/v2';
import {
  GetDirectoryChatRequest,
  GetDirectoryChatResponse,
  SendDirectoryChatMessageRequest,
  SendDirectoryChatMessageResponse,
} from '@shared-types';
import { validateAuth } from '@study-forge/backend-core/lib/auth';
import { enforceCallableGenerationRateLimit } from '@study-forge/backend-generation/generation-rate-limit';
import { DirectoryChatService } from '@study-forge/backend-directories/directory-chat';

const geminiApiKey = defineSecret('GEMINI_API_KEY');
const llmSettingsEncryptionKey = defineSecret('LLM_SETTINGS_ENCRYPTION_KEY');

export const getDirectoryChat = onCall(
  {
    region: 'asia-east1',
    cors: true,
  },
  async (request): Promise<GetDirectoryChatResponse> => {
    try {
      const userId = await validateAuth(request);
      const data = request.data as GetDirectoryChatRequest;

      if (!data.directoryId) {
        throw new HttpsError('invalid-argument', 'directoryId is required');
      }

      return DirectoryChatService.getChat(userId, data.directoryId);
    } catch (error) {
      logger.error('Failed to get directory chat', {
        error: error instanceof Error ? error.message : String(error),
      });

      if (error instanceof HttpsError) throw error;
      throw new HttpsError('internal', error instanceof Error ? error.message : 'Unknown error');
    }
  }
);

export const sendDirectoryChatMessage = onCall(
  {
    region: 'asia-east1',
    cors: true,
    secrets: [geminiApiKey, llmSettingsEncryptionKey],
    timeoutSeconds: 300,
    memory: '1GiB',
  },
  async (request): Promise<SendDirectoryChatMessageResponse> => {
    try {
      const userId = await validateAuth(request);
      const data = request.data as SendDirectoryChatMessageRequest;

      if (!data.directoryId) {
        throw new HttpsError('invalid-argument', 'directoryId is required');
      }

      if (!data.message || typeof data.message !== 'string') {
        throw new HttpsError('invalid-argument', 'message is required');
      }

      logger.info('Sending directory chat message', {
        userId,
        directoryId: data.directoryId,
        messageLength: data.message.length,
        hasSeedKey: Boolean(data.seedKey),
        artifactType: data.artifactContext?.type,
      });

      await enforceCallableGenerationRateLimit(userId, 'directoryChat');

      return DirectoryChatService.sendMessage(
        userId,
        data.directoryId,
        data.message,
        data.seedKey,
        data.artifactContext
      );
    } catch (error) {
      logger.error('Failed to send directory chat message', {
        error: error instanceof Error ? error.message : String(error),
      });

      if (error instanceof HttpsError) throw error;
      throw new HttpsError('internal', error instanceof Error ? error.message : 'Unknown error');
    }
  }
);
