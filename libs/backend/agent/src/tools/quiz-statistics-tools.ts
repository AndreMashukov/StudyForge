import type {
  AgentScope,
  QuizTelemetryType,
  StatisticsDateRangeRequest,
  StatisticsQuestionBreakdownItem,
  StatisticsQuizDetailAttempt,
  StatisticsQuizPerformanceItem,
  StatisticsQuizTypeFilter,
  StatisticsRecentFailure,
} from '@shared-types';
import {
  getStatisticsOverview,
  getStatisticsQuizDetail,
  getStatisticsQuizPerformance,
  type StatisticsScopeOptions,
} from '@study-forge/backend-core/services/statistics';

interface IQuizStatisticsToolContext {
  userId: string;
  scope: AgentScope;
  directoryIds: string[];
}

interface IQuizStatisticsToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  execute: (args: Record<string, unknown>) => Promise<unknown>;
}

const QUIZ_TYPE_FILTER_ENUM = [
  'quiz',
  'diagramQuiz',
  'sequenceQuiz',
  'all',
] as const;
const QUIZ_TELEMETRY_TYPE_ENUM = [
  'quiz',
  'diagramQuiz',
  'sequenceQuiz',
] as const;
const TIME_RANGE_ENUM = ['7d', '30d', '90d', 'all'] as const;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MAX_QUIZZES_IN_TOOL_RESULT = 40;
const MAX_WRONG_ANSWERS_IN_TOOL_RESULT = 20;
const MAX_ATTEMPTS_IN_TOOL_RESULT = 20;

type TimeRangeKey = (typeof TIME_RANGE_ENUM)[number];

function isQuizTelemetryType(value: string): value is QuizTelemetryType {
  return (QUIZ_TELEMETRY_TYPE_ENUM as readonly string[]).includes(value);
}

function isQuizTypeFilter(value: string): value is StatisticsQuizTypeFilter {
  return (QUIZ_TYPE_FILTER_ENUM as readonly string[]).includes(value);
}

function isTimeRangeKey(value: string): value is TimeRangeKey {
  return (TIME_RANGE_ENUM as readonly string[]).includes(value);
}

function parseOptionalDate(
  value: unknown,
  fieldName: string,
): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== 'string' || !DATE_PATTERN.test(value)) {
    throw new Error(`${fieldName} must be YYYY-MM-DD`);
  }
  return value;
}

function parseQuizTypeFilter(value: unknown): StatisticsQuizTypeFilter {
  if (value === undefined) {
    return 'all';
  }
  if (typeof value !== 'string' || !isQuizTypeFilter(value)) {
    throw new Error('quizType must be quiz, diagramQuiz, sequenceQuiz, or all');
  }
  return value;
}

function parseQuizTelemetryType(value: unknown): QuizTelemetryType {
  if (typeof value !== 'string' || !isQuizTelemetryType(value)) {
    throw new Error('quizType must be quiz, diagramQuiz, or sequenceQuiz');
  }
  return value;
}

function utcDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function rangeFromTimeRange(
  timeRange: TimeRangeKey,
): Pick<StatisticsDateRangeRequest, 'startDate' | 'endDate'> {
  if (timeRange === 'all') {
    return {};
  }
  const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
  const end = new Date();
  const start = new Date();
  start.setUTCDate(start.getUTCDate() - (days - 1));
  return {
    startDate: utcDateString(start),
    endDate: utcDateString(end),
  };
}

function parseTimeRange(value: unknown): TimeRangeKey | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== 'string' || !isTimeRangeKey(value)) {
    throw new Error('timeRange must be 7d, 30d, 90d, or all');
  }
  return value;
}

function buildDateRange(
  args: Record<string, unknown>,
  quizType: StatisticsQuizTypeFilter,
): StatisticsDateRangeRequest {
  const startDate = parseOptionalDate(args.startDate, 'startDate');
  const endDate = parseOptionalDate(args.endDate, 'endDate');
  const timeRange = parseTimeRange(args.timeRange);
  const fromTimeRange = timeRange ? rangeFromTimeRange(timeRange) : {};
  const resolvedStart = startDate ?? fromTimeRange.startDate;
  const resolvedEnd = endDate ?? fromTimeRange.endDate;
  return {
    quizType,
    ...(resolvedStart ? { startDate: resolvedStart } : {}),
    ...(resolvedEnd ? { endDate: resolvedEnd } : {}),
  };
}

function statisticsScope(
  context: IQuizStatisticsToolContext,
): StatisticsScopeOptions | undefined {
  if (context.scope !== 'directory') {
    return undefined;
  }
  return { directoryIds: context.directoryIds };
}

function compactQuiz(quiz: StatisticsQuizPerformanceItem) {
  return {
    quizId: quiz.quizId,
    quizType: quiz.quizType,
    quizTitle: quiz.quizTitle,
    attemptCount: quiz.attemptCount,
    answeredQuestionCount: quiz.answeredQuestionCount,
    correctAnswerCount: quiz.correctAnswerCount,
    incorrectAnswerCount: quiz.incorrectAnswerCount,
    accuracyPercentage: quiz.accuracyPercentage,
    bestPercentage: quiz.bestPercentage,
    latestPercentage: quiz.latestPercentage,
    lastAttemptAt: quiz.lastAttemptAt,
    sourceDocuments: quiz.sourceDocuments.map((document) => document.title),
  };
}

function compactWrongAnswer(failure: StatisticsRecentFailure) {
  return {
    quizId: failure.quizId,
    quizType: failure.quizType,
    quizTitle: failure.quizTitle,
    questionIndex: failure.questionIndex,
    questionText: failure.questionText,
    selectedAnswer: failure.selectedAnswerLabel,
    correctAnswer: failure.correctAnswerLabel,
    occurredAt: failure.occurredAt,
    repeatedFailureCount: failure.repeatedFailureCount,
    subjectName: failure.knowledge?.subjectName,
    knowledgeDomainName: failure.knowledge?.knowledgeDomainName,
  };
}

function compactAttempt(attempt: StatisticsQuizDetailAttempt) {
  return {
    completedAt: attempt.completedAt,
    score: attempt.score,
    totalQuestions: attempt.totalQuestions,
    correctAnswerCount: attempt.score,
    incorrectAnswerCount: attempt.incorrectAnswerCount,
    percentage: attempt.percentage,
    durationMs: attempt.durationMs,
  };
}

function compactQuestion(question: StatisticsQuestionBreakdownItem) {
  return {
    questionIndex: question.questionIndex,
    questionText: question.questionText,
    answerCount: question.answerCount,
    correctCount: question.correctCount,
    incorrectCount: question.incorrectCount,
    accuracyPercentage: question.accuracyPercentage,
  };
}

export function createQuizStatisticsToolDefinitions(
  context: IQuizStatisticsToolContext,
): IQuizStatisticsToolDefinition[] {
  return [
    {
      name: 'get_quiz_statistics',
      description:
        'Read quiz attempt statistics for quizzes, diagram quizzes, and sequence quizzes. Returns overall accuracy plus per-quiz correct vs incorrect counts. Use when the user asks how they performed, scores, or attempt history.',
      parameters: {
        type: 'object',
        properties: {
          quizType: {
            type: 'string',
            enum: [...QUIZ_TYPE_FILTER_ENUM],
            description: 'Filter by quiz kind. Default all.',
          },
          timeRange: {
            type: 'string',
            enum: [...TIME_RANGE_ENUM],
            description:
              'Relative window. Ignored when startDate or endDate is set.',
          },
          startDate: {
            type: 'string',
            description: 'Inclusive start date YYYY-MM-DD',
          },
          endDate: {
            type: 'string',
            description: 'Inclusive end date YYYY-MM-DD',
          },
        },
      },
      execute: async (args) => {
        const quizType = parseQuizTypeFilter(args.quizType);
        const range = buildDateRange(args, quizType);
        const scope = statisticsScope(context);
        const [overview, performance] = await Promise.all([
          getStatisticsOverview(context.userId, range, scope),
          getStatisticsQuizPerformance(context.userId, range, scope),
        ]);
        const quizzes = performance.quizzes
          .slice(0, MAX_QUIZZES_IN_TOOL_RESULT)
          .map(compactQuiz);
        return {
          metrics: overview.metrics,
          quizzes,
          quizCount: performance.quizzes.length,
          truncated: performance.quizzes.length > quizzes.length,
        };
      },
    },
    {
      name: 'get_quiz_answer_details',
      description:
        'Read right vs wrong answer details for quizzes, diagram quizzes, and sequence quizzes. Omit quizId for recent wrong answers across quizzes. Pass quizId and quizType for per-question correct/incorrect counts, attempt scores, and selected vs correct answers.',
      parameters: {
        type: 'object',
        properties: {
          quizId: {
            type: 'string',
            description: 'Specific quiz, diagram quiz, or sequence quiz id.',
          },
          quizType: {
            type: 'string',
            enum: [...QUIZ_TYPE_FILTER_ENUM],
            description:
              'Required with quizId (quiz, diagramQuiz, or sequenceQuiz). Optional filter when quizId is omitted.',
          },
          timeRange: {
            type: 'string',
            enum: [...TIME_RANGE_ENUM],
            description:
              'Relative window. Ignored when startDate or endDate is set.',
          },
          startDate: {
            type: 'string',
            description: 'Inclusive start date YYYY-MM-DD',
          },
          endDate: {
            type: 'string',
            description: 'Inclusive end date YYYY-MM-DD',
          },
        },
      },
      execute: async (args) => {
        const quizId =
          typeof args.quizId === 'string' && args.quizId.trim().length > 0
            ? args.quizId.trim()
            : undefined;
        const scope = statisticsScope(context);

        if (quizId) {
          const quizType = parseQuizTelemetryType(args.quizType);
          const range = buildDateRange(args, quizType);
          const detail = await getStatisticsQuizDetail(
            context.userId,
            { ...range, quizId, quizType },
            scope,
          );
          const wrongAnswers = detail.failedQuestions
            .slice(0, MAX_WRONG_ANSWERS_IN_TOOL_RESULT)
            .map(compactWrongAnswer);
          const attempts = detail.attempts
            .slice(0, MAX_ATTEMPTS_IN_TOOL_RESULT)
            .map(compactAttempt);
          return {
            quiz: detail.quiz ? compactQuiz(detail.quiz) : null,
            attempts,
            attemptCount: detail.attempts.length,
            questionBreakdown: detail.questionBreakdown.map(compactQuestion),
            wrongAnswers,
            wrongAnswerCount: detail.failedQuestions.length,
            truncated:
              detail.attempts.length > attempts.length ||
              detail.failedQuestions.length > wrongAnswers.length,
          };
        }

        const quizType = parseQuizTypeFilter(args.quizType);
        const range = buildDateRange(args, quizType);
        const overview = await getStatisticsOverview(
          context.userId,
          range,
          scope,
        );
        const wrongAnswers = overview.recentFailures
          .slice(0, MAX_WRONG_ANSWERS_IN_TOOL_RESULT)
          .map(compactWrongAnswer);
        return {
          metrics: {
            correctAnswerCount: overview.metrics.correctAnswerCount,
            incorrectAnswerCount: overview.metrics.incorrectAnswerCount,
            accuracyPercentage: overview.metrics.accuracyPercentage,
            answeredQuestionCount: overview.metrics.answeredQuestionCount,
          },
          wrongAnswers,
          wrongAnswerCount: overview.recentFailures.length,
          truncated: overview.recentFailures.length > wrongAnswers.length,
        };
      },
    },
  ];
}
