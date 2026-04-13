import { onCall } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import { validateAuth } from '../lib/auth';
import {
  FlushInteractionSessionRequest,
  GetInteractionStatsRequest,
} from '../../libs/shared-types/src/index';
import {
  flushInteractionSession,
  getInteractionStats,
} from '../services/interaction-tracking';

export const flushInteractionSessionEndpoint = onCall(
  {
    region: 'asia-east1',
    cors: true,
  },
  async (request) => {
    try {
      const userId = await validateAuth(request);
      const data = request.data as FlushInteractionSessionRequest;

      if (!data.artifactId || !data.artifactType || !data.directoryId) {
        throw new Error('artifactId, artifactType, and directoryId are required');
      }
      if (!data.activeSeconds || data.activeSeconds <= 0) {
        throw new Error('activeSeconds must be a positive number');
      }

      const sessionId = await flushInteractionSession(userId, {
        artifactId: data.artifactId,
        artifactType: data.artifactType,
        directoryId: data.directoryId,
        activeSeconds: data.activeSeconds,
        startedAt: data.startedAt,
      });

      return { sessionId };
    } catch (error) {
      logger.error('Error flushing interaction session', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error(
        `Failed to flush interaction session: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
);

export const getInteractionStatsEndpoint = onCall(
  {
    region: 'asia-east1',
    cors: true,
  },
  async (request) => {
    try {
      const userId = await validateAuth(request);
      const data = request.data as GetInteractionStatsRequest;

      if (!data.startDate || !data.endDate) {
        throw new Error('startDate and endDate are required');
      }

      const stats = await getInteractionStats(userId, {
        directoryId: data.directoryId,
        startDate: data.startDate,
        endDate: data.endDate,
      });

      return { stats };
    } catch (error) {
      logger.error('Error getting interaction stats', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error(
        `Failed to get interaction stats: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
);
