import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '../../../components/ui/Card';
import { Tabs, TabsList, TabsTrigger } from '../../../components/ui/Tabs';
import { Spinner } from '../../../components/ui/Spinner';
import { Button } from '../../../components/ui/Button';
import { useGetInteractionStatsQuery } from '../../../store/api/InteractionTracking/interactionTrackingApi';
import { useGetDirectoryTreeQuery } from '../../../store/api/Directory/DirectoryApi';
import { ArtifactType, DirectoryTreeNode } from '@shared-types';
import { TimeframeKey } from '../types/IInteractionStatsPage';
import {
  getDateRange,
  formatDuration,
  aggregateStatsByDirectory,
  getArtifactLabel,
} from '../utils/interactionStatsUtils';
import { ArrowLeft, Clock, FolderOpen, BarChart3 } from 'lucide-react';

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

const ARTIFACT_TYPE_KEYS: ArtifactType[] = [
  'document',
  'quiz',
  'flashcardSet',
  'slideDeck',
  'diagramQuiz',
  'sequenceQuiz',
];

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

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center gap-3">
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
            <h1 className="text-xl font-semibold">Study Time</h1>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-6 space-y-6">
        {/* Timeframe selector */}
        <Tabs value={timeframe} onValueChange={(v) => setTimeframe(v as TimeframeKey)}>
          <TabsList>
            <TabsTrigger value="day">Today</TabsTrigger>
            <TabsTrigger value="week">Last 7 days</TabsTrigger>
            <TabsTrigger value="month">Last 30 days</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Summary card */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              {label}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <div className="flex justify-center py-8">
                <Spinner size="lg" variant="muted" />
              </div>
            ) : statsError ? (
              <p className="text-destructive">Failed to load stats.</p>
            ) : rows.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                No study activity recorded for this period.
              </p>
            ) : (
              <div className="space-y-1">
                <p className="text-3xl font-bold">{formatDuration(grandTotal)}</p>
                <p className="text-sm text-muted-foreground">
                  across {rows.length} {rows.length === 1 ? 'directory' : 'directories'}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Per-directory breakdown */}
        {!statsLoading && !statsError && rows.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">By Directory</h2>
            {rows.map((row) => {
              const pct =
                grandTotal > 0
                  ? Math.round((row.totalSeconds / grandTotal) * 100)
                  : 0;

              return (
                <Card key={row.directoryId}>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <FolderOpen className="h-4 w-4 text-primary shrink-0" />
                        <span className="font-medium truncate">
                          {row.directoryName}
                        </span>
                      </div>
                      <div className="text-right shrink-0 ml-4">
                        <span className="font-semibold">
                          {formatDuration(row.totalSeconds)}
                        </span>
                        <span className="text-sm text-muted-foreground ml-2">
                          ({pct}%)
                        </span>
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>

                    {/* Artifact type breakdown */}
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      {ARTIFACT_TYPE_KEYS.filter(
                        (type) => (row.byArtifactType[type] || 0) > 0
                      ).map((type) => (
                        <span key={type}>
                          {getArtifactLabel(type)}:{' '}
                          {formatDuration(row.byArtifactType[type])}
                        </span>
                      ))}
                    </div>

                    {/* Own vs inherited */}
                    {row.ownSeconds < row.totalSeconds && (
                      <p className="text-xs text-muted-foreground">
                        Direct: {formatDuration(row.ownSeconds)} · From
                        subdirectories:{' '}
                        {formatDuration(row.totalSeconds - row.ownSeconds)}
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};
