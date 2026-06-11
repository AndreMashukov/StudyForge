import React, { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  BookOpen,
  Brain,
  Clock3,
  ExternalLink,
  Eye,
  ListOrdered,
  RefreshCw,
  Target,
  TrendingUp,
} from 'lucide-react';
import {
  GetStatisticsKnowledgeDetailRequest,
  GetStatisticsQuizDetailRequest,
  QuizTelemetryType,
  StatisticsKnowledgeGapItem,
  StatisticsQuizPerformanceItem,
  StatisticsQuizTypeFilter,
  StatisticsRecentFailure,
  StatisticsTimeRangeKey,
} from '@shared-types';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/Card';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../../components/ui/Dialog';
import { MermaidDiagram } from '../../../components/MermaidDiagram';
import { Spinner } from '../../../components/ui/Spinner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../components/ui/Tabs';
import {
  useGetStatisticsKnowledgeDetailQuery,
  useGetStatisticsKnowledgeGapsQuery,
  useGetStatisticsLearningTimeQuery,
  useGetStatisticsOverviewQuery,
  useGetStatisticsQuizDetailQuery,
  useGetStatisticsQuizPerformanceQuery,
} from '../../../store/api/Statistics';
import {
  artifactTypeLabel,
  detailQuizPath,
  formatDateTime,
  formatDurationMs,
  formatInteger,
  formatPercentage,
  formatSeconds,
  getStatisticsDateRange,
  knowledgePath,
  QUIZ_TYPE_OPTIONS,
  quizTypeLabel,
  TIME_RANGE_OPTIONS,
} from '../utils/statisticsPageUtils';

type StatisticsTab = 'overview' | 'performance' | 'knowledge' | 'time';

type RouteParamKey = 'quizType' | 'quizId' | 'subjectKey' | 'knowledgeDomainKey';

const MAX_BAR_PERCENT = 100;

function isQuizTelemetryType(value: string | undefined): value is QuizTelemetryType {
  return value === 'quiz' || value === 'diagramQuiz' || value === 'sequenceQuiz';
}

const EmptyState = ({ title, description }: { title: string; description: string }) => (
  <Card>
    <CardContent className="p-10 text-center">
      <BarChart3 className="mx-auto mb-4 h-10 w-10 text-muted-foreground/60" />
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
    </CardContent>
  </Card>
);

const LoadingBlock = () => (
  <div className="flex justify-center py-14">
    <Spinner size="lg" variant="muted" />
  </div>
);

const ErrorBlock = () => (
  <Card className="border-destructive/50">
    <CardContent className="p-6 text-destructive">Failed to load statistics.</CardContent>
  </Card>
);

const MetricCard = ({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  detail: string;
}) => (
  <Card>
    <CardContent className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground">{value}</p>
          <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
        </div>
        <div className="rounded-md bg-primary/10 p-2 text-primary">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </CardContent>
  </Card>
);

type FailureComparisonState =
  | {
      kind: 'diagram';
      questionText: string;
      selectedCode: string;
      correctCode: string;
    }
  | {
      kind: 'sequence';
      questionText: string;
      selectedItems: string[];
      correctItems: string[];
    };

const SEQUENCE_ITEM_SEPARATOR = ' → ';

function isDiagramQuiz(quizType: string | undefined): boolean {
  return quizType === 'diagramQuiz';
}

function isSequenceQuiz(quizType: string | undefined): boolean {
  return quizType === 'sequenceQuiz';
}

function splitSequenceLabel(label: string): string[] {
  return label
    .split(SEQUENCE_ITEM_SEPARATOR)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

interface ISequenceListProps {
  items: string[];
  tone: 'wrong' | 'right';
}

const SequenceList = ({ items, tone }: ISequenceListProps) => (
  <ol className="space-y-2 text-sm">
    {items.map((item, index) => (
      <li
        key={`${tone}-${index}-${item}`}
        className={
          tone === 'wrong'
            ? 'flex items-start gap-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2'
            : 'flex items-start gap-3 rounded-md border border-success/40 bg-success/10 px-3 py-2'
        }
      >
        <span
          className={
            tone === 'wrong'
              ? 'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-destructive/20 text-xs font-semibold text-destructive'
              : 'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success/20 text-xs font-semibold text-success'
          }
        >
          {index + 1}
        </span>
        <span className="text-foreground">{item}</span>
      </li>
    ))}
  </ol>
);

const FailureList = ({ failures }: { failures: StatisticsRecentFailure[] }) => {
  const [openComparison, setOpenComparison] = useState<FailureComparisonState | null>(null);

  if (failures.length === 0) {
    return (
      <EmptyState
        title="No failed answers in this range"
        description="Quiz misses will appear here after completed attempts."
      />
    );
  }

  const handleOpenComparison = (failure: StatisticsRecentFailure) => {
    if (isDiagramQuiz(failure.quizType)) {
      setOpenComparison({
        kind: 'diagram',
        questionText: failure.questionText,
        selectedCode: failure.selectedAnswerLabel,
        correctCode: failure.correctAnswerLabel,
      });
      return;
    }
    if (isSequenceQuiz(failure.quizType)) {
      setOpenComparison({
        kind: 'sequence',
        questionText: failure.questionText,
        selectedItems: splitSequenceLabel(failure.selectedAnswerLabel),
        correctItems: splitSequenceLabel(failure.correctAnswerLabel),
      });
    }
  };

  const handleClose = () => setOpenComparison(null);

  return (
    <div className="space-y-3">
      {failures.map((failure) => {
        const isDiagram = isDiagramQuiz(failure.quizType);
        const isSequence = isSequenceQuiz(failure.quizType);
        const showRichAnswer = isDiagram || isSequence;

        return (
          <Card key={failure.id}>
            <CardContent className="p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{quizTypeLabel(failure.quizType)}</Badge>
                    <span className="text-xs text-muted-foreground">{formatDateTime(failure.occurredAt)}</span>
                    {failure.repeatedFailureCount > 1 && (
                      <Badge variant="outline">{failure.repeatedFailureCount} repeats</Badge>
                    )}
                  </div>
                  <h3 className="text-sm font-semibold text-foreground">{failure.questionText}</h3>
                  {showRichAnswer ? (
                    <div className="mt-3 rounded-md border border-dashed border-border bg-muted/20 p-3">
                      <p className="text-xs uppercase text-muted-foreground">Comparison</p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="mt-2"
                        onClick={() => handleOpenComparison(failure)}
                        aria-label={
                          isDiagram ? 'View diagram comparison' : 'View sequence comparison'
                        }
                      >
                        {isDiagram ? (
                          <Eye className="mr-2 h-4 w-4" />
                        ) : (
                          <ListOrdered className="mr-2 h-4 w-4" />
                        )}
                        {isDiagram ? 'View diagram' : 'View sequence'}
                      </Button>
                    </div>
                  ) : (
                    <div className="mt-3 grid gap-2 text-sm md:grid-cols-2">
                      <div className="rounded-md bg-destructive/10 p-3">
                        <p className="text-xs uppercase text-muted-foreground">Your answer</p>
                        <p className="mt-1 text-destructive">{failure.selectedAnswerLabel}</p>
                      </div>
                      <div className="rounded-md bg-accent/10 p-3">
                        <p className="text-xs uppercase text-muted-foreground">Correct answer</p>
                        <p className="mt-1 text-foreground">{failure.correctAnswerLabel}</p>
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-2 md:w-48">
                  <Button variant="outline" size="sm" asChild>
                    <Link to={detailQuizPath(failure.quizType, failure.quizId)}>Quiz detail</Link>
                  </Button>
                  {failure.sourceDocuments.slice(0, 1).map((document) => (
                    <Button key={document.id} variant="ghost" size="sm" asChild>
                      <Link to={`/document/${document.id}`}>
                        <BookOpen className="mr-2 h-4 w-4" />
                        Source
                      </Link>
                    </Button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}

      <Dialog
        open={openComparison !== null}
        onOpenChange={(isOpen) => {
          if (!isOpen) handleClose();
        }}
      >
        <DialogContent className="max-w-4xl">
          {openComparison && (
            <>
              <DialogHeader>
                <DialogTitle>
                  {openComparison.kind === 'diagram' ? 'Diagram comparison' : 'Sequence comparison'}
                </DialogTitle>
                <DialogDescription>{openComparison.questionText}</DialogDescription>
              </DialogHeader>
              <DialogBody>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase text-destructive">Your answer</p>
                    {openComparison.kind === 'diagram' ? (
                      <MermaidDiagram code={openComparison.selectedCode} className="min-h-[200px]" />
                    ) : (
                      <SequenceList items={openComparison.selectedItems} tone="wrong" />
                    )}
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase text-success">Correct answer</p>
                    {openComparison.kind === 'diagram' ? (
                      <MermaidDiagram code={openComparison.correctCode} className="min-h-[200px]" />
                    ) : (
                      <SequenceList items={openComparison.correctItems} tone="right" />
                    )}
                  </div>
                </div>
              </DialogBody>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

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
  const navigate = useNavigate();
  const params = useParams<RouteParamKey>();
  const [activeTab, setActiveTab] = useState<StatisticsTab>('overview');
  const [timeRange, setTimeRange] = useState<StatisticsTimeRangeKey>('30d');
  const [quizType, setQuizType] = useState<StatisticsQuizTypeFilter>('all');

  const request = useMemo(
    () => getStatisticsDateRange(timeRange, quizType),
    [timeRange, quizType]
  );

  const quizDetailRequest = useMemo<GetStatisticsQuizDetailRequest | null>(() => {
    if (!params.quizId || !isQuizTelemetryType(params.quizType)) return null;
    return {
      ...request,
      quizId: params.quizId,
      quizType: params.quizType,
    };
  }, [params.quizId, params.quizType, request]);

  const knowledgeDetailRequest = useMemo<GetStatisticsKnowledgeDetailRequest | null>(() => {
    if (!params.subjectKey || !params.knowledgeDomainKey) return null;
    return {
      ...request,
      subjectKey: decodeURIComponent(params.subjectKey),
      knowledgeDomainKey: decodeURIComponent(params.knowledgeDomainKey),
    };
  }, [params.subjectKey, params.knowledgeDomainKey, request]);

  const isDetailRoute = Boolean(quizDetailRequest || knowledgeDetailRequest);

  const overviewQuery = useGetStatisticsOverviewQuery(request, { skip: isDetailRoute });
  const performanceQuery = useGetStatisticsQuizPerformanceQuery(request, { skip: isDetailRoute });
  const gapsQuery = useGetStatisticsKnowledgeGapsQuery(request, { skip: isDetailRoute });
  const timeQuery = useGetStatisticsLearningTimeQuery(request, { skip: isDetailRoute });
  const quizDetailQuery = useGetStatisticsQuizDetailQuery(quizDetailRequest as GetStatisticsQuizDetailRequest, {
    skip: !quizDetailRequest,
  });
  const knowledgeDetailQuery = useGetStatisticsKnowledgeDetailQuery(
    knowledgeDetailRequest as GetStatisticsKnowledgeDetailRequest,
    { skip: !knowledgeDetailRequest }
  );

  const isLoading = overviewQuery.isLoading || performanceQuery.isLoading || gapsQuery.isLoading || timeQuery.isLoading;
  const hasError = Boolean(overviewQuery.error || performanceQuery.error || gapsQuery.error || timeQuery.error);

  const refetchAll = () => {
    if (isDetailRoute) {
      if (quizDetailRequest) quizDetailQuery.refetch();
      if (knowledgeDetailRequest) knowledgeDetailQuery.refetch();
      return;
    }
    overviewQuery.refetch();
    performanceQuery.refetch();
    gapsQuery.refetch();
    timeQuery.refetch();
  };

  const rangeControls = (
    <div className="flex flex-wrap items-center gap-2">
      {TIME_RANGE_OPTIONS.map((option) => (
        <Button
          key={option.value}
          variant={timeRange === option.value ? 'default' : 'outline'}
          size="sm"
          onClick={() => setTimeRange(option.value)}
        >
          {option.label}
        </Button>
      ))}
      {QUIZ_TYPE_OPTIONS.map((option) => (
        <Button
          key={option.value}
          variant={quizType === option.value ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => setQuizType(option.value)}
        >
          {option.label}
        </Button>
      ))}
      <Button variant="outline" size="sm" onClick={refetchAll}>
        <RefreshCw className="mr-2 h-4 w-4" />
        Refresh
      </Button>
    </div>
  );

  const renderQuizDetail = () => {
    if (quizDetailQuery.isLoading) return <LoadingBlock />;
    if (quizDetailQuery.error) return <ErrorBlock />;
    const detail = quizDetailQuery.data;
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
    if (knowledgeDetailQuery.isLoading) return <LoadingBlock />;
    if (knowledgeDetailQuery.error) return <ErrorBlock />;
    const detail = knowledgeDetailQuery.data;
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
                <Button variant="ghost" size="icon" onClick={() => navigate('/statistics')} aria-label="Back to Statistics">
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
            {isLoading && <LoadingBlock />}
            {hasError && <ErrorBlock />}

            {!isLoading && !hasError && (
              <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as StatisticsTab)}>
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
                      value={formatPercentage(overviewQuery.data?.metrics.accuracyPercentage ?? 0)}
                      detail={`${formatInteger(overviewQuery.data?.metrics.answeredQuestionCount ?? 0)} answers`}
                    />
                    <MetricCard
                      icon={AlertTriangle}
                      label="Failed questions"
                      value={formatInteger(overviewQuery.data?.metrics.incorrectAnswerCount ?? 0)}
                      detail="Incorrect answers"
                    />
                    <MetricCard
                      icon={Brain}
                      label="Explanation requests"
                      value={formatInteger(overviewQuery.data?.metrics.explanationRequestCount ?? 0)}
                      detail="Detailed help requested"
                    />
                  </div>

                  <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
                    <KnowledgeGapChart gaps={gapsQuery.data?.gaps ?? []} />
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                          <Target className="h-4 w-4 text-primary" />
                          Recommended Review
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {(overviewQuery.data?.recommendations ?? []).length === 0 && (
                          <p className="text-sm text-muted-foreground">No recommendations for this range.</p>
                        )}
                        {(overviewQuery.data?.recommendations ?? []).map((item) => (
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

                  <FailureList failures={overviewQuery.data?.recentFailures ?? []} />
                </TabsContent>

                <TabsContent value="performance" className="mt-6 space-y-6">
                  <QuizPerformanceTable quizzes={performanceQuery.data?.quizzes ?? []} />
                  <FailureList failures={performanceQuery.data?.recentFailures ?? []} />
                </TabsContent>

                <TabsContent value="knowledge" className="mt-6">
                  <KnowledgeGapChart gaps={gapsQuery.data?.gaps ?? []} />
                </TabsContent>

                <TabsContent value="time" className="mt-6 space-y-6">
                  <div className="grid gap-4 md:grid-cols-3">
                    <MetricCard
                      icon={Clock3}
                      label="Active learning time"
                      value={formatSeconds(timeQuery.data?.totalSeconds ?? 0)}
                      detail={`${formatInteger(timeQuery.data?.sessionCount ?? 0)} sessions`}
                    />
                    <MetricCard
                      icon={BookOpen}
                      label="Tracked artifacts"
                      value={formatInteger(timeQuery.data?.topArtifacts.length ?? 0)}
                      detail="Most engaged items"
                    />
                    <MetricCard
                      icon={BarChart3}
                      label="Activity types"
                      value={formatInteger(timeQuery.data?.byArtifactType.length ?? 0)}
                      detail="Documents, quizzes, and artifacts"
                    />
                  </div>

                  <div className="grid gap-6 lg:grid-cols-2">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Time by Activity</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {(timeQuery.data?.byArtifactType ?? []).map((row) => (
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
                        {(timeQuery.data?.topArtifacts ?? []).map((artifact) => (
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