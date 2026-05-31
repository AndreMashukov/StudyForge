import { onCall } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import { validateAuth } from '../lib/auth';
import {
  GetQuizStatsRequest,
  RecordQuizAttemptRequest,
  RecordQuizExplanationRequest,
} from '../../libs/shared-types/src/index';
import {
  getQuizStats,
  recordQuizAttempt,
  recordQuizExplanationRequest,
} from '../services/learning-telemetry';

export const recordQuizAttemptEndpoint = onCall(
  { region: 'asia-east1', cors: true },
  async (request) => {
    try {
      const userId = await validateAuth(request);
      const data = request.data as RecordQuizAttemptRequest;

      if (!data.quizId || !data.quizType) {
        throw new Error('quizId and quizType are required');
      }
      if (!Array.isArray(data.answers)) {
        throw new Error('answers must be an array');
      }

      const attemptId = await recordQuizAttempt(userId, data);
      return { attemptId };
    } catch (error) {
      logger.error('Error recording quiz attempt', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error(
        `Failed to record quiz attempt: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
);

export const recordQuizExplanationRequestEndpoint = onCall(
  { region: 'asia-east1', cors: true },
  async (request) => {
    try {
      const userId = await validateAuth(request);
      const data = request.data as RecordQuizExplanationRequest;

      if (!data.quizId || !data.quizType || data.questionIndex === undefined) {
        throw new Error('quizId, quizType, and questionIndex are required');
      }

      const eventId = await recordQuizExplanationRequest(userId, data);
      return { eventId };
    } catch (error) {
      logger.error('Error recording quiz explanation request', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error(
        `Failed to record quiz explanation request: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
);

export const getQuizStatsEndpoint = onCall(
  { region: 'asia-east1', cors: true },
  async (request) => {
    try {
      const userId = await validateAuth(request);
      const data = request.data as GetQuizStatsRequest;

      if (!data.quizId || !data.quizType) {
        throw new Error('quizId and quizType are required');
      }

      const stats = await getQuizStats(userId, data.quizType, data.quizId);
      return { stats };
    } catch (error) {
      logger.error('Error getting quiz stats', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error(
        `Failed to get quiz stats: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
);