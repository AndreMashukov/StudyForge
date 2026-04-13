import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '../../../components/ui/Card';
import { Tabs, TabsList, TabsTrigger } from '../../../components/ui/Tabs';
import { Spinner } from '../../../components/ui/Spinner';
import { Button } from '../../../components/ui/Button';
import { useGetInteractionStatsQuery } from '../../../store/api/InteractionTracking/interactionTrackingApi';
import { useGetDirectoryTreeQuery } from '../../../store/api/Directory/DirectoryApi';
import { DirectoryTreeNode } from '@shared-types';
import { TimeframeKey } from '../types/IInteractionStatsPage';
import {
  getDateRange,
  formatDuration,
  aggregateStatsByDirectory,
  toBarChartData,
  toStackedBarData,
  toDailyTrendData,
  toPieChartData,
} from '../utils/interactionStatsUtils';
import { ArrowLeft, Clock, BarChart3, TrendingUp, PieChart as PieIcon, Layers } from 'lucide-react';
import { TimePerDirectoryChart } from './TimePerDirectoryChart';
import { ArtifactTypeBreakdownChart } from './ArtifactTypeBreakdownChart';
import { DailyTrendChart } from './DailyTrendChart';
import { DirectoryShareChart } from './DirectoryShareChart';

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

export const InteractionStatsPageContainer: React.FC = () => {
  const navigate = useNavigate();
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
    () => (statsResponse?.stats ? toDailyTrendData(statsResponse.stats, startDate, endDate) : []),
    [statsResponse, startDate, endDate]
  );
  const pieData = useMemo(() => toPieChartData(rows), [rows]);

  const hasData = !statsLoading && !statsError && rows.length > 0;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b px-4 py-3">
        <div className="max-w-6xl mx-auto flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            aria-label="Go back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-semibold">Study Dashboard</h1>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <Tabs value={timeframe} onValueChange={(v) => setTimeframe(v as TimeframeKey)}>
            <TabsList>
              <TabsTrigger value="day">Today</TabsTrigger>
              <TabsTrigger value="week">Last 7 days</TabsTrigger>
              <TabsTrigger value="month">Last 30 days</TabsTrigger>
            </TabsList>
          </Tabs>

          {hasData && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span className="text-sm">{label}</span>
              <span className="text-2xl font-bold text-foreground ml-2">
                {formatDuration(grandTotal)}
              </span>
            </div>
          )}
        </div>

        {statsLoading && (
          <div className="flex justify-center py-16">
            <Spinner size="lg" variant="muted" />
          </div>
        )}

        {!!statsError && (
          <Card className="border-destructive">
            <CardContent className="p-6">
              <p className="text-destructive">Failed to load stats.</p>
            </CardContent>
          </Card>
        )}

        {!statsLoading && !statsError && rows.length === 0 && (
          <Card>
            <CardContent className="p-12 text-center">
              <BarChart3 className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
              <p className="text-muted-foreground text-lg">
                No study activity recorded for this period.
              </p>
              <p className="text-muted-foreground text-sm mt-1">
                Open a document, quiz, or flashcard set to start tracking.
              </p>
            </CardContent>
          </Card>
        )}

        {hasData && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
      </main>
    </div>
  );
};
