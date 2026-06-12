import React from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  BookOpen,
  Brain,
  Clock3,
  ExternalLink,
  RefreshCw,
  Target,
  TrendingUp,
} from 'lucide-react';
import { StatisticsKnowledgeGapItem, StatisticsQuizPerformanceItem } from '@shared-types';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/Card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../components/ui/Tabs';
import { useStatisticsPageContext } from '../context/hooks/useStatisticsPageContext';
import { StatisticsTab } from '../types/IStatisticsPageHandlers';
import {
  artifactTypeLabel,
  detailQuizPath,
  formatDateTime,
  formatDurationMs,
  formatInteger,
  formatPercentage,
  formatSeconds,
  knowledgePath,
  QUIZ_TYPE_OPTIONS,
  quizTypeLabel,
  TIME_RANGE_OPTIONS,
} from '../utils/statisticsPageUtils';
import { FailureList } from './FailureList';
import { EmptyState, ErrorBlock, LoadingBlock, MetricCard } from './StatisticsShared';

const MAX_BAR_PERCENT = 100;

const KnowledgeGapChart = ({ gaps }: { gaps: StatisticsKnowledgeGapItem[] }) => {
  if (gaps.length === 0) {
    return (
      <EmptyState
        title="No knowledge gaps yet"
        description="Knowledge-domain rankings appear after quiz attempts are recorded."
      />
    );
  }

  const topGaps = gaps.slice(0, 8);
  const maxWeight = Math.max(...topGaps.map((gap) => gap.incorrectCount + gap.explanationRequestCount), 1);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Brain className="h-4 w-4 text-primary" />
          Knowledge Gap Ranking
        </CardTitle>
        <CardDescription>Sorted by failed answers, explanation requests, and accuracy.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {topGaps.map((gap) => {
          const weight = gap.incorrectCount + gap.explanationRequestCount;
          const width = Math.max(8, Math.round((weight / maxWeight) * MAX_BAR_PERCENT));

          return (
            <Link
              key={gap.id}
              to={knowledgePath(gap.subjectKey, gap.knowledgeDomainKey)}
              className="block rounded-md border border-border/70 p-3 transition-colors hover:bg-muted/40"
            >
              <div className="mb-2 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">{gap.knowledgeDomainName}</p>
                  <p className="truncate text-xs text-muted-foreground">{gap.subjectName}</p>
                </div>
                <Badge variant={gap.accuracyPercentage < 60 ? 'destructive' : 'secondary'}>
                  {formatPercentage(gap.accuracyPercentage)}
                </Badge>
              </div>
              <div className="h-2 rounded-full bg-muted">
                <div className="h-2 rounded-full bg-primary" style={{ width: `${width}%` }} />
              </div>
              <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                <span>{formatInteger(gap.incorrectCount)} failed</span>
                <span>{formatInteger(gap.explanationRequestCount)} explanations</span>
                <span>{formatInteger(gap.answerCount)} answers</span>
              </div>
            </Link>
          );
        })}
      </CardContent>
    </Card>
  );
};

const QuizPerformanceTable = ({ quizzes }: { quizzes: StatisticsQuizPerformanceItem[] }) => {
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
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/30 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Quiz</th>
                <th className="px-4 py-3 font-medium">Accuracy</th>
                <th className="px-4 py-3 font-medium">Failed</th>
                <th className="px-4 py-3 font-medium">Explanations</th>
                <th className="px-4 py-3 font-medium">Last attempt</th>
              </tr>
            </thead>
            <tbody>
              {quizzes.map((quiz) => (
                <tr key={quiz.id} className="border-b border-border/60 last:border-0">
                  <td className="px-4 py-3">
                    <Link className="font-medium text-foreground hover:text-primary" to={detailQuizPath(quiz.quizType, quiz.quizId)}>
                      {quiz.quizTitle || 'Untitled quiz'}
                    </Link>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{quizTypeLabel(quiz.quizType)}</Badge>
                      <span className="text-xs text-muted-foreground">{quiz.attemptCount} attempts</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-semibold">{formatPercentage(quiz.accuracyPercentage)}</td>
                  <td className="px-4 py-3">{formatInteger(quiz.incorrectAnswerCount)}</td>
                  <td className="px-4 py-3">{formatInteger(quiz.explanationRequestCount)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDateTime(quiz.lastAttemptAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
};

export const StatisticsPageContainer: React.FC = () => {
  const { statisticsApi, handlers } = useStatisticsPageContext();
  const { filters, isDetailRoute, quizDetailRequest, knowledgeDetailRequest } = statisticsApi;

  const rangeControls = (
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
      <Button variant="outline" size="sm" onClick={handlers.handleRefetchAll}>
        <RefreshCw className="mr-2 h-4 w-4" />
        Refresh
      </Button>
    </div>
  );

  const renderQuizDetail = () => {
    const { quizDetail } = statisticsApi;
    if (quizDetail.isLoading) return <LoadingBlock />;
    if (quizDetail.error) return <ErrorBlock />;
    const detail = quizDetail.data;
    if (!detail?.quiz) {
      return <EmptyState title="Quiz detail is empty" description="No attempts match the selected range." />;
    }

    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-4">
          <MetricCard icon={Target} label="Accuracy" value={formatPercentage(detail.quiz.accuracyPercentage)} detail={`${detail.quiz.attemptCount} attempts`} />
          <MetricCard icon={AlertTriangle} label="Failed answers" value={formatInteger(detail.quiz.incorrectAnswerCount)} detail="Across selected attempts" />
          <MetricCard icon={Brain} label="Explanations" value={formatInteger(detail.quiz.explanationRequestCount)} detail="Detailed requests" />
          <MetricCard icon={Clock3} label="Time spent" value={formatDurationMs(detail.quiz.totalDurationMs)} detail="Quiz duration" />
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Attempts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {detail.attempts.map((attempt) => (
              <div key={attempt.attemptId} className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3 text-sm">
                <span className="text-muted-foreground">{formatDateTime(attempt.completedAt)}</span>
                <span className="font-medium">{attempt.score}/{attempt.totalQuestions}</span>
                <span>{formatPercentage(attempt.percentage)}</span>
                <span className="text-muted-foreground">{formatDurationMs(attempt.durationMs)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
        <FailureList failures={detail.failedQuestions} />
      </div>
    );
  };

  const renderKnowledgeDetail = () => {
    const { knowledgeDetail } = statisticsApi;
    if (knowledgeDetail.isLoading) return <LoadingBlock />;
    if (knowledgeDetail.error) return <ErrorBlock />;
    const detail = knowledgeDetail.data;
    if (!detail?.gap) {
      return <EmptyState title="Knowledge detail is empty" description="No matching domain data exists for this range." />;
    }

    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-4">
          <MetricCard icon={Brain} label="Accuracy" value={formatPercentage(detail.gap.accuracyPercentage)} detail={detail.gap.knowledgeDomainName} />
          <MetricCard icon={AlertTriangle} label="Failed answers" value={formatInteger(detail.gap.incorrectCount)} detail="Domain misses" />
          <MetricCard icon={Target} label="Answers" value={formatInteger(detail.gap.answerCount)} detail="Recorded answers" />
          <MetricCard icon={BookOpen} label="Sources" value={formatInteger(detail.gap.sourceDocuments.length)} detail="Linked documents" />
        </div>
        <QuizPerformanceTable quizzes={detail.relatedQuizzes} />
        <FailureList failures={detail.failedQuestions} />
      </div>
    );
  };

  return (
    <div className="min-h-full bg-background">
      <header className="sticky top-0 z-10 border-b bg-background/95 px-4 py-4 backdrop-blur md:px-0">
        <div className="mx-auto flex max-w-7xl flex-col gap-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              {isDetailRoute && (
                <Button variant="ghost" size="icon" onClick={handlers.handleBackToStatistics} aria-label="Back to Statistics">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              )}
              <div className="rounded-md bg-primary/10 p-2 text-primary">
                <BarChart3 className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-2xl font-semibold tracking-tight text-foreground">Statistics</h1>
                <p className="text-sm text-muted-foreground">
                  {isDetailRoute ? 'Detailed learning telemetry' : 'Quiz performance, knowledge gaps, and learning time'}
                </p>
              </div>
            </div>
            {rangeControls}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
        {quizDetailRequest && renderQuizDetail()}
        {knowledgeDetailRequest && renderKnowledgeDetail()}

        {!isDetailRoute && (
          <>
            {statisticsApi.isLoading && <LoadingBlock />}
            {statisticsApi.hasError && <ErrorBlock />}

            {!statisticsApi.isLoading && !statisticsApi.hasError && (
              <Tabs
                value={handlers.activeTab}
                onValueChange={(value) => handlers.handleActiveTabChange(value as StatisticsTab)}
              >
                <TabsList className="flex flex-wrap">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="performance">Quiz Performance</TabsTrigger>
                  <TabsTrigger value="knowledge">Knowledge Gaps</TabsTrigger>
                  <TabsTrigger value="time">Learning Time</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="mt-6 space-y-6">
                  <div className="grid gap-4 md:grid-cols-3">
                    <MetricCard
                      icon={TrendingUp}
                      label="Overall accuracy"
                      value={formatPercentage(statisticsApi.overview.data?.metrics.accuracyPercentage ?? 0)}
                      detail={`${formatInteger(statisticsApi.overview.data?.metrics.answeredQuestionCount ?? 0)} answers`}
                    />
                    <MetricCard
                      icon={AlertTriangle}
                      label="Failed questions"
                      value={formatInteger(statisticsApi.overview.data?.metrics.incorrectAnswerCount ?? 0)}
                      detail="Incorrect answers"
                    />
                    <MetricCard
                      icon={Brain}
                      label="Explanation requests"
                      value={formatInteger(statisticsApi.overview.data?.metrics.explanationRequestCount ?? 0)}
                      detail="Detailed help requested"
                    />
                  </div>

                  <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
                    <KnowledgeGapChart gaps={statisticsApi.gaps.data?.gaps ?? []} />
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                          <Target className="h-4 w-4 text-primary" />
                          Recommended Review
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {(statisticsApi.overview.data?.recommendations ?? []).length === 0 && (
                          <p className="text-sm text-muted-foreground">No recommendations for this range.</p>
                        )}
                        {(statisticsApi.overview.data?.recommendations ?? []).map((item) => (
                          <Link
                            key={item.id}
                            to={knowledgePath(item.subjectKey, item.knowledgeDomainKey)}
                            className="block rounded-md border p-3 transition-colors hover:bg-muted/40"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="font-medium text-foreground">{item.title}</p>
                                <p className="mt-1 text-xs text-muted-foreground">{item.description}</p>
                              </div>
                              <ExternalLink className="h-4 w-4 text-muted-foreground" />
                            </div>
                          </Link>
                        ))}
                      </CardContent>
                    </Card>
                  </div>

                  <FailureList failures={statisticsApi.overview.data?.recentFailures ?? []} />
                </TabsContent>

                <TabsContent value="performance" className="mt-6 space-y-6">
                  <QuizPerformanceTable quizzes={statisticsApi.performance.data?.quizzes ?? []} />
                  <FailureList failures={statisticsApi.performance.data?.recentFailures ?? []} />
                </TabsContent>

                <TabsContent value="knowledge" className="mt-6">
                  <KnowledgeGapChart gaps={statisticsApi.gaps.data?.gaps ?? []} />
                </TabsContent>

                <TabsContent value="time" className="mt-6 space-y-6">
                  <div className="grid gap-4 md:grid-cols-3">
                    <MetricCard
                      icon={Clock3}
                      label="Active learning time"
                      value={formatSeconds(statisticsApi.learningTime.data?.totalSeconds ?? 0)}
                      detail={`${formatInteger(statisticsApi.learningTime.data?.sessionCount ?? 0)} sessions`}
                    />
                    <MetricCard
                      icon={BookOpen}
                      label="Tracked artifacts"
                      value={formatInteger(statisticsApi.learningTime.data?.topArtifacts.length ?? 0)}
                      detail="Most engaged items"
                    />
                    <MetricCard
                      icon={BarChart3}
                      label="Activity types"
                      value={formatInteger(statisticsApi.learningTime.data?.byArtifactType.length ?? 0)}
                      detail="Documents, quizzes, and artifacts"
                    />
                  </div>

                  <div className="grid gap-6 lg:grid-cols-2">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Time by Activity</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {(statisticsApi.learningTime.data?.byArtifactType ?? []).map((row) => (
                          <div key={row.artifactType} className="flex items-center justify-between rounded-md border p-3">
                            <span className="font-medium">{artifactTypeLabel(row.artifactType)}</span>
                            <span className="text-muted-foreground">{formatSeconds(row.totalSeconds)}</span>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Most Engaged</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {(statisticsApi.learningTime.data?.topArtifacts ?? []).map((artifact) => (
                          <div key={artifact.id} className="rounded-md border p-3">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate font-medium text-foreground">{artifact.title}</p>
                                <p className="text-xs text-muted-foreground">{artifactTypeLabel(artifact.artifactType)}</p>
                              </div>
                              <span className="text-sm text-muted-foreground">{formatSeconds(artifact.totalSeconds)}</span>
                            </div>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>
              </Tabs>
            )}
          </>
        )}
      </main>
    </div>
  );
};
