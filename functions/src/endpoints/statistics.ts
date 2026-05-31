import { onCall } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import { validateAuth } from '../lib/auth';
import {
  GetStatisticsKnowledgeDetailRequest,
  GetStatisticsQuizDetailRequest,
  StatisticsDateRangeRequest,
} from '../../libs/shared-types/src/index';
import {
  getStatisticsKnowledgeDetail,
  getStatisticsKnowledgeGaps,
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
      throw new Error(
        `Failed to get statistics overview: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
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
      throw new Error(
        `Failed to get statistics quiz performance: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
);

export const getStatisticsKnowledgeGapsEndpoint = onCall(
  { region: 'asia-east1', cors: true },
  async (request) => {
    try {
      const userId = await validateAuth(request);
      return await getStatisticsKnowledgeGaps(userId, rangeData(request.data));
    } catch (error) {
      logger.error('Error getting statistics knowledge gaps', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error(
        `Failed to get statistics knowledge gaps: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
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
      throw new Error(
        `Failed to get statistics learning time: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
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
        throw new Error('quizId and quizType are required');
      }
      return await getStatisticsQuizDetail(userId, data);
    } catch (error) {
      logger.error('Error getting statistics quiz detail', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error(
        `Failed to get statistics quiz detail: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
);

export const getStatisticsKnowledgeDetailEndpoint = onCall(
  { region: 'asia-east1', cors: true },
  async (request) => {
    try {
      const userId = await validateAuth(request);
      const data = request.data as GetStatisticsKnowledgeDetailRequest;
      if (!data.subjectKey || !data.knowledgeDomainKey) {
        throw new Error('subjectKey and knowledgeDomainKey are required');
      }
      return await getStatisticsKnowledgeDetail(userId, data);
    } catch (error) {
      logger.error('Error getting statistics knowledge detail', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error(
        `Failed to get statistics knowledge detail: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
);