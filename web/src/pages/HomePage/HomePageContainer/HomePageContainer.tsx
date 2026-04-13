import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Tabs, TabsList, TabsTrigger } from '../../../components/ui/Tabs';
import { Spinner } from '../../../components/ui/Spinner';
import { BarChart3, TrendingUp, PieChart as PieIcon, Layers, Clock, Brain, FileText } from 'lucide-react';
import { useHomePageContext } from '../context/HomePageContext';
import { useGetInteractionStatsQuery } from '../../../store/api/InteractionTracking/interactionTrackingApi';
import { useGetDirectoryTreeQuery } from '../../../store/api/Directory/DirectoryApi';
import { DirectoryTreeNode } from '@shared-types';
import { TimeframeKey } from '../../InteractionStatsPage/types/IInteractionStatsPage';
import {
  getDateRange,
  formatDuration,
  aggregateStatsByDirectory,
  toBarChartData,
  toStackedBarData,
  toDailyTrendData,
  toPieChartData,
} from '../../InteractionStatsPage/utils/interactionStatsUtils';
import { TimePerDirectoryChart } from '../../InteractionStatsPage/InteractionStatsPageContainer/TimePerDirectoryChart';
import { ArtifactTypeBreakdownChart } from '../../InteractionStatsPage/InteractionStatsPageContainer/ArtifactTypeBreakdownChart';
import { DailyTrendChart } from '../../InteractionStatsPage/InteractionStatsPageContainer/DailyTrendChart';
import { DirectoryShareChart } from '../../InteractionStatsPage/InteractionStatsPageContainer/DirectoryShareChart';

function flattenDirectoryNames(
  nodes: DirectoryTreeNode[] | undefined
): Record<string, string> {
  const result: Record<string, string> = {};
  if (!nodes) return result;

  const walk = (list: DirectoryTreeNode[]) => {
    for (const node of list) {
      result[node.directory.id] = node.directory.name;
      if (node.children?.length) walk(node.children);
    }
  };
  walk(nodes);
  return result;
}

export const HomePageContainer = () => {
  const navigate = useNavigate();
  const { handlers } = useHomePageContext();
  const [timeframe, setTimeframe] = useState<TimeframeKey>('week');

  const { startDate, endDate, label } = useMemo(
    () => getDateRange(timeframe),
    [timeframe]
  );

  const {
    data: statsResponse,
    isLoading: statsLoading,
    error: statsError,
  } = useGetInteractionStatsQuery({ startDate, endDate });

  const { data: treeResponse } = useGetDirectoryTreeQuery();

  const directoryNames = useMemo(
    () => flattenDirectoryNames(treeResponse?.tree),
    [treeResponse]
  );

  const rows = useMemo(() => {
    if (!statsResponse?.stats) return [];
    return aggregateStatsByDirectory(statsResponse.stats, directoryNames);
  }, [statsResponse, directoryNames]);

  const grandTotal = useMemo(
    () => rows.reduce((sum, r) => sum + r.totalSeconds, 0),
    [rows]
  );

  const barData = useMemo(() => toBarChartData(rows), [rows]);
  const stackedData = useMemo(() => toStackedBarData(rows), [rows]);
  const trendData = useMemo(
    () =>
      statsResponse?.stats
        ? toDailyTrendData(statsResponse.stats, startDate, endDate)
        : [],
    [statsResponse, startDate, endDate]
  );
  const pieData = useMemo(() => toPieChartData(rows), [rows]);

  const hasChartData = !statsLoading && !statsError && rows.length > 0;

  return (
    <div className="max-w-6xl mx-auto space-y-8 pt-6 pb-12">
      {/* Header */}
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">
            Dashboard
          </h1>
          <p className="text-muted-foreground mt-1">
            Your study activity at a glance
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Tabs
            value={timeframe}
            onValueChange={(v) => setTimeframe(v as TimeframeKey)}
          >
            <TabsList>
              <TabsTrigger value="day">Today</TabsTrigger>
              <TabsTrigger value="week">7 days</TabsTrigger>
              <TabsTrigger value="month">30 days</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">
              Total Study Time
            </p>
            <p className="text-2xl font-bold mt-1">
              {statsLoading ? '—' : formatDuration(grandTotal)}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">
              Directories
            </p>
            <p className="text-2xl font-bold mt-1">
              {statsLoading ? '—' : rows.length}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">with activity</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">
              Recent Quizzes
            </p>
            <p className="text-2xl font-bold mt-1">
              {handlers.recentQuizzes.isLoading
                ? '—'
                : handlers.recentQuizzes.data?.length ?? 0}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">available</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">
              Quiz History
            </p>
            <p className="text-2xl font-bold mt-1">
              {handlers.userQuizzes.isLoading
                ? '—'
                : handlers.userQuizzes.data?.length ?? 0}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">completed</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      {statsLoading && (
        <div className="flex justify-center py-12">
          <Spinner size="lg" variant="muted" />
        </div>
      )}

      {!!statsError && (
        <Card className="border-destructive">
          <CardContent className="p-6">
            <p className="text-destructive">Failed to load study stats.</p>
          </CardContent>
        </Card>
      )}

      {!statsLoading && !statsError && rows.length === 0 && (
        <Card>
          <CardContent className="p-10 text-center">
            <BarChart3 className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40" />
            <p className="text-muted-foreground">
              No study activity recorded for this period.
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Open a document, quiz, or flashcard set to start tracking.
            </p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => navigate('/documents')}
            >
              <FileText className="h-4 w-4 mr-2" />
              Browse Documents
            </Button>
          </CardContent>
        </Card>
      )}

      {hasChartData && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Daily trend — full width */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                Daily Study Trend
              </CardTitle>
            </CardHeader>
            <CardContent>
              <DailyTrendChart data={trendData} />
            </CardContent>
          </Card>

          {/* Time per directory */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
                Time per Directory
              </CardTitle>
            </CardHeader>
            <CardContent>
              <TimePerDirectoryChart data={barData} />
            </CardContent>
          </Card>

          {/* Directory share */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <PieIcon className="h-4 w-4 text-muted-foreground" />
                Directory Share
              </CardTitle>
            </CardHeader>
            <CardContent>
              <DirectoryShareChart data={pieData} />
            </CardContent>
          </Card>

          {/* Artifact type breakdown — full width */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Layers className="h-4 w-4 text-muted-foreground" />
                Artifact Type Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ArtifactTypeBreakdownChart data={stackedData} />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Recent quizzes row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
              Recent Quizzes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {handlers.recentQuizzes.isLoading ? (
              <div className="flex justify-center py-6">
                <Spinner size="sm" />
              </div>
            ) : handlers.recentQuizzes.data &&
              handlers.recentQuizzes.data.length > 0 ? (
              <div className="space-y-2">
                {handlers.recentQuizzes.data.slice(0, 4).map((quiz) => (
                  <div
                    key={quiz.id}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50 cursor-pointer transition-colors"
                    onClick={() => handlers.handleNavigateToQuiz(quiz.id)}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate text-sm">
                        {quiz.title}
                      </p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Clock size={10} />
                        {new Date(quiz.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <Button variant="ghost" size="sm">
                      Take Quiz
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-6">
                No quizzes created yet.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Brain className="h-4 w-4 text-muted-foreground" />
              Quiz History
            </CardTitle>
          </CardHeader>
          <CardContent>
            {handlers.userQuizzes.isLoading ? (
              <div className="flex justify-center py-6">
                <Spinner size="sm" />
              </div>
            ) : handlers.userQuizzes.data &&
              handlers.userQuizzes.data.length > 0 ? (
              <div className="space-y-2">
                {handlers.userQuizzes.data.slice(0, 4).map((quiz) => (
                  <div
                    key={quiz.id}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50 cursor-pointer transition-colors"
                    onClick={() => handlers.handleNavigateToQuiz(quiz.id)}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate text-sm">
                        {quiz.title}
                      </p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Clock size={10} />
                        {new Date(quiz.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <Button variant="ghost" size="sm">
                      Review
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-6">
                No quiz history yet.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};