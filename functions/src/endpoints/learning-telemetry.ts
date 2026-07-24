import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import { validateAuth } from '@study-forge/backend-core/lib/auth';
import { throwCallableError } from '@study-forge/backend-core/lib/callable-error';
import {
  GetQuizStatsRequest,
  RecordQuizAttemptRequest,
  RecordQuizExplanationRequest,
} from '@shared-types';
import {
  getQuizStats,
  recordQuizAttempt,
  recordQuizExplanationRequest,
} from '@study-forge/backend-core/services/learning-telemetry';

export const recordQuizAttemptEndpoint = onCall(
  { region: 'asia-east1', cors: true },
  async (request) => {
    try {
      const userId = await validateAuth(request);
      const data = request.data as RecordQuizAttemptRequest;

      if (!data.quizId || !data.quizType) {
        throw new HttpsError('invalid-argument', 'quizId and quizType are required');
      }
      if (!Array.isArray(data.answers)) {
        throw new HttpsError('invalid-argument', 'answers must be an array');
      }

      const attemptId = await recordQuizAttempt(userId, data);
      return { attemptId };
    } catch (error) {
      logger.error('Error recording quiz attempt', {
        error: error instanceof Error ? error.message : String(error),
      });
      throwCallableError(error, 'Failed to record quiz attempt');
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
        throw new HttpsError(
          'invalid-argument',
          'quizId, quizType, and questionIndex are required'
        );
      }

      const eventId = await recordQuizExplanationRequest(userId, data);
      return { eventId };
    } catch (error) {
      logger.error('Error recording quiz explanation request', {
        error: error instanceof Error ? error.message : String(error),
      });
      throwCallableError(error, 'Failed to record quiz explanation request');
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
        throw new HttpsError('invalid-argument', 'quizId and quizType are required');
      }

      const stats = await getQuizStats(userId, data.quizType, data.quizId);
      return { stats };
    } catch (error) {
      logger.error('Error getting quiz stats', {
        error: error instanceof Error ? error.message : String(error),
      });
      throwCallableError(error, 'Failed to get quiz stats');
    }
  }
);
