import type {
  ArtifactType,
  DirectoryTreeNode,
  ICompletedDashboardArtifact,
  InteractionStat,
} from '@shared-types';
import type {
  TimeframeKey,
  IPieChartDatum,
} from '../../InteractionStatsPage/types/IInteractionStatsPage';
import type {
  IActivityHeatmapDay,
  IDashboardDateRange,
  IGenerationBucket,
} from '../types/IDashboard';
import {
  formatDateWithOptions,
  formatUtcIsoDate,
} from '../../../utils/dateUtils';

export const HEATMAP_DAY_COUNT = 153;
export const DASHBOARD_MATERIAL_TYPES: ArtifactType[] = [
  'document',
  'quiz',
  'flashcardSet',
  'slideDeck',
  'diagramQuiz',
  'sequenceQuiz',
  'matchQuiz',
];
export const GENERATED_ARTIFACT_TYPES: ICompletedDashboardArtifact['artifactType'][] =
  [
    'quiz',
    'flashcardSet',
    'slideDeck',
    'diagramQuiz',
    'sequenceQuiz',
    'matchQuiz',
  ];
export const DASHBOARD_TYPE_LABELS: Record<ArtifactType, string> = {
  document: 'Documents',
  quiz: 'Quizzes',
  flashcardSet: 'Flashcard sets',
  slideDeck: 'Slide decks',
  diagramQuiz: 'Diagram quizzes',
  sequenceQuiz: 'Sequence quizzes',
  matchQuiz: 'Match quizzes',
};

export function shiftReportingDay(date: string, days: number): string {
  const result = new Date(`${date}T12:00:00Z`);
  result.setUTCDate(result.getUTCDate() + days);
  return formatUtcIsoDate(result);
}

export function dashboardDateRange(
  endDate: string,
  dayCount: number,
): IDashboardDateRange {
  return {
    startDate: shiftReportingDay(endDate, 1 - dayCount),
    endDate,
    dayCount,
  };
}

export function dashboardFilteredRange(
  endDate: string,
  timeframe: TimeframeKey,
): IDashboardDateRange {
  return dashboardDateRange(
    endDate,
    timeframe === 'day' ? 1 : timeframe === 'week' ? 7 : 30,
  );
}

export function reportingDates(range: IDashboardDateRange): string[] {
  return Array.from({ length: range.dayCount }, (_, i) =>
    shiftReportingDay(range.startDate, i),
  );
}

export function buildActivityDays(
  stats: InteractionStat[],
  range: IDashboardDateRange,
): IActivityHeatmapDay[] {
  const dates = new Map<string, IActivityHeatmapDay>(
    reportingDates(range).map((date) => [
      date,
      { date, hasActivity: false, materialTypes: [] },
    ]),
  );
  for (const stat of stats) {
    const day = dates.get(stat.date);
    if (!day) continue;
    const types = DASHBOARD_MATERIAL_TYPES.filter(
      (type) =>
        Number.isFinite(stat.byArtifactType[type]) &&
        stat.byArtifactType[type] > 0,
    );
    day.hasActivity ||=
      stat.totalSeconds > 0 || stat.ownSeconds > 0 || types.length > 0;
    day.materialTypes = [...new Set([...day.materialTypes, ...types])];
  }
  return [...dates.values()];
}

export function directoryShareData(
  stats: InteractionStat[],
  tree: DirectoryTreeNode[],
): IPieChartDatum[] {
  const roots = new Map(
    tree.map((node) => [node.directory.id, node.directory.name]),
  );
  const totals = new Map<string, number>();
  for (const stat of stats) {
    if (
      !roots.has(stat.directoryId) ||
      !Number.isFinite(stat.totalSeconds) ||
      stat.totalSeconds <= 0
    )
      continue;
    totals.set(
      stat.directoryId,
      (totals.get(stat.directoryId) ?? 0) + stat.totalSeconds,
    );
  }
  return [...totals]
    .map(([directoryId, value]) => ({
      directoryId,
      name: roots.get(directoryId) ?? 'Unknown directory',
      value,
    }))
    .sort((a, b) => b.value - a.value);
}

export function generationBuckets(
  artifacts: ICompletedDashboardArtifact[],
  range: IDashboardDateRange,
  grouping: 'date' | 'type',
): IGenerationBucket[] {
  const unique = new Map<string, ICompletedDashboardArtifact>();
  for (const artifact of artifacts) {
    const day = formatUtcIsoDate(artifact.completedAt);
    if (day >= range.startDate && day <= range.endDate)
      unique.set(`${artifact.artifactType}:${artifact.id}`, artifact);
  }
  const rows = [...unique.values()];
  if (grouping === 'type')
    return GENERATED_ARTIFACT_TYPES.map((type) => ({
      id: type,
      label: DASHBOARD_TYPE_LABELS[type],
      artifacts: rows.filter((row) => row.artifactType === type),
    }));
  const dates = reportingDates(range),
    step = range.dayCount === 30 ? 5 : 1;
  return dates
    .filter((_, i) => i % step === 0)
    .map((date, i) => {
      const last = dates[Math.min((i + 1) * step, dates.length) - 1];
      return {
        id: date,
        label:
          step === 1
            ? formatDateWithOptions(date, 'MMM d')
            : `${formatDateWithOptions(date, 'MMM d')}–${formatDateWithOptions(last, 'MMM d')}`,
        artifacts: rows.filter((row) => {
          const day = formatUtcIsoDate(row.completedAt);
          return day >= date && day <= last;
        }),
      };
    });
}

export function artifactPath(artifact: ICompletedDashboardArtifact): string {
  const prefixes: Record<ICompletedDashboardArtifact['artifactType'], string> =
    {
      quiz: 'quiz',
      flashcardSet: 'flashcards',
      slideDeck: 'slides',
      diagramQuiz: 'diagram-quiz',
      sequenceQuiz: 'sequence-quiz',
      matchQuiz: 'match-quiz',
    };
  return `/${prefixes[artifact.artifactType]}/${encodeURIComponent(artifact.id)}`;
}
