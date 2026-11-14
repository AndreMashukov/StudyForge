import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  Brain,
  Target,
  TrendingUp,
  ListChecks,
} from 'lucide-react';
import { StatisticsQuizPerformanceItem } from '@shared-types';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '../../../components/ui/Card';
import { useStatisticsPageContext } from '../context/hooks/useStatisticsPageContext';
import {
  detailQuizPath,
  formatDateTime,
  formatInteger,
  formatPercentage,
  QUIZ_TYPE_OPTIONS,
  quizTypeLabel,
  TIME_RANGE_OPTIONS,
} from '../utils/statisticsPageUtils';
import { FailureList } from './FailureList';
import {
  EmptyState,
  ErrorBlock,
  LoadingBlock,
  MetricCard,
} from './StatisticsShared';
import { VirtualizedList } from '../../../components/VirtualizedList';
import { Spinner } from '../../../components/ui/Spinner';

interface IQuizPerformanceTable {
  quizzes: StatisticsQuizPerformanceItem[];
}

const QuizPerformanceTable = ({ quizzes }: IQuizPerformanceTable) => {
  if (quizzes.length === 0) {
    return (
      <EmptyState
        title="No quiz performance yet"
        description="Completed quiz attempts will appear here."
      />
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" />
          Quiz Performance
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <div className="min-w-[720px]">
            <div className="border-b bg-muted/30 text-left text-xs uppercase text-muted-foreground">
              <div className="grid grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))] px-4 py-3 font-medium">
                <span>Quiz</span>
                <span>Accuracy</span>
                <span>Failed</span>
                <span>Explanations</span>
                <span>Last attempt</span>
              </div>
            </div>
            <VirtualizedList
              items={quizzes}
              scrollMode="window"
              estimateSize={88}
              renderItem={(quiz) => (
                <div className="grid grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))] border-b border-border/60 px-4 py-3 text-sm last:border-0">
                  <div>
                    <Link
                      className="font-medium text-foreground hover:text-primary"
                      to={detailQuizPath(quiz.quizType, quiz.quizId)}
                    >
                      {quiz.quizTitle || 'Untitled quiz'}
                    </Link>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <Badge variant="outline">
                        {quizTypeLabel(quiz.quizType)}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {quiz.attemptCount} attempts
                      </span>
                    </div>
                  </div>
                  <div className="font-semibold">
                    {formatPercentage(quiz.accuracyPercentage)}
                  </div>
                  <div>{formatInteger(quiz.incorrectAnswerCount)}</div>
                  <div>{formatInteger(quiz.explanationRequestCount)}</div>
                  <div className="text-muted-foreground">
                    {formatDateTime(quiz.lastAttemptAt)}
                  </div>
                </div>
              )}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export const StatisticsPageContainer: React.FC = () => {
  const { statisticsApi, handlers } = useStatisticsPageContext();
  const { filters, isDetailRoute, quizDetailRequest } = statisticsApi;

  const pageHeader = useMemo(() => {
    if (quizDetailRequest) {
      const quiz = statisticsApi.quizDetail.data?.quiz;
      return {
        title: 'Details',
        subtitle: quiz?.quizTitle ?? 'Quiz details',
      };
    }
    return {
      title: 'Progress',
      subtitle: 'Understand your quiz results. Decide what to revisit.',
    };
  }, [quizDetailRequest, statisticsApi.quizDetail.data?.quiz]);

  const timeRangeControls = (
    <div className="flex flex-wrap items-center gap-2">
      {TIME_RANGE_OPTIONS.map((option) => (
        <Button
          key={option.value}
          variant={filters.timeRange === option.value ? 'default' : 'outline'}
          size="sm"
          onClick={() => handlers.handleSetTimeRange(option.value)}
        >
          {option.label}
        </Button>
      ))}
    </div>
  );

  const quizTypeControls = (
    <div className="flex flex-wrap items-center gap-2">
      {QUIZ_TYPE_OPTIONS.map((option) => (
        <Button
          key={option.value}
          variant={filters.quizType === option.value ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => handlers.handleSetQuizType(option.value)}
        >
          {option.label}
        </Button>
      ))}
    </div>
  );

  const loadMoreAttemptsFooter = statisticsApi.overview.data
    ?.hasMoreAttempts ? (
    <div className="flex justify-center pt-4">
      <Button
        variant="outline"
        onClick={() => void handlers.handleLoadMoreAttempts()}
        disabled={handlers.isLoadingMoreAttempts}
      >
        {handlers.isLoadingMoreAttempts ? (
          <>
            <Spinner size="sm" className="mr-2" />
            Loading...
          </>
        ) : (
          'Load more'
        )}
      </Button>
    </div>
  ) : null;

  const renderQuizDetail = () => {
    const { quizDetail } = statisticsApi;
    if (quizDetail.isLoading) return <LoadingBlock />;
    if (quizDetail.error) return <ErrorBlock />;
    const detail = quizDetail.data;
    if (!detail?.quiz) {
      return (
        <EmptyState
          title="Quiz detail is empty"
          description="No attempts match the selected range."
        />
      );
    }

    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-3">
          <MetricCard
            icon={Target}
            label="Accuracy"
            value={formatPercentage(detail.quiz.accuracyPercentage)}
            detail={`${detail.quiz.attemptCount} attempts`}
          />
          <MetricCard
            icon={AlertTriangle}
            label="Failed answers"
            value={formatInteger(detail.quiz.incorrectAnswerCount)}
            detail="Across selected attempts"
          />
          <MetricCard
            icon={Brain}
            label="Explanations"
            value={formatInteger(detail.quiz.explanationRequestCount)}
            detail="Detailed requests"
          />
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Attempts</CardTitle>
          </CardHeader>
          <CardContent>
            <VirtualizedList
              items={detail.attempts}
              scrollMode="window"
              estimateSize={72}
              gap={12}
              renderItem={(attempt) => (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3 text-sm">
                  <span className="text-muted-foreground">
                    {formatDateTime(attempt.completedAt)}
                  </span>
                  <span className="font-medium">
                    {attempt.score}/{attempt.totalQuestions}
                  </span>
                  <span>{formatPercentage(attempt.percentage)}</span>
                </div>
              )}
            />
          </CardContent>
        </Card>
        <FailureList
          failures={detail.failedQuestions}
          onHideFailure={handlers.handleHideFailure}
        />
      </div>
    );
  };

  return (
    <div className="min-h-full bg-background">
      <header className="border-b bg-background px-4 py-5 md:px-6">
        <div className="mx-auto flex max-w-7xl flex-col gap-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              {isDetailRoute && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handlers.handleBackToStatistics}
                  aria-label="Back to Progress"
                >
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              )}
              <div className="rounded-md bg-primary/10 p-2 text-primary">
                <BarChart3 className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                  {pageHeader.title}
                </h1>
                <p className="text-sm text-muted-foreground">
                  {pageHeader.subtitle}
                </p>
              </div>
            </div>
            {timeRangeControls}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
        {quizDetailRequest && renderQuizDetail()}

        {!isDetailRoute && (
          <>
            {statisticsApi.overview.isLoading ? (
              <LoadingBlock />
            ) : statisticsApi.overview.error && !statisticsApi.overview.data ? (
              <ErrorBlock />
            ) : (
              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                <MetricCard
                  compact
                  icon={TrendingUp}
                  label="Answer accuracy"
                  value={
                    statisticsApi.overview.data?.metrics.answeredQuestionCount
                      ? formatPercentage(
                          statisticsApi.overview.data.metrics
                            .accuracyPercentage,
                        )
                      : '—'
                  }
                  detail={`${formatInteger(statisticsApi.overview.data?.metrics.correctAnswerCount ?? 0)} correct of ${formatInteger(statisticsApi.overview.data?.metrics.answeredQuestionCount ?? 0)} answers`}
                />
                <MetricCard
                  compact
                  icon={AlertTriangle}
                  label="Incorrect answers"
                  value={formatInteger(
                    statisticsApi.overview.data?.metrics.incorrectAnswerCount ??
                      0,
                  )}
                  detail="Includes repeat misses"
                />
                <MetricCard
                  compact
                  icon={ListChecks}
                  label="Questions to revisit"
                  value={`${formatInteger(statisticsApi.overview.data?.recentFailures.length ?? 0)}${statisticsApi.overview.data?.hasMoreAttempts ? '+' : ''}`}
                  detail={
                    statisticsApi.overview.data?.hasMoreAttempts
                      ? 'Loaded questions · more history available'
                      : 'Repeated misses grouped by question'
                  }
                />
              </div>
            )}
            <div>
              <div
                role="group"
                aria-label="Progress view"
                className="mb-5 inline-flex gap-1 rounded-lg bg-muted p-1"
              >
                <Button
                  variant={
                    handlers.activeTab === 'overview' ? 'secondary' : 'ghost'
                  }
                  size="sm"
                  aria-pressed={handlers.activeTab === 'overview'}
                  aria-controls="statistics-review"
                  onClick={() => handlers.handleActiveTabChange('overview')}
                >
                  Review questions
                </Button>
                <Button
                  variant={
                    handlers.activeTab === 'performance' ? 'secondary' : 'ghost'
                  }
                  size="sm"
                  aria-pressed={handlers.activeTab === 'performance'}
                  aria-controls="statistics-performance"
                  onClick={() => handlers.handleActiveTabChange('performance')}
                >
                  Quiz performance
                </Button>
              </div>
              {quizTypeControls}
              <section
                id="statistics-review"
                aria-label="Review questions"
                hidden={handlers.activeTab !== 'overview'}
                className="mt-5 space-y-4"
              >
                {statisticsApi.overview.isLoading ? null : statisticsApi
                    .overview.error && !statisticsApi.overview.data ? (
                  <Button
                    variant="outline"
                    onClick={() => statisticsApi.overview.refetch()}
                  >
                    Retry questions
                  </Button>
                ) : (
                  <>
                    {statisticsApi.loadMoreError && (
                      <p className="text-sm text-destructive" role="alert">
                        {statisticsApi.loadMoreError}
                        <Button
                          variant="link"
                          size="sm"
                          onClick={() => statisticsApi.overview.refetch()}
                        >
                          Retry
                        </Button>
                      </p>
                    )}
                    <FailureList
                      failures={
                        statisticsApi.overview.data?.recentFailures ?? []
                      }
                      hasMore={
                        statisticsApi.overview.data?.hasMoreAttempts ?? false
                      }
                      onHideFailure={handlers.handleHideFailure}
                      footer={loadMoreAttemptsFooter}
                    />
                  </>
                )}
              </section>
              <section
                id="statistics-performance"
                aria-label="Quiz performance"
                hidden={handlers.activeTab !== 'performance'}
                className="mt-5 space-y-4"
              >
                {statisticsApi.performance.isLoading ? (
                  <LoadingBlock />
                ) : statisticsApi.performance.error ? (
                  <>
                    <ErrorBlock />
                    <Button
                      variant="outline"
                      onClick={() => statisticsApi.performance.refetch()}
                    >
                      Retry performance
                    </Button>
                  </>
                ) : (
                  <QuizPerformanceTable
                    quizzes={statisticsApi.performance.data?.quizzes ?? []}
                  />
                )}
              </section>
            </div>
          </>
        )}
      </main>
    </div>
  );
};
