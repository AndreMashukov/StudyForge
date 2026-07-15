import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import { validateAuth } from '../lib/auth';
import { throwCallableError } from '../lib/callable-error';
import {
  GetStatisticsQuizDetailRequest,
  StatisticsDateRangeRequest,
} from '../../libs/shared-types/src/index';
import {
  getStatisticsLearningTime,
  getStatisticsOverview,
  getStatisticsQuizDetail,
  getStatisticsQuizPerformance,
} from '../services/statistics';

function rangeData(data: unknown): StatisticsDateRangeRequest {
  return (data ?? {}) as StatisticsDateRangeRequest;
}

export const getStatisticsOverviewEndpoint = onCall(
  { region: 'asia-east1', cors: true },
  async (request) => {
    try {
      const userId = await validateAuth(request);
      return await getStatisticsOverview(userId, rangeData(request.data));
    } catch (error) {
      logger.error('Error getting statistics overview', {
        error: error instanceof Error ? error.message : String(error),
      });
      throwCallableError(error, 'Failed to get statistics overview');
    }
  }
);

export const getStatisticsQuizPerformanceEndpoint = onCall(
  { region: 'asia-east1', cors: true },
  async (request) => {
    try {
      const userId = await validateAuth(request);
      return await getStatisticsQuizPerformance(userId, rangeData(request.data));
    } catch (error) {
      logger.error('Error getting statistics quiz performance', {
        error: error instanceof Error ? error.message : String(error),
      });
      throwCallableError(error, 'Failed to get statistics quiz performance');
    }
  }
);

export const getStatisticsLearningTimeEndpoint = onCall(
  { region: 'asia-east1', cors: true },
  async (request) => {
    try {
      const userId = await validateAuth(request);
      return await getStatisticsLearningTime(userId, rangeData(request.data));
    } catch (error) {
      logger.error('Error getting statistics learning time', {
        error: error instanceof Error ? error.message : String(error),
      });
      throwCallableError(error, 'Failed to get statistics learning time');
    }
  }
);

export const getStatisticsQuizDetailEndpoint = onCall(
  { region: 'asia-east1', cors: true },
  async (request) => {
    try {
      const userId = await validateAuth(request);
      const data = request.data as GetStatisticsQuizDetailRequest;
      if (!data.quizId || !data.quizType) {
        throw new HttpsError('invalid-argument', 'quizId and quizType are required');
      }
      return await getStatisticsQuizDetail(userId, data);
    } catch (error) {
      logger.error('Error getting statistics quiz detail', {
        error: error instanceof Error ? error.message : String(error),
      });
      throwCallableError(error, 'Failed to get statistics quiz detail');
    }
  }
);
