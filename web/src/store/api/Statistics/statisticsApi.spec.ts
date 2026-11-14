import { configureStore } from '@reduxjs/toolkit';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { statisticsApi } from './statisticsApi';

const mocks = vi.hoisted(() => ({
  overview: vi.fn(),
  performance: vi.fn(),
  hidden: vi.fn(),
}));
vi.mock('../baseApi', async () => {
  const { createApi, fakeBaseQuery } = await import(
    '@reduxjs/toolkit/query/react'
  );
  return {
    baseApi: createApi({
      reducerPath: 'testApi',
      baseQuery: fakeBaseQuery(),
      tagTypes: ['Statistics'],
      endpoints: () => ({}),
    }),
  };
});
vi.mock('../../../config/firebase', () => ({
  auth: { currentUser: { uid: 'u' } },
}));
vi.mock('../../../services/firestoreReadUtils', () => ({
  authRequiredError: () => ({ error: 'auth' }),
  customError: (message: string) => ({ error: { message } }),
}));
vi.mock('../../../services/statisticsHiddenMutations', () => ({
  hideStatisticsFailureInFirestore: mocks.hidden,
}));
vi.mock('../../../services/statisticsFirestore', () => ({
  getStatisticsOverviewFromFirestore: mocks.overview,
  getStatisticsQuizPerformanceFromFirestore: mocks.performance,
  buildGroupedFlashcardFailures: vi.fn(),
  fetchFlashcardStudySessionsPage: vi.fn(),
  fetchQuizAttemptsPage: vi.fn(),
  getHiddenFailureGroupKeys: vi.fn(),
  getStatisticsLearningTimeFromFirestore: vi.fn(),
  getStatisticsQuizDetailFromFirestore: vi.fn(),
  serializeOverviewAttempt: vi.fn(),
}));
function testStore() {
  return configureStore({
    reducer: { [statisticsApi.reducerPath]: statisticsApi.reducer },
    middleware: (getDefault) => getDefault().concat(statisticsApi.middleware),
  });
}
const range = {
  quizType: 'quiz' as const,
  startDate: '2026-11-01',
  endDate: '2026-11-14',
};
describe('Progress query cache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.overview.mockImplementation(async (_uid, _range, _scope, limit) => ({
      metrics: {},
      recentFailures: [{ id: String(limit) }],
      attempts: [],
      hasMoreAttempts: limit < 100,
      flashcardFailures: [],
      hasMoreFlashcardSessions: false,
    }));
    mocks.performance.mockResolvedValue({ quizzes: [], recentFailures: [] });
    mocks.hidden.mockResolvedValue('hidden');
  });
  it('loads more into the same range cache and preserves loaded history after invalidation', async () => {
    const store = testStore();
    const first = store.dispatch(
      statisticsApi.endpoints.getStatisticsOverview.initiate({
        ...range,
        attemptLimit: 50,
      }),
    );
    await first;
    const more = store.dispatch(
      statisticsApi.endpoints.getStatisticsOverview.initiate({
        ...range,
        attemptLimit: 100,
      }),
    );
    await more;
    expect(
      statisticsApi.endpoints.getStatisticsOverview.select({
        ...range,
        attemptLimit: 50,
      })(store.getState()).data?.recentFailures[0].id,
    ).toBe('100');
    await store.dispatch(
      statisticsApi.endpoints.hideStatisticsFailure.initiate({
        kind: 'quiz',
        groupKey: 'q',
        quizId: 'q',
        quizType: 'quiz',
        questionIndex: 0,
      }),
    );
    await vi.waitFor(() => expect(mocks.overview).toHaveBeenCalledTimes(3));
    expect(mocks.overview.mock.calls[2][3]).toBe(100);
    first.unsubscribe();
    more.unsubscribe();
    store.dispatch(statisticsApi.util.resetApiState());
  });
  it('isolates dates and types and applies the type filter to performance', async () => {
    const store = testStore();
    const first = store.dispatch(
      statisticsApi.endpoints.getStatisticsOverview.initiate({
        ...range,
        attemptLimit: 50,
      }),
    );
    await first;
    const other = store.dispatch(
      statisticsApi.endpoints.getStatisticsOverview.initiate({
        ...range,
        quizType: 'matchQuiz',
        attemptLimit: 100,
      }),
    );
    await other;
    expect(
      statisticsApi.endpoints.getStatisticsOverview.select({
        ...range,
        attemptLimit: 50,
      })(store.getState()).data?.recentFailures[0].id,
    ).toBe('50');
    const performance = store.dispatch(
      statisticsApi.endpoints.getStatisticsQuizPerformance.initiate({
        ...range,
        quizType: 'matchQuiz',
      }),
    );
    await performance;
    expect(mocks.performance).toHaveBeenCalledWith('u', {
      ...range,
      quizType: 'matchQuiz',
    });
    first.unsubscribe();
    other.unsubscribe();
    performance.unsubscribe();
    store.dispatch(statisticsApi.util.resetApiState());
  });
});
