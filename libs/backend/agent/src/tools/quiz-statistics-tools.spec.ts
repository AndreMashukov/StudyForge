import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getStatisticsOverview,
  getStatisticsQuizDetail,
  getStatisticsQuizPerformance,
} from '@study-forge/backend-core/services/statistics';
import { createQuizStatisticsToolDefinitions } from './quiz-statistics-tools';

vi.mock('@study-forge/backend-core/services/statistics', () => ({
  getStatisticsOverview: vi.fn(),
  getStatisticsQuizPerformance: vi.fn(),
  getStatisticsQuizDetail: vi.fn(),
}));

function createContext(
  overrides: Partial<{
    userId: string;
    scope: 'workspace' | 'directory';
    directoryId?: string;
    directoryIds: string[];
  }> = {},
) {
  return {
    userId: 'user-1',
    scope: 'workspace' as const,
    directoryIds: ['dir-1'],
    ...overrides,
  };
}

async function executeTool(
  name: string,
  args: Record<string, unknown>,
  context = createContext(),
): Promise<unknown> {
  const tools = createQuizStatisticsToolDefinitions(context);
  const tool = tools.find((entry) => entry.name === name);
  if (!tool) {
    throw new Error(`Unknown tool: ${name}`);
  }
  return tool.execute(args);
}

describe('quiz statistics agent tools', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns overall and per-quiz correct vs incorrect counts', async () => {
    vi.mocked(getStatisticsOverview).mockResolvedValue({
      metrics: {
        attemptCount: 3,
        quizCount: 2,
        answeredQuestionCount: 20,
        correctAnswerCount: 14,
        incorrectAnswerCount: 6,
        explanationRequestCount: 1,
        accuracyPercentage: 70,
      },
      recentFailures: [],
    });
    vi.mocked(getStatisticsQuizPerformance).mockResolvedValue({
      quizzes: [
        {
          id: 'quiz:quiz-1',
          quizId: 'quiz-1',
          quizType: 'quiz',
          quizTitle: 'ML Basics',
          sourceDocuments: [{ id: 'doc-1', title: 'Machine Learning' }],
          attemptCount: 2,
          answeredQuestionCount: 10,
          correctAnswerCount: 8,
          incorrectAnswerCount: 2,
          explanationRequestCount: 1,
          accuracyPercentage: 80,
          bestPercentage: 90,
          latestPercentage: 70,
          totalDurationMs: 120000,
          lastAttemptAt: '2026-08-13T01:00:00.000Z',
        },
      ],
      recentFailures: [],
    });

    const result = await executeTool('get_quiz_statistics', {
      quizType: 'quiz',
      startDate: '2026-08-01',
      endDate: '2026-08-13',
    });

    expect(getStatisticsOverview).toHaveBeenCalledWith(
      'user-1',
      {
        quizType: 'quiz',
        startDate: '2026-08-01',
        endDate: '2026-08-13',
      },
      undefined,
    );
    expect(getStatisticsQuizPerformance).toHaveBeenCalledWith(
      'user-1',
      {
        quizType: 'quiz',
        startDate: '2026-08-01',
        endDate: '2026-08-13',
      },
      undefined,
    );
    expect(result).toMatchObject({
      metrics: {
        correctAnswerCount: 14,
        incorrectAnswerCount: 6,
        accuracyPercentage: 70,
      },
      quizzes: [
        {
          quizId: 'quiz-1',
          quizType: 'quiz',
          quizTitle: 'ML Basics',
          correctAnswerCount: 8,
          incorrectAnswerCount: 2,
          accuracyPercentage: 80,
          sourceDocuments: ['Machine Learning'],
        },
      ],
    });
  });

  it('scopes directory chat statistics to the active directory tree', async () => {
    vi.mocked(getStatisticsOverview).mockResolvedValue({
      metrics: {
        attemptCount: 0,
        quizCount: 0,
        answeredQuestionCount: 0,
        correctAnswerCount: 0,
        incorrectAnswerCount: 0,
        explanationRequestCount: 0,
        accuracyPercentage: 0,
      },
      recentFailures: [],
    });
    vi.mocked(getStatisticsQuizPerformance).mockResolvedValue({
      quizzes: [],
      recentFailures: [],
    });

    await executeTool(
      'get_quiz_statistics',
      {},
      createContext({
        scope: 'directory',
        directoryId: 'dir-1',
        directoryIds: ['dir-1', 'dir-1-child'],
      }),
    );

    expect(getStatisticsOverview).toHaveBeenCalledWith(
      'user-1',
      { quizType: 'all' },
      { directoryIds: ['dir-1', 'dir-1-child'] },
    );
  });

  it('returns recent wrong answers with selected vs correct labels', async () => {
    vi.mocked(getStatisticsOverview).mockResolvedValue({
      metrics: {
        attemptCount: 1,
        quizCount: 1,
        answeredQuestionCount: 4,
        correctAnswerCount: 3,
        incorrectAnswerCount: 1,
        explanationRequestCount: 0,
        accuracyPercentage: 75,
      },
      recentFailures: [
        {
          id: 'attempt-1:0',
          attemptId: 'attempt-1',
          quizId: 'diagram-1',
          quizType: 'diagramQuiz',
          quizTitle: 'VPC Diagrams',
          questionIndex: 0,
          questionText: 'Which diagram shows a public subnet?',
          selectedAnswer: 1,
          selectedAnswerLabel: 'Private only',
          correctAnswer: 0,
          correctAnswerLabel: 'Public subnet',
          knowledge: { subjectName: 'Networking', knowledgeDomainName: 'VPC' },
          sourceDocuments: [{ id: 'doc-2', title: 'VPC Lab' }],
          occurredAt: '2026-08-13T02:00:00.000Z',
          repeatedFailureCount: 2,
        },
      ],
    });

    const result = await executeTool('get_quiz_answer_details', {
      quizType: 'diagramQuiz',
    });

    expect(result).toMatchObject({
      metrics: {
        correctAnswerCount: 3,
        incorrectAnswerCount: 1,
        accuracyPercentage: 75,
      },
      wrongAnswers: [
        {
          quizId: 'diagram-1',
          quizType: 'diagramQuiz',
          questionText: 'Which diagram shows a public subnet?',
          selectedAnswer: 'Private only',
          correctAnswer: 'Public subnet',
          repeatedFailureCount: 2,
          subjectName: 'Networking',
        },
      ],
    });
  });

  it('returns per-question right vs wrong breakdown for a specific quiz', async () => {
    vi.mocked(getStatisticsQuizDetail).mockResolvedValue({
      quiz: {
        id: 'sequenceQuiz:seq-1',
        quizId: 'seq-1',
        quizType: 'sequenceQuiz',
        quizTitle: 'Deploy order',
        sourceDocuments: [{ id: 'doc-3', title: 'CI Lab' }],
        attemptCount: 1,
        answeredQuestionCount: 2,
        correctAnswerCount: 1,
        incorrectAnswerCount: 1,
        explanationRequestCount: 0,
        accuracyPercentage: 50,
        bestPercentage: 50,
        latestPercentage: 50,
        totalDurationMs: 30000,
      },
      attempts: [
        {
          attemptId: 'attempt-2',
          completedAt: '2026-08-13T03:00:00.000Z',
          score: 1,
          totalQuestions: 2,
          percentage: 50,
          durationMs: 30000,
          incorrectAnswerCount: 1,
        },
      ],
      questionBreakdown: [
        {
          questionIndex: 0,
          questionText: 'Order the deploy steps',
          answerCount: 1,
          correctCount: 1,
          incorrectCount: 0,
          accuracyPercentage: 100,
        },
        {
          questionIndex: 1,
          questionText: 'Order the rollback steps',
          answerCount: 1,
          correctCount: 0,
          incorrectCount: 1,
          accuracyPercentage: 0,
        },
      ],
      failedQuestions: [
        {
          id: 'attempt-2:1',
          attemptId: 'attempt-2',
          quizId: 'seq-1',
          quizType: 'sequenceQuiz',
          quizTitle: 'Deploy order',
          questionIndex: 1,
          questionText: 'Order the rollback steps',
          selectedAnswer: ['c', 'a', 'b'],
          selectedAnswerLabel: 'c, a, b',
          correctAnswer: ['a', 'b', 'c'],
          correctAnswerLabel: 'a, b, c',
          knowledge: {},
          sourceDocuments: [{ id: 'doc-3', title: 'CI Lab' }],
          occurredAt: '2026-08-13T03:00:00.000Z',
          repeatedFailureCount: 1,
        },
      ],
    });

    const result = await executeTool('get_quiz_answer_details', {
      quizId: 'seq-1',
      quizType: 'sequenceQuiz',
    });

    expect(getStatisticsQuizDetail).toHaveBeenCalledWith(
      'user-1',
      { quizId: 'seq-1', quizType: 'sequenceQuiz' },
      undefined,
    );
    expect(result).toMatchObject({
      quiz: {
        quizId: 'seq-1',
        quizType: 'sequenceQuiz',
        correctAnswerCount: 1,
        incorrectAnswerCount: 1,
      },
      questionBreakdown: [
        { questionIndex: 0, correctCount: 1, incorrectCount: 0 },
        { questionIndex: 1, correctCount: 0, incorrectCount: 1 },
      ],
      wrongAnswers: [
        {
          selectedAnswer: 'c, a, b',
          correctAnswer: 'a, b, c',
        },
      ],
    });
  });

  it('requires a specific quizType when quizId is provided', async () => {
    await expect(
      executeTool('get_quiz_answer_details', { quizId: 'quiz-1' }),
    ).rejects.toThrow(/quizType must be quiz, diagramQuiz, or sequenceQuiz/);
  });
});
