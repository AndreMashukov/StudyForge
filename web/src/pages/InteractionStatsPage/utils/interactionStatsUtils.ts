import { ArtifactType, InteractionStat } from '@shared-types';
import {
  TimeframeKey,
  IDirectoryStatRow,
  IBarChartDatum,
  IStackedBarDatum,
  IDailyTrendDatum,
  IPieChartDatum,
} from '../types/IInteractionStatsPage';

const ARTIFACT_LABELS: Record<ArtifactType, string> = {
  document: 'Documents',
  quiz: 'Quizzes',
  flashcardSet: 'Flashcards',
  slideDeck: 'Slide Decks',
  diagramQuiz: 'Diagram Quizzes',
  sequenceQuiz: 'Sequence Quizzes',
};

export function getArtifactLabel(type: ArtifactType): string {
  return ARTIFACT_LABELS[type];
}

export function formatDuration(totalSeconds: number): string {
  if (totalSeconds < 60) {
    return `${Math.round(totalSeconds)}s`;
  }
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.round(totalSeconds % 60);
  if (minutes < 60) {
    return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
}

function toLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getDateRange(timeframe: TimeframeKey): {
  startDate: string;
  endDate: string;
  label: string;
} {
  const now = new Date();
  const endDate = toLocalDateString(now);

  switch (timeframe) {
    case 'day':
      return { startDate: endDate, endDate, label: 'Today' };
    case 'week': {
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 6);
      return {
        startDate: toLocalDateString(weekAgo),
        endDate,
        label: 'Last 7 days',
      };
    }
    case 'month': {
      const monthAgo = new Date(now);
      monthAgo.setDate(monthAgo.getDate() - 29);
      return {
        startDate: toLocalDateString(monthAgo),
        endDate,
        label: 'Last 30 days',
      };
    }
  }
}

/**
 * Aggregate stats by directory from the raw stat docs (which are per-directory-per-day).
 */
export function aggregateStatsByDirectory(
  stats: InteractionStat[],
  directoryNames: Record<string, string>
): IDirectoryStatRow[] {
  const map = new Map<string, IDirectoryStatRow>();

  for (const stat of stats) {
    const existing = map.get(stat.directoryId);
    if (existing) {
      existing.totalSeconds += stat.totalSeconds;
      existing.ownSeconds += stat.ownSeconds;
      existing.sessionCount += stat.sessionCount;
      for (const key of Object.keys(stat.byArtifactType) as ArtifactType[]) {
        existing.byArtifactType[key] =
          (existing.byArtifactType[key] || 0) + (stat.byArtifactType[key] || 0);
      }
    } else {
      map.set(stat.directoryId, {
        directoryId: stat.directoryId,
        directoryName: directoryNames[stat.directoryId] || 'Unknown',
        totalSeconds: stat.totalSeconds,
        ownSeconds: stat.ownSeconds,
        byArtifactType: { ...stat.byArtifactType },
        sessionCount: stat.sessionCount,
      });
    }
  }

  return Array.from(map.values()).sort((a, b) => b.totalSeconds - a.totalSeconds);
}

export function toBarChartData(rows: IDirectoryStatRow[]): IBarChartDatum[] {
  return rows.map((r) => ({
    name: r.directoryName,
    minutes: Math.round((r.totalSeconds / 60) * 10) / 10,
    directoryId: r.directoryId,
  }));
}

export function toStackedBarData(rows: IDirectoryStatRow[]): IStackedBarDatum[] {
  return rows.map((r) => ({
    name: r.directoryName,
    document: Math.round((r.byArtifactType.document || 0) / 60 * 10) / 10,
    quiz: Math.round((r.byArtifactType.quiz || 0) / 60 * 10) / 10,
    flashcardSet: Math.round((r.byArtifactType.flashcardSet || 0) / 60 * 10) / 10,
    slideDeck: Math.round((r.byArtifactType.slideDeck || 0) / 60 * 10) / 10,
    diagramQuiz: Math.round((r.byArtifactType.diagramQuiz || 0) / 60 * 10) / 10,
    sequenceQuiz: Math.round((r.byArtifactType.sequenceQuiz || 0) / 60 * 10) / 10,
  }));
}

export function toDailyTrendData(
  stats: InteractionStat[],
  startDate: string,
  endDate: string
): IDailyTrendDatum[] {
  const dayTotals = new Map<string, number>();

  const [startY, startM, startD] = startDate.split('-').map(Number);
  const [endY, endM, endD] = endDate.split('-').map(Number);
  const start = new Date(startY, startM - 1, startD);
  const end = new Date(endY, endM - 1, endD);
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    dayTotals.set(toLocalDateString(d), 0);
  }

  for (const stat of stats) {
    if (!dayTotals.has(stat.date)) continue;
    dayTotals.set(stat.date, (dayTotals.get(stat.date) ?? 0) + stat.totalSeconds);
  }

  return Array.from(dayTotals.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, seconds]) => ({
      date: formatShortDate(date),
      minutes: Math.round((seconds / 60) * 10) / 10,
    }));
}

export function toPieChartData(rows: IDirectoryStatRow[]): IPieChartDatum[] {
  return rows
    .filter((r) => r.totalSeconds > 0)
    .map((r) => ({
      name: r.directoryName,
      value: Math.round((r.totalSeconds / 60) * 10) / 10,
      directoryId: r.directoryId,
    }));
}

function formatShortDate(dateStr: string): string {
  const [, month, day] = dateStr.split('-');
  return `${parseInt(month)}/${parseInt(day)}`;
}

export const CHART_COLORS = [
  'hsl(262, 83%, 66%)', // purple (primary)
  'hsl(142, 71%, 45%)', // green
  'hsl(217, 91%, 60%)', // blue
  'hsl(38, 92%, 50%)',  // amber
  'hsl(340, 82%, 52%)', // rose
  'hsl(174, 72%, 46%)', // teal
  'hsl(24, 95%, 53%)',  // orange
  'hsl(280, 68%, 60%)', // violet
];

export const ARTIFACT_TYPE_COLORS: Record<ArtifactType, string> = {
  document: 'hsl(262, 83%, 66%)',
  quiz: 'hsl(142, 71%, 45%)',
  flashcardSet: 'hsl(217, 91%, 60%)',
  slideDeck: 'hsl(38, 92%, 50%)',
  diagramQuiz: 'hsl(340, 82%, 52%)',
  sequenceQuiz: 'hsl(174, 72%, 46%)',
};
