import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  GetStatisticsOverviewResponse,
  GetStatisticsQuizDetailRequest,
  StatisticsDateRangeRequest,
  StatisticsFlashcardFailure,
  StatisticsQuizTypeFilter,
  StatisticsTimeRangeKey,
} from '@shared-types';
import { auth } from '../../../../../config/firebase';
import {
  buildOverviewFromAttempts,
  getAttemptsForStatisticsOverview,
  getHiddenFailureGroupKeys,
  type IStoredAttempt,
} from '../../../../../services/statisticsFirestore';
import {
  useGetStatisticsLearningTimeQuery,
  useGetStatisticsOverviewQuery,
  useGetStatisticsQuizDetailQuery,
  useGetStatisticsQuizPerformanceQuery,
  useLoadMoreFlashcardFailuresMutation,
  useLoadMoreStatisticsAttemptsMutation,
} from '../../../../../store/api/Statistics';
import { IStatisticsPageApi } from '../../../types/IStatisticsPageContext';
import { getStatisticsDateRange, isQuizTelemetryType } from '../../../utils/statisticsPageUtils';

type RouteParamKey = 'quizType' | 'quizId';

function toStoredAttempt(
  attempt: GetStatisticsOverviewResponse['attempts'][number] | IStoredAttempt,
): IStoredAttempt {
  if ('completedAtDate' in attempt && attempt.completedAtDate instanceof Date) {
    return attempt;
  }

  const completedAt =
    typeof attempt.completedAt === 'string'
      ? new Date(attempt.completedAt)
      : attempt.completedAt instanceof Date
        ? attempt.completedAt
        : typeof attempt.completedAt === 'object'
          && attempt.completedAt
          && 'toDate' in attempt.completedAt
          ? attempt.completedAt.toDate()
          : new Date(0);
  const startedAt =
    typeof attempt.startedAt === 'string'
      ? new Date(attempt.startedAt)
      : attempt.startedAt;

  return {
    ...attempt,
    startedAt,
    completedAt,
    completedAtDate: completedAt,
    answers: attempt.answers.map((answer) => {
      const {
        detailedExplanationRequestedAt: requestedAt,
        ...rest
      } = answer;
      let detailedExplanationRequestedAt: Date | undefined;
      if (typeof requestedAt === 'string') {
        detailedExplanationRequestedAt = new Date(requestedAt);
      } else if (requestedAt instanceof Date) {
        detailedExplanationRequestedAt = requestedAt;
      } else if (
        requestedAt
        && typeof requestedAt === 'object'
        && 'toDate' in requestedAt
      ) {
        detailedExplanationRequestedAt = requestedAt.toDate();
      }

      return {
        ...rest,
        ...(detailedExplanationRequestedAt
          ? { detailedExplanationRequestedAt }
          : {}),
      };
    }),
  };
}

function mergeFlashcardFailureGroups(
  existing: StatisticsFlashcardFailure[],
  incoming: StatisticsFlashcardFailure[],
): StatisticsFlashcardFailure[] {
  const grouped = new Map<string, StatisticsFlashcardFailure>();

  for (const failure of [...existing, ...incoming]) {
    const current = grouped.get(failure.groupKey);
    if (!current) {
      grouped.set(failure.groupKey, failure);
      continue;
    }

    const useIncoming =
      new Date(failure.occurredAt).getTime()
      > new Date(current.occurredAt).getTime();
    grouped.set(failure.groupKey, {
      ...(useIncoming ? failure : current),
      repeatedFailureCount:
        current.repeatedFailureCount + failure.repeatedFailureCount,
    });
  }

  return Array.from(grouped.values()).sort(
    (left, right) =>
      new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime(),
  );
}

function buildSkippedQuizDetailRequest(
  request: StatisticsDateRangeRequest,
): GetStatisticsQuizDetailRequest {
  return {
    ...request,
    quizId: '',
    quizType: 'quiz',
  };
}

export const useFetchStatisticsPageData = (): IStatisticsPageApi => {
  const params = useParams<RouteParamKey>();
  const [timeRange, setTimeRange] = useState<StatisticsTimeRangeKey>('30d');
  const [quizType, setQuizType] = useState<StatisticsQuizTypeFilter>('all');
  const [mergedOverview, setMergedOverview] = useState<GetStatisticsOverviewResponse | null>(null);
  const [accumulatedAttempts, setAccumulatedAttempts] = useState<IStoredAttempt[]>([]);
  const [isLoadingMoreAttempts, setIsLoadingMoreAttempts] = useState(false);
  const [isLoadingMoreFlashcards, setIsLoadingMoreFlashcards] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);

  const overviewRequest = useMemo(
    () => getStatisticsDateRange(timeRange, quizType),
    [timeRange, quizType],
  );

  const globalRequest = useMemo(
    () => getStatisticsDateRange(timeRange, 'all'),
    [timeRange],
  );

  const quizDetailRequest = useMemo<GetStatisticsQuizDetailRequest | null>(() => {
    if (!params.quizId || !isQuizTelemetryType(params.quizType)) return null;
    return {
      ...globalRequest,
      quizId: params.quizId,
      quizType: params.quizType,
    };
  }, [params.quizId, params.quizType, globalRequest]);

  const isDetailRoute = Boolean(quizDetailRequest);

  const overviewQuery = useGetStatisticsOverviewQuery(overviewRequest, {
    skip: isDetailRoute,
  });
  const performanceQuery = useGetStatisticsQuizPerformanceQuery(globalRequest, {
    skip: isDetailRoute,
  });
  const timeQuery = useGetStatisticsLearningTimeQuery(globalRequest, {
    skip: isDetailRoute,
  });
  const quizDetailQuery = useGetStatisticsQuizDetailQuery(
    quizDetailRequest ?? buildSkippedQuizDetailRequest(globalRequest),
    { skip: !quizDetailRequest },
  );

  const [loadMoreAttemptsMutation] = useLoadMoreStatisticsAttemptsMutation();
  const [loadMoreFlashcardsMutation] = useLoadMoreFlashcardFailuresMutation();

  useEffect(() => {
    if (overviewQuery.data) {
      setMergedOverview(overviewQuery.data);
      setAccumulatedAttempts(overviewQuery.data.attempts.map(toStoredAttempt));
      setLoadMoreError(null);
    } else {
      setMergedOverview(null);
      setAccumulatedAttempts([]);
    }
  }, [overviewQuery.data]);

  const loadMoreAttempts = useCallback(async () => {
    if (!mergedOverview?.nextAttemptCursor || isLoadingMoreAttempts) return;

    const userId = auth.currentUser?.uid;
    if (!userId) return;

    setIsLoadingMoreAttempts(true);
    setLoadMoreError(null);
    try {
      const page = await loadMoreAttemptsMutation({
        ...overviewRequest,
        cursor: mergedOverview.nextAttemptCursor,
      }).unwrap();

      const newAttempts = [
        ...accumulatedAttempts,
        ...page.attempts.map(toStoredAttempt),
      ];
      const hiddenKeys = await getHiddenFailureGroupKeys(userId);
      const allAttempts = await getAttemptsForStatisticsOverview(
        userId,
        overviewRequest,
      );
      const overviewPart = await buildOverviewFromAttempts(
        userId,
        newAttempts,
        overviewRequest,
        hiddenKeys,
        allAttempts,
      );

      setAccumulatedAttempts(newAttempts);
      setMergedOverview((current) =>
        current
          ? {
              ...current,
              ...overviewPart,
              attempts: [...current.attempts, ...page.attempts],
              nextAttemptCursor: page.nextCursor,
              hasMoreAttempts: page.hasMore,
            }
          : current,
      );
    } catch (error) {
      setLoadMoreError(
        error instanceof Error ? error.message : 'Failed to load more attempts',
      );
    } finally {
      setIsLoadingMoreAttempts(false);
    }
  }, [
    isLoadingMoreAttempts,
    loadMoreAttemptsMutation,
    accumulatedAttempts,
    mergedOverview,
    overviewRequest,
  ]);

  const loadMoreFlashcardFailures = useCallback(async () => {
    if (!mergedOverview?.nextFlashcardCursor || isLoadingMoreFlashcards) return;

    setIsLoadingMoreFlashcards(true);
    setLoadMoreError(null);
    try {
      const page = await loadMoreFlashcardsMutation({
        ...globalRequest,
        cursor: mergedOverview.nextFlashcardCursor,
      }).unwrap();

      setMergedOverview((current) =>
        current
          ? {
              ...current,
              flashcardFailures: mergeFlashcardFailureGroups(
                current.flashcardFailures,
                page.failures,
              ),
              nextFlashcardCursor: page.nextCursor,
              hasMoreFlashcardSessions: page.hasMore,
            }
          : current,
      );
    } catch (error) {
      setLoadMoreError(
        error instanceof Error
          ? error.message
          : 'Failed to load more flashcard failures',
      );
    } finally {
      setIsLoadingMoreFlashcards(false);
    }
  }, [
    globalRequest,
    isLoadingMoreFlashcards,
    loadMoreFlashcardsMutation,
    mergedOverview,
  ]);

  const isLoading = isDetailRoute
    ? quizDetailQuery.isLoading
    : overviewQuery.isLoading || performanceQuery.isLoading || timeQuery.isLoading;
  const hasError = Boolean(
    isDetailRoute
      ? quizDetailQuery.error
      : overviewQuery.error || performanceQuery.error || timeQuery.error,
  );

  const overviewData = mergedOverview ?? overviewQuery.data;

  return {
    filters: { timeRange, quizType },
    isDetailRoute,
    quizDetailRequest,
    overview: {
      data: overviewData,
      isLoading: overviewQuery.isLoading,
      error: overviewQuery.error,
      refetch: overviewQuery.refetch,
    },
    performance: {
      data: performanceQuery.data,
      isLoading: performanceQuery.isLoading,
      error: performanceQuery.error,
      refetch: performanceQuery.refetch,
    },
    learningTime: {
      data: timeQuery.data,
      isLoading: timeQuery.isLoading,
      error: timeQuery.error,
      refetch: timeQuery.refetch,
    },
    quizDetail: {
      data: quizDetailQuery.data,
      isLoading: quizDetailQuery.isLoading,
      error: quizDetailQuery.error,
      refetch: quizDetailQuery.refetch,
    },
    isLoading,
    hasError,
    isLoadingMoreAttempts,
    isLoadingMoreFlashcards,
    loadMoreError,
    loadMoreAttempts,
    loadMoreFlashcardFailures,
    setTimeRange,
    setQuizType,
  };
};
